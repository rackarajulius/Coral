import { BadRequestException, Injectable } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { roleHasCapability } from '../company/capabilities';

/** Free/consumer mail hosts — never treated as a company identity. */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
  'zoho.com', 'yandex.com', 'msn.com',
]);

export function emailDomain(email?: string | null): string | null {
  const at = (email ?? '').trim().toLowerCase().split('@')[1];
  return at && at.includes('.') ? at : null;
}

/** A work domain, or null for free mail. */
export function workDomain(email?: string | null): string | null {
  const d = emailDomain(email);
  return d && !FREE_EMAIL_DOMAINS.has(d) ? d : null;
}

function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** A company this person may already belong to, matched on email domain. */
export interface CompanyMatch {
  profileId: string;
  companyId: string | null;
  companyName: string | null;
  companyLogo: string | null;
  website: string | null;
  industry: string | null;
  headquarters: string | null;
  /** Domain only — never presented as proof of employment. */
  matchedOn: string;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Where this employer is in setup.
   *
   * Derived from the profile rather than a stored step number — a stored
   * cursor drifts from reality the moment someone edits their profile
   * directly, and then onboarding asks for things they already filled in.
   */
  async state(user: User) {
    const profile = await this.prisma.employerProfile.findUnique({
      where: { userId: user.id },
      select: {
        companyName: true, companyWebsite: true, companySize: true, industry: true,
        headquarters: true, companyLogo: true, companyDescription: true,
        // Read back so the public-face step seeds from what's already there
        // instead of blanking fields the employer filled in from the dashboard.
        tagline: true, companyCulture: true, companyBenefits: true,
        verificationStatus: true, companyId: true,
      },
    });

    const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    const companyDone =
      !!profile && filled(profile.companyName) && filled(profile.industry) && filled(profile.companySize);
    const publicFaceDone =
      !!profile && filled(profile.companyLogo) && filled(profile.companyDescription);

    return {
      status: user.status,
      needsOnboarding: user.status === UserStatus.PENDING_ONBOARDING,
      steps: {
        company: companyDone,
        publicFace: publicFaceDone,
        verification: profile?.verificationStatus === 'verified',
      },
      /**
       * The step to resume on, or 'done' when nothing is outstanding — without
       * the third value someone who filled everything in would be dropped back
       * onto the public-face step every time they reopened setup.
       */
      next: !companyDone ? 'company' : !publicFaceDone ? 'publicFace' : 'done',
      workDomain: workDomain(user.email),
      profile,
    };
  }

  /**
   * Companies this person might already belong to, matched on work-email domain.
   *
   * Two recruiters from the same company signing up separately would otherwise
   * create two company profiles — and once reviews and followers accumulate
   * against both, merging stops being a data migration and becomes a judgement
   * call about whose reviews are whose.
   *
   * Free-mail addresses match nothing: everyone at gmail.com is not one company.
   */
  async matches(user: User): Promise<{ domain: string | null; matches: CompanyMatch[] }> {
    const domain = workDomain(user.email);
    if (!domain) return { domain: null, matches: [] };

    const owners = await this.prisma.user.findMany({
      where: {
        email: { endsWith: `@${domain}` },
        id: { not: user.id },
        employerProfile: { isNot: null },
      },
      select: {
        id: true,
        employerProfile: {
          select: {
            id: true, companyName: true, companyLogo: true, companyWebsite: true,
            industry: true, headquarters: true, companyId: true,
          },
        },
      },
      take: 10,
    });

    const seen = new Set<string>();
    const matches = owners
      .map((o) => o.employerProfile)
      .filter((p): p is NonNullable<typeof p> => !!p?.companyName)
      // Same company can have several profiles already; show each name once.
      .filter((p) => {
        const key = (p.companyId ?? p.companyName ?? '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => ({
        profileId: p.id,
        companyId: p.companyId,
        companyName: p.companyName,
        companyLogo: p.companyLogo,
        website: p.companyWebsite,
        industry: p.industry,
        headquarters: p.headquarters,
        // Matched on domain only — never presented as proof of employment.
        matchedOn: `@${domain}`,
      }));

    return { domain, matches };
  }

