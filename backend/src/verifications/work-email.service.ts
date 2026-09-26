import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { VerificationStatus, VerificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email/email.service';
import { extractDomain, isFreeEmailDomain } from '../employers/utils/email-domain.util';

/** How long a code is good for. Long enough to find the email, short enough to matter. */
const CODE_TTL_MINUTES = 15;
/** Wrong guesses allowed before the code is burned. */
const MAX_ATTEMPTS = 5;
/** Codes one account may request per hour, across all of their experiences. */
const MAX_SENDS_PER_HOUR = 5;

/** Words that are in a company's legal name but not in its domain. */
const LEGAL_SUFFIXES = [
  'inc', 'incorporated', 'llc', 'ltd', 'limited', 'plc', 'corp', 'corporation',
  'co', 'company', 'gmbh', 'ag', 'sa', 'sas', 'bv', 'nv', 'pty', 'srl', 'spa',
  'group', 'holdings', 'technologies', 'technology', 'labs', 'software',
];

/** "Acme Inc." -> "acme"; "Shopify" -> "shopify". */
export function normalizeCompanyName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !LEGAL_SUFFIXES.includes(w));
  return words.join('');
}

/** "mail.acme.co.uk" -> "acme". The label that carries the brand. */
export function brandLabel(domain: string): string {
  const parts = domain.split('.').filter(Boolean);
  // Drop the public suffix. Two labels for the common co.uk/com.au shape, one
  // otherwise — this is a heuristic, and it only ever costs a false negative.
  const drop = parts.length > 2 && parts[parts.length - 2].length <= 3 ? 2 : 1;
  const kept = parts.slice(0, -drop);
  return kept[kept.length - 1] ?? parts[0] ?? '';
}

export interface StartResult {
  /** Where the code went, masked — enough to recognise, not enough to leak. */
  sentTo: string;
  expiresAt: Date;
}

export interface ConfirmResult {
  experienceId: string;
  domain: string;
  /** True when the domain could be tied to this employer, so the badge is earned. */
  verified: boolean;
  /** Said plainly to the person, whichever way it went. */
  message: string;
}

/**
 * Proving employment by receiving a code at the company's own mail domain.
 *
 * This is deliberately the cheap half of verification. It costs nothing per
 * check, and it answers a narrow question honestly: can this person read mail
 * at acme.com? Whether that means they work for the employer named on the
 * experience is a second question, answered by {@link tieToEmployer} — and
 * when it can't be answered, we say what we actually know instead of awarding
 * a badge that claims more.
 */
@Injectable()
export class WorkEmailService {
  private readonly logger = new Logger(WorkEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async start(userId: string, experienceId: string, rawEmail: string): Promise<StartResult> {
    const address = rawEmail.trim().toLowerCase();
    const domain = extractDomain(address);

    if (!address.includes('@') || !domain || !domain.includes('.')) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (isFreeEmailDomain(domain)) {
      throw new BadRequestException(
        'Use your work email. A personal address says nothing about where you work.',
      );
    }

    const experience = await this.ownedExperience(userId, experienceId);
    if (experience.verified) {
      throw new BadRequestException('This role is already verified');
    }

    const sentThisHour = await this.prisma.workEmailVerification.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
    });
    if (sentThisHour >= MAX_SENDS_PER_HOUR) {
      throw new BadRequestException('Too many codes requested. Try again in an hour.');
    }

