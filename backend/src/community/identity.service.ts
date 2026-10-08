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
 * candidates and billing. It cannot be self-asserted.
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
        select: { userId: true, companyId: true, company: { select: { name: true } } },
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
    const pageByCompany = await this.linkablePages(memberships.map((m) => m.companyId));

    for (const m of memberships) {
      const title = titleByUser.get(m.userId);
      out.set(m.userId, {
        label: title ? `${title} at ${m.company.name}` : `Member of ${m.company.name}`,
        verified: true,
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
   * A company can own several employer profiles, one per seat. Oldest wins, so
   * the destination is stable rather than changing with whoever joined last.
   */
  private async linkablePages(companyIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(companyIds)];
    const byCompany = new Map<string, string>();
    if (unique.length === 0) return byCompany;

    const profiles = await this.prisma.employerProfile.findMany({
      where: { companyId: { in: unique }, visibility: { not: 'private' } },
      select: { id: true, companyId: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const p of profiles) {
      if (p.companyId && !byCompany.has(p.companyId)) byCompany.set(p.companyId, p.id);
    }
    return byCompany;
  }

  /** Convenience for a single author. */
  async resolveOne(userId: string): Promise<AuthorIdentity> {
    const map = await this.resolve([userId]);
    return map.get(userId)!;
  }
}
