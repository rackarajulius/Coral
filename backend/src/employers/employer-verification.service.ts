import { ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { workDomain } from './onboarding.service';
import { signInDomainOf } from '../company/company-domain.service';
import { roleHasCapability } from '../company/capabilities';
import { profileShownFor } from '../company/company-page';

/**
 * How far an employer has proved they are who they say.
 *
 *  unverified      — nothing established. Cannot reach candidates.
 *  domain_verified — their work email matches their company's website domain.
 *                    Weak (anyone can buy g00gle-careers.com) but automatic,
 *                    and enough to stop the 30-second "post as Google" path.
 *  verified        — a person reviewed documents. Earns the visible badge.
 */
export type VerificationLevel = 'unverified' | 'domain_verified' | 'verified';

/** Levels permitted to contact candidates. */
const CAN_REACH_CANDIDATES: VerificationLevel[] = ['domain_verified', 'verified'];

function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** True when the email domain is the website's domain, or a subdomain of it. */
export function domainMatches(emailDomain: string | null, website: string | null): boolean {
  const host = hostOf(website);
  if (!emailDomain || !host) return false;
  return emailDomain === host || emailDomain.endsWith(`.${host}`) || host.endsWith(`.${emailDomain}`);
}

@Injectable()
export class EmployerVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The page whose verification this person is held to, and whether they
   * may act on it.
   *
   * Verification belongs to the company, as on LinkedIn: a recruiter at a
   * verified company may hire, and a recruiter can't verify a company — an
   * owner or admin does. Someone with no company verifies their own profile.
   */
  private async pageFor(userId: string) {
    const [seat, page] = await Promise.all([
      this.prisma.companyMember.findFirst({
        where: { userId, status: { not: CompanyMemberStatus.PENDING } },
        orderBy: { createdAt: 'asc' },
        select: { role: true, status: true, company: { select: { name: true, domain: true } } },
      }),
      profileShownFor(this.prisma, userId, {
        id: true,
        companyName: true,
        companyWebsite: true,
        verificationStatus: true,
      }),
    ]);
    const active = seat?.status === CompanyMemberStatus.ACTIVE ? seat : null;
    return {
      page,
      ownedDomain: active?.company.domain ?? null,
      canManage: !seat || (!!active && roleHasCapability(active.role, 'company:write')),
      companyName: active?.company.name ?? page?.companyName ?? null,
    };
  }

  async status(user: User) {
    const { page, ownedDomain, canManage, companyName } = await this.pageFor(user.id);

    const level = (page?.verificationStatus as VerificationLevel) ?? 'unverified';
    const domain = workDomain(user.email);
    // A domain the company has proven (CompanyDomainService) beats the typed
    // website: signing in with a verified address at it is the same evidence.
    const canAutoVerify = canManage && level === 'unverified' && (
      domainMatches(domain, page?.companyWebsite ?? null)
      || (!!ownedDomain && signInDomainOf(user) === ownedDomain)
    );

    return {
      level,
      canReachCandidates: CAN_REACH_CANDIDATES.includes(level),
      workDomain: domain,
      companyWebsite: page?.companyWebsite ?? null,
      /** Whether `verifyDomain()` would succeed right now. */
      canAutoVerify,
      /** Whether this person may verify the company: an owner or admin, or someone with no company. */
      canManage,
      /**
       * The document route, for anyone who can't verify instantly. Free-mail
       * employers can't domain-verify — everyone at gmail.com is not one
       * company — and an address that doesn't match the website can't
       * either; both used to be told "we need a document" with no way to
       * send one unless they were on free mail.
       */
      needsDocuments: canManage && level === 'unverified' && !canAutoVerify,
      reason:
        level !== 'unverified'
          ? null
          : !canManage
            ? `${companyName?.trim() || 'Your company'} isn't verified yet, so jobs can't be posted. An owner or admin can verify it.`
            : !domain
              ? 'Your email is a personal address, so we need a document to confirm the company.'
              : !page?.companyWebsite
                ? 'Add your company website — if it matches your email domain we can verify you instantly.'
                : canAutoVerify
                  ? null
                  : `Your email domain (${domain}) doesn't match your website, so we need a document.`,
    };
  }

  /**
   * Verifies by matching the work-email domain against the company website.
   *
   * Deliberately never granted the full `verified` badge — a matching domain
   * proves someone controls an email at that domain, not that the company is
   * real or that they represent it. The badge stays a human decision.
   */
  async verifyDomain(user: User) {
    const current = await this.status(user);
    if (current.level !== 'unverified') return current;
    if (!current.canAutoVerify) {
      throw new ForbiddenException(current.reason ?? 'Cannot verify automatically.');
    }

    const { page } = await this.pageFor(user.id);
    if (!page) throw new ForbiddenException('Set up your company page first.');
    await this.prisma.employerProfile.update({
      where: { id: page.id },
      data: { verificationStatus: 'domain_verified' },
    });
    return this.status(user);
  }

  /**
   * Guard for anything that puts an employer in front of a candidate.
   *
   * This is the anti-scam boundary. An unverified account can currently read
   * its own empty dashboard — what it must not do is publish a job, request a
   * CV, or invite someone to a recorded interview.
   */
  async assertCanReachCandidates(userId: string): Promise<void> {
    // The company's level, not the person's: a recruiter at a verified
    // company is cleared, and one at an unverified company is not.
    const page = await profileShownFor(this.prisma, userId, {
      verificationStatus: true,
      pageOf: { select: { deactivatedAt: true } },
    });
    // A company that has taken its page down is not hiring in public.
    if (page?.pageOf?.deactivatedAt) {
      throw new ForbiddenException(
        "Your company's page is deactivated, so jobs can't be posted and candidates can't be contacted. An owner can reactivate it in Company settings.",
      );
    }
    const level = (page?.verificationStatus as VerificationLevel) ?? 'unverified';
    if (!CAN_REACH_CANDIDATES.includes(level)) {
      throw new ForbiddenException(
        'Verify your company before posting jobs or contacting candidates. Add your company website to verify instantly, or submit a document.',
      );
    }
  }
}
