import { Injectable } from '@nestjs/common';
import { CompanyMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isPublicProviderReady } from '../freelancers/provider-profile-policy';

/**
 * How someone is presented in the community.
 *
 * `verified` is the whole point of this file. LinkedIn's "current company" is
 * a text field anyone can type; ours is only ever set from an ACTIVE
 * CompanyMember row — the same record that governs access to that company's
 * candidates and billing — and only for a company that has proven its domain
 * or had its page reviewed by a person at Coral. Membership of a company
 * anyone could have created still names it, without the check.
 *
 * Everything else is marked as the person's own description and is never
 * badged, because we have not checked it and saying otherwise would make the
 * badge worthless everywhere it appears.
 */
export interface AuthorIdentity {
  /** e.g. "Recruiter at Airtel Uganda". Null when we know nothing. */
  label: string | null;
  /** True only when active company membership has been confirmed. */
  verified: boolean;
  companyId: string | null;
  companyName: string | null;
  /**
   * The id `/company-profile/:id` takes, when that company has a page worth
   * linking to.
   *
   * NOT `companyId`: that is the Company row, while the public page is an
   * EmployerProfile. Linking the wrong one gives a badge that 404s, which is
   * worse than a badge that does nothing.
   */
  companyProfileId: string | null;
  /** Provider preview or privacy-gated recruiting profile; never a private URL. */
  profileUrl?: string | null;
}

@Injectable()
export class CommunityIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves identity for many authors at once.
   *
   * Batched deliberately: a page of twenty posts with a per-author lookup is
   * twenty round trips for a subtitle, and the same person usually appears
   * more than once on a page.
   */
  async resolve(userIds: string[]): Promise<Map<string, AuthorIdentity>> {
    const unique = [...new Set(userIds)];
    const out = new Map<string, AuthorIdentity>();
    if (unique.length === 0) return out;

    const [memberships, employerProfiles, seekerProfiles, providerProfiles] = await Promise.all([
      /**
       * ACTIVE only. Someone suspended or removed is no longer speaking for
       * that company, and a badge saying otherwise would outlive the
       * relationship it describes.
       */
      this.prisma.companyMember.findMany({
        where: { userId: { in: unique }, status: CompanyMemberStatus.ACTIVE },
        select: { userId: true, companyId: true, company: { select: { name: true, domain: true } } },
      }),
      this.prisma.employerProfile.findMany({
        where: { userId: { in: unique } },
        select: { userId: true, jobTitle: true },
      }),
      this.prisma.jobSeekerProfile.findMany({
        where: { userId: { in: unique }, discoverable: true, user: { is: { status: 'ACTIVE' } } },
        select: { userId: true, headline: true, currentTitle: true, privacySettings: true },
      }),
      this.prisma.freelancerProfile.findMany({
        where: {
          userId: { in: unique }, providerEnabled: true, publicPreviewEnabled: true,
          user: { is: { status: 'ACTIVE', role: { in: ['JOB_SEEKER', 'FREELANCER'] } } },
        },
        select: {
          userId: true, providerEnabled: true, publicPreviewEnabled: true,
          category: true, headline: true, summary: true, skills: true,
          portfolioUrl: true, githubUrl: true, user: { select: { role: true, status: true } },
        },
      }),
    ]);

    const titleByUser = new Map(employerProfiles.map((p) => [p.userId, p.jobTitle?.trim() || null]));
    const companyIds = memberships.map((m) => m.companyId);
    const [pageByCompany, reviewed] = await Promise.all([
      this.linkablePages(companyIds),
      this.reviewedCompanies(companyIds),
    ]);

    for (const m of memberships) {
      const title = titleByUser.get(m.userId);
      out.set(m.userId, {
        label: title ? `${title} at ${m.company.name}` : `Member of ${m.company.name}`,
        // Membership says who they work with; the check says the company is
        // the real one. Anyone can create an "Airtel Uganda" — only a proven
        // domain, or a page a person at Coral reviewed, earns the check.
        verified: !!m.company.domain || reviewed.has(m.companyId),
        companyId: m.companyId,
        companyName: m.company.name,
        companyProfileId: pageByCompany.get(m.companyId) ?? null,
      });
    }

    for (const p of seekerProfiles) {
      if ((p.privacySettings as { profileVisible?: boolean } | null)?.profileVisible === false) continue;
      // Never overwrites a verified label — membership is stronger evidence
      // than anything typed into a profile.
      const existing = out.get(p.userId);
      if (existing) {
        out.set(p.userId, { ...existing, profileUrl: `/profile/${p.userId}` });
        continue;
      }
      const said = p.headline?.trim() || p.currentTitle?.trim() || null;
      out.set(p.userId, {
        label: said,
        verified: false,
        companyId: null,
        companyName: null,
        companyProfileId: null,
        profileUrl: `/profile/${p.userId}`,
      });
    }

    for (const p of providerProfiles) {
      if (!isPublicProviderReady(p, p.user)) continue;
      const identity = out.get(p.userId);
      out.set(p.userId, {
        label: identity?.verified ? identity.label : p.headline,
        verified: identity?.verified ?? false,
        companyId: identity?.companyId ?? null,
        companyName: identity?.companyName ?? null,
        companyProfileId: identity?.companyProfileId ?? null,
        profileUrl: `/providers/${p.userId}`,
      });
    }

    for (const id of unique) {
      if (!out.has(id)) {
        out.set(id, {
          label: null,
          verified: false,
          companyId: null,
          companyName: null,
          companyProfileId: null,
        });
      }
    }

    return out;
  }

  /**
   * The company page to send a reader to, per company.
   *
   * Private profiles are excluded because the page refuses them — an unlisted
   * one is only kept out of the directory, which is not the same as being
   * closed to someone who was handed a link.
   *
   * A company has one page (Company.pageId), whichever of its members'
   * profiles exist, so the destination is the same for everyone on the team.
   */
  private async linkablePages(companyIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(companyIds)];
    const byCompany = new Map<string, string>();
    if (unique.length === 0) return byCompany;

    const companies = await this.prisma.company.findMany({
      where: { id: { in: unique } },
      select: { id: true, deactivatedAt: true, page: { select: { id: true, visibility: true } } },
    });

    // A deactivated page has nowhere to send anyone until it is back.
    for (const c of companies) {
      if (c.page && c.page.visibility !== 'private' && !c.deactivatedAt) byCompany.set(c.id, c.page.id);
    }
    return byCompany;
  }

  /**
   * Companies whose page's documents a person at Coral reviewed and approved.
   * The page's level, not any member's: verification is the company's.
   */
  private async reviewedCompanies(companyIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(companyIds)];
    if (unique.length === 0) return new Set();
    const companies = await this.prisma.company.findMany({
      where: { id: { in: unique }, page: { is: { verificationStatus: 'verified' } } },
      select: { id: true },
    });
    return new Set(companies.map((c) => c.id));
  }

  /** Convenience for a single author. */
  async resolveOne(userId: string): Promise<AuthorIdentity> {
    const map = await this.resolve([userId]);
    return map.get(userId)!;
  }
}
