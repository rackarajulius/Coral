import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CompanyAuditCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../services/email/email.service';
import { User } from '../common/types/user.types';

/**
 * Placeholders a template may use.
 *
 * A closed list, not free-form interpolation: an unknown token has to render as
 * something, and rendering it as empty silently produces "Dear ," in a
 * rejection letter. Anything not on this list is left visible so the mistake is
 * caught while writing rather than by the recipient.
 */
export const TEMPLATE_TOKENS = ['candidate_name', 'job_title', 'company_name'] as const;

/**
 * Replaces `{{token}}` for the tokens given a value; anything else stays
 * visible. Shared by bulk messages and outreach so a template fills the same
 * way wherever it is used.
 */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token: string) => {
    const key = token.toLowerCase();
    return key in values ? values[key] : whole;
  });
}

/** The `{{…}}` placeholders still in a text — each one would reach a candidate as written. */
export function unfilledTokens(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[0]))];
}

/** How many people one bulk send may reach. */
const MAX_BULK_RECIPIENTS = 200;

/**
 * Reusable messages to candidates, and sending them in bulk.
 *
 * Closing the loop with everyone who applied is the most common thing an ATS is
 * bought for and the most commonly skipped, because doing it by hand for two
 * hundred people is unthinkable. Making it one action is the difference between
 * a policy against ghosting and an actual practice.
 */
@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly audit: CompanyAuditService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  async list(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    return this.prisma.emailTemplate.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /** The token list, served rather than hard-coded in the UI so they cannot drift. */
  tokens() {
    return { tokens: TEMPLATE_TOKENS };
  }

  async create(
    user: User,
    input: { name: string; subject: string; body: string; category?: string },
  ) {
    const context = await this.companyContext.requireForUser(user.id);
    const existing = await this.prisma.emailTemplate.findFirst({
      where: { companyId: context.companyId, name: input.name.trim() },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('A template with that name already exists.');

    return this.prisma.emailTemplate.create({
      data: {
        companyId: context.companyId,
        name: input.name.trim(),
        subject: input.subject.trim(),
        body: input.body,
        category: input.category?.trim() || 'general',
        createdById: user.id,
      },
    });
  }

  async update(
    user: User,
    id: string,
    input: { name?: string; subject?: string; body?: string; category?: string },
  ) {
    const template = await this.requireCompanyTemplate(user, id);
    return this.prisma.emailTemplate.update({
      where: { id: template.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.subject !== undefined ? { subject: input.subject.trim() } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      },
    });
  }

  async remove(user: User, id: string) {
    const template = await this.requireCompanyTemplate(user, id);
    await this.prisma.emailTemplate.delete({ where: { id: template.id } });
    return { id };
  }

  /**
   * Sends a template to many applications at once.
   *
   * `markRejected` is opt-in rather than inferred from the template's category:
   * a company may well send a rejection template to someone they are keeping
   * warm, and quietly changing a pipeline stage because of a word in a category
   * field would be the tool deciding something the recruiter did not.
   */
  async sendBulk(
    user: User,
    input: { templateId: string; applicationIds: string[]; markRejected?: boolean },
  ) {
    const context = await this.companyContext.requireForUser(user.id);
    const template = await this.requireCompanyTemplate(user, input.templateId);

    const ids = [...new Set(input.applicationIds)];
    if (ids.length === 0) throw new BadRequestException('Select at least one candidate.');
    if (ids.length > MAX_BULK_RECIPIENTS) {
      throw new BadRequestException(
        `That is more than ${MAX_BULK_RECIPIENTS} people at once. Narrow the selection first.`,
      );
    }

    // Re-fetched under the company's own scope: the ids arrive from the client
    // and must never be trusted to belong to this company.
    const applications = await this.prisma.application.findMany({
      where: { id: { in: ids }, job: { postedById: { in: context.memberUserIds } } },
      select: {
        id: true,
        applicantId: true,
        applicant: {
          select: { email: true, displayName: true, firstName: true, lastName: true },
        },
        job: { select: { title: true } },
      },
    });

    let sent = 0;
    const failed: string[] = [];

    for (const application of applications) {
      const candidateName =
        application.applicant.displayName?.trim() ||
        [application.applicant.firstName, application.applicant.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        'there';

      const values = {
        candidate_name: candidateName,
        job_title: application.job.title,
        company_name: context.companyName,
      };
      const subject = this.render(template.subject, values);
      const body = this.render(template.body, values);

      try {
        // In-app first: it is ours and it cannot bounce. Email is best-effort
        // on top, so a mail failure still leaves the person informed.
        await this.notifications.create({
          userId: application.applicantId,
          type: 'application',
          title: subject,
          message: body,
        });
        await this.email
          .send({ to: application.applicant.email, subject, html: this.toHtml(body) })
          .catch((err: Error) => {
            this.logger.warn(`Bulk email to one recipient failed: ${err.message}`);
          });
        sent += 1;
      } catch (err) {
        this.logger.warn(`Bulk send failed for application: ${(err as Error).message}`);
        failed.push(application.id);
      }
    }

    // Being written to IS the response, whether or not it also rejects them —
    // this is the one path where a candidate hears back without the pipeline
    // moving. Only those we actually reached, and only where nothing earlier
    // was recorded.
    const reached = applications.map((a) => a.id).filter((id) => !failed.includes(id));
    if (reached.length > 0) {
      await this.prisma.application.updateMany({
        where: { id: { in: reached }, firstRespondedAt: null },
        data: { firstRespondedAt: new Date() },
      });
    }

    if (input.markRejected) {
      await this.prisma.application.updateMany({
        where: { id: { in: applications.map((a) => a.id) } },
        data: { status: 'rejected' },
      });
    }

    await this.audit.recordFor(user, {
      category: CompanyAuditCategory.CANDIDATES,
      action: 'Bulk message sent',
      entityType: 'email_template',
      entityId: template.id,
      // Count only. No names — this log exports to CSV and leaves the app.
      summary: `Sent "${template.name}" to ${sent} candidate(s)${
        input.markRejected ? ' and marked them rejected' : ''
      }.`,
    });

    /**
     * `requested` can exceed `sent` when an id did not belong to this company.
     * Both are returned rather than one reassuring number, so a selection that
     * silently lost people is visible.
     */
    return { requested: ids.length, matched: applications.length, sent, failed };
  }

  /* --------------------------------- helpers -------------------------------- */

  /** Replaces `{{token}}` for known tokens only; unknown ones stay visible. */
  private render(text: string, values: Record<string, string>): string {
    return renderTemplate(text, values);
  }

  /** Plain text with paragraphs, escaped — templates are not trusted as HTML. */
  private toHtml(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  private async requireCompanyTemplate(user: User, id: string) {
    const context = await this.companyContext.requireForUser(user.id);
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template || template.companyId !== context.companyId) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }
}