    // A new code retires every code still outstanding for this role, so an
    // older email in the inbox can't be used after a newer one was requested.
    await this.prisma.workEmailVerification.updateMany({
      where: { experienceId, consumedAt: null },
      data: { expiresAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

    const issued = await this.prisma.workEmailVerification.create({
      data: {
        userId,
        experienceId,
        email: address,
        domain,
        codeHash: hashCode(code),
        expiresAt,
      },
    });

    try {
      await this.email.send({
        to: address,
        subject: `${code} is your Coral verification code`,
        html: [
          `<p>Use this code to confirm you work at <strong>${escapeHtml(experience.company)}</strong>:</p>`,
          `<p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>`,
          `<p>It expires in ${CODE_TTL_MINUTES} minutes.</p>`,
          `<p>If you didn't ask for this, you can ignore this email — nothing has changed on any account.</p>`,
        ].join(''),
        text: `Your Coral verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
        tags: [{ name: 'type', value: 'work_email_verification' }],
      });
    } catch (err) {
      // An unsent code is worse than none: it holds a rate-limit slot and it
      // retired the code that may still be sitting in their inbox.
      await this.prisma.workEmailVerification.delete({ where: { id: issued.id } }).catch(() => undefined);
      this.logger.error(
        `Work-email code to ${domain} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Why it failed is our problem, not theirs — an unconfigured mail sender
      // should not reach a job seeker as configuration advice.
      throw new ServiceUnavailableException(
        "We couldn't send the code just now. Please try again in a few minutes.",
      );
    }

    return { sentTo: maskEmail(address), expiresAt };
  }

  async confirm(userId: string, experienceId: string, code: string): Promise<ConfirmResult> {
    const experience = await this.ownedExperience(userId, experienceId);

    const pending = await this.prisma.workEmailVerification.findFirst({
      where: { userId, experienceId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!pending) {
      throw new BadRequestException('Ask for a code first');
    }
    if (pending.expiresAt <= new Date()) {
      throw new BadRequestException('That code has expired. Ask for a new one.');
    }
    if (pending.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many wrong codes. Ask for a new one.');
    }

    if (hashCode(code.trim()) !== pending.codeHash) {
      await this.prisma.workEmailVerification.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      const left = MAX_ATTEMPTS - (pending.attempts + 1);
      throw new BadRequestException(
        left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code isn\'t right. Ask for a new one.',
      );
    }

    const tied = await this.tieToEmployer(pending.domain, experience.company);

    await this.prisma.$transaction([
      this.prisma.workEmailVerification.update({
        where: { id: pending.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.experience.update({
        where: { id: experienceId },
        data: { verified: tied, verifiedWorkDomain: pending.domain },
      }),
    ]);

    // Only a tie earns a Verification record — that table is what "verified"
    // means everywhere else, and a domain we couldn't place doesn't qualify.
    if (tied) await this.recordVerification(userId, experienceId, pending.domain);

    return {
      experienceId,
      domain: pending.domain,
      verified: tied,
      message: tied
        ? `Verified. ${experience.company} is confirmed on your profile.`
        : `Your work email at ${pending.domain} is confirmed. We couldn't match that domain to ` +
          `"${experience.company}", so your profile shows the domain rather than a verified badge.`,
    };
  }

  /**
   * Whether a proved domain can be attributed to the employer named on the
   * experience. Both routes are biased toward saying no: a false negative
   * costs someone a badge, a false positive puts a lie on their profile.
   */
  private async tieToEmployer(domain: string, companyName: string): Promise<boolean> {
    const wanted = normalizeCompanyName(companyName);
    if (!wanted) return false;

    // 1. The domain belongs to a company we already know.
    const known = await this.prisma.company.findFirst({
      where: { domain },
      select: { name: true },
    });
    if (known && normalizeCompanyName(known.name) === wanted) return true;

    // 2. An employer on Coral declared this domain as their website.
    const employer = await this.prisma.employerProfile.findFirst({
      where: { companyWebsite: { contains: domain, mode: 'insensitive' } },
      select: { companyName: true, companyWebsite: true },
    });
    if (
      employer?.companyName &&
      extractDomain(employer.companyWebsite) === domain &&
      normalizeCompanyName(employer.companyName) === wanted
    ) {
      return true;
    }

    // 3. The domain simply is the company's name — shopify.com for Shopify.
    //    Covers employers who have never touched Coral, which is most of them.
    return brandLabel(domain) === wanted;
  }

  /** Mirrors the outcome into `Verification`, the record everything else reads. */
  private async recordVerification(userId: string, experienceId: string, domain: string) {
    const existing = await this.prisma.verification.findFirst({
      where: {
        userId,
        type: VerificationType.EXPERIENCE,
        targetId: experienceId,
        status: { in: [VerificationStatus.PENDING, VerificationStatus.APPROVED] },
      },
    });

    if (existing?.status === VerificationStatus.APPROVED) return;

    const data = {
      status: VerificationStatus.APPROVED,
      note: `Work email at ${domain}`,
      reviewerNote: 'Approved automatically — work-email code confirmed',
      reviewedAt: new Date(),
    };

    // A request already waiting for a person is settled, not duplicated.
    if (existing) {
      await this.prisma.verification.update({ where: { id: existing.id }, data });
      return;
    }

    await this.prisma.verification.create({
      data: { userId, type: VerificationType.EXPERIENCE, targetId: experienceId, ...data },
    });
  }

  private async ownedExperience(userId: string, experienceId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Job seeker profile not found');

    const experience = await this.prisma.experience.findUnique({
      where: { id: experienceId },
      select: { id: true, profileId: true, company: true, verified: true },
    });
    if (!experience) throw new NotFoundException('Experience not found');
    if (experience.profileId !== profile.id) {
      throw new ForbiddenException('You can only verify your own experience');
    }
    return experience;
  }
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** j***@acme.com — recognisable to its owner, useless to anyone else. */
function maskEmail(address: string): string {
  const [local, domain] = address.split('@');
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
