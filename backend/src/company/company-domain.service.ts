import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CompanyAuditCategory, Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email/email.service';
import { User } from '../common/types/user.types';
import { extractDomain, isFreeEmailDomain, raiseVerificationLevel } from '../employers/utils/email-domain.util';
import { CompanyAuditService } from './company-audit.service';
import { CompanyContextService } from './company-context.service';
import { DomainTxtLookup } from './domain-txt-lookup';
import { companyPageId } from './company-page';

/** What the TXT record says, before the token. */
export const DNS_RECORD_PREFIX = 'coral-verification=';
/** DNS changes can take hours to appear; the record stays valid this long. */
const DNS_CLAIM_DAYS = 14;
/** Checks one DNS claim may run in its lifetime: each is a real DNS lookup. */
const MAX_DNS_CHECKS = 100;
/** An emailed code: long enough to find the email, short enough to matter. */
const CODE_TTL_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
/** Codes one company may have sent per hour. */
const MAX_CODES_PER_HOUR = 5;

export type DomainMethod = 'sign-in' | 'dns' | 'email';

const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * "https://www.Airtel.co.ug/careers" → "airtel.co.ug". Null when it isn't a
 * domain a company could own: not a hostname, or a free mail host (everyone
 * at gmail.com is not one company).
 */
export function companyDomainOf(value?: string | null): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  const host = raw.includes('@') ? extractDomain(raw) : (() => {
    try { return new URL(/^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`).hostname; } catch { return null; }
  })();
  const domain = host?.replace(/^www\./, '').replace(/\.$/, '') ?? null;
  return domain && HOSTNAME.test(domain) && !isFreeEmailDomain(domain) ? domain : null;
}

/**
 * The domain someone has shown they hold just by signing in: their account
 * email, once verified, when it is at a company domain.
 */
export function signInDomainOf(user: Pick<User, 'email'> & { emailVerified?: boolean | null }): string | null {
  return user.emailVerified ? companyDomainOf(user.email) : null;
}

/**
 * LinkedIn-style domain ownership: a company's domain is the company's only
 * once an owner or admin has shown they control it, and one domain belongs to
 * one company.
 *
 * Three ways to show it, strongest first in practice:
 * - **Sign-in** — their verified account email is at the domain. Instant.
 * - **DNS** — they publish a TXT record we gave them on the domain. Works for
 *   a Gmail owner whose IT team runs the domain, and needs no email at all.
 * - **Email** — a six-digit code to an address at the domain (LinkedIn's way).
 *   Only when Coral can send email.
 *
 * A typed website never claims anything: anyone can type airtel.co.ug.
 */
@Injectable()
export class CompanyDomainService {
  private readonly logger = new Logger(CompanyDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
    private readonly audit: CompanyAuditService,
    private readonly email: EmailService,
    private readonly txt: DomainTxtLookup,
  ) {}

  /** The company's domain, any proof under way, and what this person can do next. */
  async status(user: User) {
    const context = await this.companyContext.requireForUser(user.id);
    const [company, claim, page] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: context.companyId },
        select: { domain: true, domainVerifiedAt: true, domainVerifiedMethod: true },
      }),
      this.openClaim(context.companyId),
      companyPageId(this.prisma, context.companyId).then((pageId) =>
        pageId
          ? this.prisma.employerProfile.findUnique({ where: { id: pageId }, select: { companyWebsite: true } })
          : null,
      ),
    ]);
    const signInDomain = signInDomainOf(user);
    return {
      domain: company?.domain ?? null,
      verifiedAt: company?.domainVerifiedAt ?? null,
      method: (company?.domainVerifiedMethod as DomainMethod | null) ?? null,
      canManage: CompanyContextService.canManageMembers(context.role),
      /** Their own verified email's domain: claimable with one click. */
      signInDomain,
      /** A starting point for the box, from the website or their email. Never a claim. */
      suggestion: signInDomain ?? companyDomainOf(page?.companyWebsite),
      emailAvailable: this.email.canSend(),
      pending: claim && {
        method: claim.method as 'dns' | 'email',
        domain: claim.domain,
        expiresAt: claim.expiresAt,
        ...(claim.method === 'dns'
          ? { record: { type: 'TXT', host: claim.domain, value: `${DNS_RECORD_PREFIX}${claim.dnsToken}` } }
          : { sentTo: maskEmail(claim.email ?? '') }),
      },
    };
  }

  /** Claim the domain of their own verified sign-in email. */
  async claimBySignIn(user: User, rawDomain: string) {
    const { context, domain } = await this.prepare(user, rawDomain);
    if (signInDomainOf(user) !== domain) {
      throw new ForbiddenException(
        `You sign in with ${user.email}, not an address at ${domain}. Use a DNS record or an emailed code instead.`,
      );
    }
    await this.assign(context.companyId, domain, 'sign-in', user);
    return this.status(user);
  }

  /**
   * The TXT record to publish. The same token for as long as the claim
   * lasts: a new one each click would undo a record already published.
   */
  async startDns(user: User, rawDomain: string) {
    const { context, domain } = await this.prepare(user, rawDomain);
    const open = await this.openClaim(context.companyId);
    if (!(open?.method === 'dns' && open.domain === domain)) {
      await this.retireClaims(context.companyId);
      await this.prisma.companyDomainClaim.create({
        data: {
          companyId: context.companyId, domain, method: 'dns',
          dnsToken: randomBytes(16).toString('hex'),
          expiresAt: new Date(Date.now() + DNS_CLAIM_DAYS * 86_400_000),
          createdById: user.id,
        },
      });
    }
    return this.status(user);
  }

  /** Look for the record now. Not finding it yet is an answer, not an error. */
  async checkDns(user: User) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const claim = await this.openClaim(context.companyId);
    if (claim?.method !== 'dns' || !claim.dnsToken) throw new BadRequestException('Start with the DNS record first.');
    // Each check is a real DNS lookup; a record that hasn't appeared after
    // this many is better started afresh than polled forever.
    if (claim.attempts >= MAX_DNS_CHECKS) {
      throw new BadRequestException('That record has been checked many times without appearing. Start again for a new one.');
    }
    await this.prisma.companyDomainClaim.update({ where: { id: claim.id }, data: { attempts: { increment: 1 } } });

    const expected = `${DNS_RECORD_PREFIX}${claim.dnsToken}`;
    const records = await this.txt.records(claim.domain);
    if (!records.some((record) => record.trim() === expected)) {
      return { ...(await this.status(user)), found: false };
    }
    await this.assign(context.companyId, claim.domain, 'dns', user, claim.id);
    return { ...(await this.status(user)), found: true };
  }

  /** Send a code to an address at the domain. */
  async startEmail(user: User, rawAddress: string) {
    const address = rawAddress.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(address)) throw new BadRequestException('Enter an email address at the domain.');
    const { context, domain } = await this.prepare(user, address);
    if (!this.email.canSend()) {
      throw new ServiceUnavailableException("Coral can't send email yet. Use a DNS record instead.");
    }
    const sent = await this.prisma.companyDomainClaim.count({
      where: { companyId: context.companyId, method: 'email', createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (sent >= MAX_CODES_PER_HOUR) throw new BadRequestException('Too many codes requested. Try again in an hour.');

    // A new code retires every other proof under way, so an older email in
    // the inbox can't be used after a newer one was asked for.
    await this.retireClaims(context.companyId);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const claim = await this.prisma.companyDomainClaim.create({
      data: {
        companyId: context.companyId, domain, method: 'email', email: address, codeHash: hash(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000), createdById: user.id,
      },
    });
    try {
      await this.email.send({
        to: address,
        subject: `${code} is your Coral domain code`,
        html: [
          `<p>Someone is confirming that <strong>${escapeHtml(domain)}</strong> belongs to their company on Coral. Their code is:</p>`,
          `<p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>`,
          `<p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't expect this, don't share it — nothing changes without it.</p>`,
        ].join(''),
        text: `Your Coral domain code for ${domain} is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
        tags: [{ name: 'type', value: 'company_domain_verification' }],
      });
    } catch (err) {
      // An unsent code must not hold a rate-limit slot or retire one in an inbox.
      await this.prisma.companyDomainClaim.delete({ where: { id: claim.id } }).catch(() => undefined);
      this.logger.error(`Domain code to ${domain} failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException("We couldn't send the code just now. Try again in a few minutes, or use a DNS record.");
    }
    return this.status(user);
  }

  async confirmEmail(user: User, code: string) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const claim = await this.openClaim(context.companyId);
    if (claim?.method !== 'email' || !claim.codeHash) throw new BadRequestException('Ask for a code first.');
    if (claim.attempts >= MAX_CODE_ATTEMPTS) throw new BadRequestException('Too many wrong codes. Ask for a new one.');
    if (hash(code.trim()) !== claim.codeHash) {
      await this.prisma.companyDomainClaim.update({ where: { id: claim.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("That code isn't right.");
    }
    await this.assign(context.companyId, claim.domain, 'email', user, claim.id);
    return this.status(user);
  }

  /** Give the domain up. Colleagues at it then wait for approval again. */
  async release(user: User) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const company = await this.prisma.company.findUnique({ where: { id: context.companyId }, select: { domain: true } });
    if (!company?.domain) return this.status(user);
    await this.prisma.company.update({
      where: { id: context.companyId },
      data: { domain: null, domainVerifiedAt: null, domainVerifiedMethod: null, domainVerifiedById: null },
    });
    await this.audit.record({
      companyId: context.companyId, actor: { id: user.id, name: actorName(user) },
      category: CompanyAuditCategory.COMPANY, action: 'Removed domain', entityType: 'company_domain',
      entityName: company.domain, summary: `Removed ${company.domain} from the company`,
    });
    return this.status(user);
  }

  /* ------------------------------- internals ------------------------------ */

  /** An owner or admin, a domain a company could own, and one nobody else has. */
  private async prepare(user: User, raw: string) {
    const context = await this.companyContext.assertCanManageMembers(user.id);
    const domain = companyDomainOf(raw);
    if (!domain) {
      throw new BadRequestException(
        isFreeEmailDomain(extractDomain(raw)) ? 'A personal mail host like gmail.com belongs to no one company.' : 'Enter a domain like yourcompany.com.',
      );
    }
    const company = await this.prisma.company.findUnique({ where: { id: context.companyId }, select: { domain: true } });
    if (company?.domain) {
      throw new BadRequestException(company.domain === domain
        ? `${domain} is already your company's.`
        : `Your company already has ${company.domain}. Remove it before proving another.`);
    }
    await this.assertUnowned(context.companyId, domain);
    return { context, domain };
  }

  /** Deliberately doesn't say which company: that isn't this person's to learn. */
  private async assertUnowned(companyId: string, domain: string) {
    const owner = await this.prisma.company.findUnique({ where: { domain }, select: { id: true } });
    if (owner && owner.id !== companyId) {
      throw new ConflictException(`${domain} already belongs to another company on Coral. If you work there, ask its owner to invite you.`);
    }
  }

  /**
   * Make the domain the company's. The unique index settles a race: of two
   * companies proving the same domain at once, the second is refused.
   */
  private async assign(companyId: string, domain: string, method: DomainMethod, user: User, claimId?: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: companyId },
          data: { domain, domainVerifiedAt: new Date(), domainVerifiedMethod: method, domainVerifiedById: user.id },
        });
        if (claimId) await tx.companyDomainClaim.update({ where: { id: claimId }, data: { consumedAt: new Date() } });
        await tx.companyDomainClaim.updateMany({ where: { companyId, consumedAt: null }, data: { expiresAt: new Date() } });
        // Proving the domain shows more than an email-matches-website check
        // does, so the company's page rises to domain_verified. Never down.
        // The page, not the prover's own row: verification is the company's.
        const pageId = await companyPageId(tx, companyId);
        const page = pageId
          ? await tx.employerProfile.findUnique({ where: { id: pageId }, select: { id: true, verificationStatus: true } })
          : null;
        if (page) {
          await tx.employerProfile.update({
            where: { id: page.id },
            data: { verificationStatus: raiseVerificationLevel(page.verificationStatus, 'verified') },
          });
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`${domain} already belongs to another company on Coral. If you work there, ask its owner to invite you.`);
      }
      throw err;
    }
    await this.audit.record({
      companyId, actor: { id: user.id, name: actorName(user) },
      category: CompanyAuditCategory.COMPANY, action: 'Verified domain', entityType: 'company_domain',
      entityName: domain, summary: `Proved ${domain} belongs to the company (${METHOD_WORDS[method]})`,
    });
  }

  private openClaim(companyId: string) {
    return this.prisma.companyDomainClaim.findFirst({
      where: { companyId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private retireClaims(companyId: string) {
    return this.prisma.companyDomainClaim.updateMany({
      where: { companyId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
  }
}

const METHOD_WORDS: Record<DomainMethod, string> = {
  'sign-in': 'signed in with an address at it',
  dns: 'DNS record',
  email: 'emailed code',
};

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** j***@acme.com — recognisable to its owner, useless to anyone else. */
function maskEmail(address: string): string {
  const [local = '', domain = ''] = address.split('@');
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function actorName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.displayName?.trim() || 'A teammate';
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