  /**
   * Saves the company step.
   *
   * `joinCompanyId` links this profile to an existing company rather than
   * creating a parallel one. It's accepted only when the target actually shares
   * this user's work-email domain — otherwise anyone could attach themselves to
   * any company by guessing an id.
   */
  async saveCompany(
    user: User,
    dto: {
      companyName: string;
      companyWebsite?: string;
      companySize?: string;
      industry?: string;
      headquarters?: string;
      isRecruiter?: boolean;
      isHiringManager?: boolean;
      isAdmin?: boolean;
      joinCompanyId?: string;
    },
  ) {
    let companyId: string | null = null;
    let joinPending = false;

    if (dto.joinCompanyId) {
      const { matches } = await this.matches(user);
      const match = matches.find(
        (m) => m.companyId === dto.joinCompanyId || m.profileId === dto.joinCompanyId,
      );
      if (!match?.companyId) {
        throw new BadRequestException(
          'That company does not match your work email, so you cannot join it here.',
        );
      }

      // A shared email domain says where someone probably works. It is not
      // proof, and company data now includes other people's applications and
      // CVs — so the request waits for an owner or admin rather than granting
      // itself access. Anyone who can obtain an address at the domain would
      // otherwise be inside.
      await this.prisma.companyMember.upsert({
        where: { companyId_userId: { companyId: match.companyId, userId: user.id } },
        create: {
          companyId: match.companyId,
          userId: user.id,
          role: CompanyRole.RECRUITER,
          status: CompanyMemberStatus.PENDING,
        },
        update: {},
      });
      joinPending = true;

      // Deliberately not linked to the company yet: the profile stays its own
      // until the membership is approved.
    } else {
      companyId = await this.createCompanyFor(user, dto);
    }

    const data = {
      companyName: dto.companyName.trim(),
      companyWebsite: dto.companyWebsite?.trim() || null,
      companySize: dto.companySize?.trim() || null,
      industry: dto.industry?.trim() || null,
      headquarters: dto.headquarters?.trim() || null,
      isRecruiter: dto.isRecruiter ?? false,
      isHiringManager: dto.isHiringManager ?? false,
      isAdmin: dto.isAdmin ?? false,
      // Left alone when joining: a pending request must not move the profile
      // onto a company it hasn't been admitted to.
      ...(companyId ? { companyId } : {}),
    };

    await this.prisma.employerProfile.upsert({
      where: { userId: user.id },
      // jobTitle is required on create but isn't asked for in this step.
      create: { userId: user.id, jobTitle: '', ...data },
      update: data,
    });

    return { ...(await this.state({ ...user, status: user.status } as User)), joinPending };
  }

  /**
   * Creates the company this employer owns.
   *
   * The domain is claimed here so the next colleague to sign up matches it —
   * but only a work domain, since every gmail.com address is not one company.
   * A domain already claimed leaves this company without one rather than
   * failing: a duplicate registration is a nuisance, a blocked signup is worse.
   */
  private async createCompanyFor(
    user: User,
    dto: { companyName: string; companyWebsite?: string },
  ): Promise<string> {
    // Re-running this step must not spawn a second company — it's an edit of
    // the one they already belong to.
    const existing = await this.prisma.companyMember.findFirst({
      where: { userId: user.id, status: CompanyMemberStatus.ACTIVE },
      select: { companyId: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      // Only a seat that may edit the company may rename it. This used to
      // assume whoever re-ran onboarding owned the company, so any member —
      // a Viewer included — could rename it by posting this step.
      if (roleHasCapability(existing.role, 'company:write')) {
        await this.prisma.company.update({
          where: { id: existing.companyId },
          data: { name: dto.companyName.trim() },
        });
      }
      return existing.companyId;
    }

    const domain = hostOf(dto.companyWebsite) ?? workDomain(user.email);
    const taken = domain
      ? await this.prisma.company.findUnique({ where: { domain }, select: { id: true } })
      : null;

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName.trim(),
        domain: taken ? null : domain,
        members: {
          create: {
            userId: user.id,
            role: CompanyRole.OWNER,
            status: CompanyMemberStatus.ACTIVE,
            joinedAt: new Date(),
          },
        },
      },
    });
    return company.id;
  }

  /**
   * Finishes onboarding.
   *
   * Only the company step is required. Profile polish and verification are
   * deliberately not blocking here — they gate the actions that reach
   * candidates (posting, inviting), not access to an empty dashboard.
   */
  async complete(user: User) {
    const state = await this.state(user);
    if (!state.steps.company) {
      throw new BadRequestException('Add your company details before continuing.');
    }

    if (user.status === UserStatus.PENDING_ONBOARDING) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      });
    }
    return { ...state, status: UserStatus.ACTIVE, needsOnboarding: false };
  }
}
