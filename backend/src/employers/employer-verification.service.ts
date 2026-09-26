import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { workDomain } from './onboarding.service';

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

  async status(user: User) {
    const profile = await this.prisma.employerProfile.findUnique({
      where: { userId: user.id },
      select: { companyWebsite: true, companyName: true, verificationStatus: true },
    });

    const level = (profile?.verificationStatus as VerificationLevel) ?? 'unverified';
    const domain = workDomain(user.email);
    const canAutoVerify =
      level === 'unverified' && domainMatches(domain, profile?.companyWebsite ?? null);

    return {
      level,
      canReachCandidates: CAN_REACH_CANDIDATES.includes(level),
      workDomain: domain,
      companyWebsite: profile?.companyWebsite ?? null,
      /** Whether `verifyDomain()` would succeed right now. */
      canAutoVerify,
      /**
       * Free-mail employers can't domain-verify — everyone at gmail.com is not
       * one company. Real small businesses use those addresses, so this routes
       * them to document review rather than blocking them permanently.
       */
      needsDocuments: !domain && level === 'unverified',
      reason:
        level !== 'unverified'
          ? null
          : !domain
            ? 'Your email is a personal address, so we need a document to confirm the company.'
            : !profile?.companyWebsite
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

    await this.prisma.employerProfile.update({
      where: { userId: user.id },
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
    const profile = await this.prisma.employerProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true },
    });
    const level = (profile?.verificationStatus as VerificationLevel) ?? 'unverified';
    if (!CAN_REACH_CANDIDATES.includes(level)) {
      throw new ForbiddenException(
        'Verify your company before posting jobs or contacting candidates. Add your company website to verify instantly, or submit a document.',
      );
    }
  }
}
