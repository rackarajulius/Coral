import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { roleHasCapability } from '../company/capabilities';
import { signInDomainOf } from '../company/company-domain.service';
import { CompanyAuditService } from '../company/company-audit.service';
import { companyPageId, profileShownFor } from '../company/company-page';
import { checkSlug, slugFromName, type SlugCheck } from '../company/page-slug';
import { personName } from '../common/person-name';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: CompanyAuditService,
  ) {}

  /**
   * Where this employer is in setup.
   *
   * Derived from the profile rather than a stored step number — a stored
   * cursor drifts from reality the moment someone edits their profile
   * directly, and then onboarding asks for things they already filled in.
   */
  async state(user: User) {
    const seated = await this.prisma.companyMember.findFirst({
      where: { userId: user.id, status: CompanyMemberStatus.ACTIVE },
      select: { id: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    // The company's page, so a teammate sees their company's setup rather
    // than an empty row of their own.
    const profile = await profileShownFor(this.prisma, user.id, {
      companyName: true, companyWebsite: true, companySize: true, companyType: true, industry: true,
      headquarters: true, companyLogo: true, companyDescription: true,
      // Read back so the public-face step seeds from what's already there
      // instead of blanking fields the employer filled in from the dashboard.
      tagline: true, companyCulture: true, companyBenefits: true,
      verificationStatus: true, companyId: true, slug: true,
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
      /** The creator's name, so the company step can show what it already knows. */
      person: { firstName: user.firstName ?? null, lastName: user.lastName ?? null },
      /**
       * Whether they already act for a company. Without a seat the company
       * step creates one, which asks for their name and their word that they
       * may represent it; with one, it edits.
       */
      hasCompany: !!seated,
      /**
       * Whether this person may change the company's details and public
       * face: an owner or admin, or someone about to create a company.
       */
      canEditCompany: !seated || roleHasCapability(seated.role, 'company:write'),
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

    // The company that owns this domain comes first: it is the one a colleague
    // here should join, and the only one they may not duplicate.
    const owner = await this.domainOwner(domain);

    // The companies people at this domain work in, shown by their pages. Only
    // companies: a profile without one has nobody to approve a request, so it
    // used to be offered here and then refused.
    const seats = await this.prisma.companyMember.findMany({
      where: {
        status: CompanyMemberStatus.ACTIVE,
        userId: { not: user.id },
        user: { email: { endsWith: `@${domain}` } },
      },
      select: { companyId: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const companyIds = [...new Set(seats.map((s) => s.companyId))]
      .filter((id) => id !== owner?.id)
      .slice(0, 10);
    const pageIds = (await Promise.all(companyIds.map((id) => companyPageId(this.prisma, id))))
      .filter((id): id is string => !!id);
    const pages = pageIds.length
      ? await this.prisma.employerProfile.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true, companyName: true, companyLogo: true, companyWebsite: true,
            industry: true, headquarters: true, companyId: true,
          },
        })
      : [];
    const pageOrder = new Map(pageIds.map((id, i) => [id, i]));
    pages.sort((a, b) => (pageOrder.get(a.id) ?? 0) - (pageOrder.get(b.id) ?? 0));

    const matches = [...(owner?.page ? [owner.page] : []), ...pages]
      .filter((p) => !!p.companyName?.trim() && !!p.companyId)
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
      companyType?: string;
      industry?: string;
      headquarters?: string;
      isRecruiter?: boolean;
      isHiringManager?: boolean;
      isAdmin?: boolean;
      joinCompanyId?: string;
      firstName?: string;
      lastName?: string;
      authorizedRepresentative?: boolean;
      pageSlug?: string;
    },
  ) {
    let companyId: string | null = null;
    let slug: string | null = null;
    let joinPending = false;
    user = await this.saveName(user, dto);

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
      await this.assertNotDuplicating(user);
      const seat = await this.prisma.companyMember.findFirst({
        where: { userId: user.id, status: CompanyMemberStatus.ACTIVE },
        select: { companyId: true, role: true },
        orderBy: { createdAt: 'asc' },
      });
      if (seat) {
        await this.updateCompanyDetails(user, seat, dto);
        return { ...(await this.state(user)), joinPending: false };
      }

      this.assertMayCreate(user, dto);
      // Settled before anything is created, so a taken address never leaves
      // a company behind without its page.
      slug = await this.addressForNewPage(user, dto);
      companyId = await this.createCompanyFor(user, dto);
      const name = personName(user, 'Someone');
      await this.audit.record({
        companyId,
        actor: { id: user.id, name },
        category: 'COMPANY',
        action: 'Created company page',
        entityType: 'company',
        entityId: companyId,
        entityName: dto.companyName.trim(),
        summary: `${name} created the company page and confirmed they are authorized to represent ${dto.companyName.trim()}.`,
      });
    }

    const data = {
      companyName: dto.companyName.trim(),
      companyWebsite: dto.companyWebsite?.trim() || null,
      companySize: dto.companySize?.trim() || null,
      ...(dto.companyType !== undefined ? { companyType: dto.companyType || null } : {}),
      industry: dto.industry?.trim() || null,
      headquarters: dto.headquarters?.trim() || null,
      isRecruiter: dto.isRecruiter ?? false,
      isHiringManager: dto.isHiringManager ?? false,
      isAdmin: dto.isAdmin ?? false,
      // Left alone when joining: a pending request must not move the profile
      // onto a company it hasn't been admitted to.
      ...(companyId ? { companyId } : {}),
    };

    // A new company's page is public from the start, as on LinkedIn. It used
    // to keep the column default, "unlisted", until someone found Review &
    // publish in the editor — out of /companies, and nothing said so.
    const publish = companyId ? { visibility: 'public', ...(slug ? { slug } : {}) } : {};
    const upsert = (page: typeof publish) =>
      this.prisma.employerProfile.upsert({
        where: { userId: user.id },
        // jobTitle is required on create but isn't asked for in this step.
        create: { userId: user.id, jobTitle: '', ...data, ...page },
        update: { ...data, ...page },
        select: { id: true },
      });
    let profile: { id: string };
    try {
      profile = await upsert(publish);
    } catch (err) {
      // Someone took the address between the check and now: fall back to
      // one made from the name rather than leave the company without a page.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') || !slug) throw err;
      const fallback = await slugFromName(this.prisma, dto.companyName);
      profile = await upsert({ visibility: 'public', ...(fallback ? { slug: fallback } : {}) });
    }

    if (companyId) {
      // The creator's profile is the new company's page. A person has one
      // profile, so if it was the page of a company they have since left,
      // that company adopts another member's profile (companyPageId).
      await this.prisma.company.updateMany({
        where: { pageId: profile.id, id: { not: companyId } },
        data: { pageId: null },
      });
      await this.prisma.company.update({ where: { id: companyId }, data: { pageId: profile.id } });
    }

    return { ...(await this.state({ ...user, status: user.status } as User)), joinPending };
  }

  /**
   * The address a page being created gets: the one typed, if it can be used —
   * refused with the reason when it can't, as LinkedIn refuses a taken URL —
   * or, with none typed, one made from the company name.
   */
  private async addressForNewPage(user: User, dto: { companyName: string; pageSlug?: string }): Promise<string | null> {
    const own = await this.prisma.employerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (dto.pageSlug !== undefined && dto.pageSlug.trim()) {
      const check = await checkSlug(this.prisma, dto.pageSlug, own?.id);
      if (!check.available) throw new BadRequestException(check.reason ?? 'That address cannot be used.');
      return check.slug;
    }
    return slugFromName(this.prisma, dto.companyName, own?.id);
  }

  /**
   * Whether an address can be this person's page's, for the field that shows
   * it as they type: their company's page when they have one, else the page
   * they are about to create.
   */
  async checkPageAddress(user: User, input: string): Promise<SlugCheck> {
    const seat = await this.prisma.companyMember.findFirst({
      where: { userId: user.id, status: CompanyMemberStatus.ACTIVE },
      select: { companyId: true },
      orderBy: { createdAt: 'asc' },
    });
    const pageId = seat
      ? await companyPageId(this.prisma, seat.companyId)
      : (await this.prisma.employerProfile.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id ?? null;
    return checkSlug(this.prisma, input, pageId);
  }

  /**
   * The company step, for someone already in a company: its name and its
   * page's details. Only a seat that may edit the company may save it. A
   * Viewer could once rename the company by posting this step, and anyone's
   * edits here used to land on a row of their own that nobody saw.
   */
  private async updateCompanyDetails(
    user: User,
    seat: { companyId: string; role: CompanyRole },
    dto: {
      companyName: string; companyWebsite?: string; companySize?: string; companyType?: string; industry?: string;
      headquarters?: string; pageSlug?: string;
    },
  ) {
    if (!roleHasCapability(seat.role, 'company:write')) {
      throw new ForbiddenException("Only your company's owners and admins can change its details.");
    }
    const pageId = await companyPageId(this.prisma, seat.companyId);
    // A new address replaces the old one, as on LinkedIn; links by id keep working.
    let slug: string | undefined;
    if (dto.pageSlug !== undefined) {
      const check = await checkSlug(this.prisma, dto.pageSlug, pageId);
      if (!check.available) throw new BadRequestException(check.reason ?? 'That address cannot be used.');
      slug = check.slug;
    }
    const details = {
      companyName: dto.companyName.trim(),
      companyWebsite: dto.companyWebsite?.trim() || null,
      companySize: dto.companySize?.trim() || null,
      ...(dto.companyType !== undefined ? { companyType: dto.companyType || null } : {}),
      industry: dto.industry?.trim() || null,
      headquarters: dto.headquarters?.trim() || null,
      ...(slug ? { slug } : {}),
    };
    await this.prisma.company.update({ where: { id: seat.companyId }, data: { name: details.companyName } });

    if (pageId) {
      await this.prisma.employerProfile.update({ where: { id: pageId }, data: details });
      return;
    }
    // A company left with no page at all takes this person's profile as one.
    const own = await this.prisma.employerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, jobTitle: '', ...details, companyId: seat.companyId },
      update: { ...details, companyId: seat.companyId },
      select: { id: true },
    });
    await this.prisma.company.updateMany({
      where: { id: seat.companyId, pageId: null },
      data: { pageId: own.id },
    });
  }

  /**
   * Stores the name the person typed, when they typed one.
   *
   * Returns the user as it now stands, so the checks below and the audit line
   * read the name that was just saved.
   */
  private async saveName(user: User, dto: { firstName?: string; lastName?: string }): Promise<User> {
    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    const data = {
      ...(firstName && firstName !== user.firstName ? { firstName } : {}),
      ...(lastName && lastName !== user.lastName ? { lastName } : {}),
    };
    if (Object.keys(data).length === 0) return user;
    await this.prisma.user.update({ where: { id: user.id }, data });
    return { ...user, ...data };
  }

  /**
   * What creating a company page asks of the person, as on LinkedIn: their
   * name, and their word that they may act for the organization. Neither is
   * proof — verification is what unlocks reaching candidates — but the team
   * and Coral can see who created the page and on what basis.
   */
  private assertMayCreate(user: User, dto: { authorizedRepresentative?: boolean; companyType?: string }): void {
    if (!user.firstName?.trim() || !user.lastName?.trim()) {
      throw new BadRequestException(
        'Add your first and last name. A company page is created by a person, and your team will see who.',
      );
    }
    if (dto.authorizedRepresentative !== true) {
      throw new BadRequestException(
        'Confirm that you are authorized to represent this organization before creating its page.',
      );
    }
    // Asked for when a page is made, as on LinkedIn. Older pages may lack it.
    if (!dto.companyType) {
      throw new BadRequestException('Choose what kind of organization this is.');
    }
  }

  /** The company that owns a domain, with its page for the match list. */
  private async domainOwner(domain: string) {
    const company = await this.prisma.company.findUnique({
      where: { domain },
      select: { id: true, name: true },
    });
    if (!company) return null;
    const pageId = await companyPageId(this.prisma, company.id);
    const page = pageId
      ? await this.prisma.employerProfile.findUnique({
          where: { id: pageId },
          select: { id: true, companyName: true, companyLogo: true, companyWebsite: true, industry: true, headquarters: true, companyId: true },
        })
      : null;
    return { id: company.id, name: company.name, page };
  }

  /**
   * One company per domain, as on LinkedIn: someone whose email is at a
   * domain a company already owns joins that company rather than starting a
   * second one. Someone already in a company is editing it, not creating one.
   */
  private async assertNotDuplicating(user: User) {
    const domain = workDomain(user.email);
    if (!domain) return;
    const owner = await this.domainOwner(domain);
    if (!owner) return;
    const seated = await this.prisma.companyMember.findFirst({
      where: { userId: user.id, status: CompanyMemberStatus.ACTIVE }, select: { id: true },
    });
    if (seated) return;
    throw new BadRequestException(
      `Your email is at ${domain}, which belongs to ${owner.name} on Coral. Ask to join it instead of creating another company.`,
    );
  }

  /**
   * Creates the company this employer owns.
   *
   * It owns a domain from the start only when the creator has shown they hold
   * one: a verified sign-in email at it. Never the website they typed —
   * anyone can type airtel.co.ug. Without that, the company starts unclaimed
   * and an owner can prove a domain later (CompanyDomainService).
   */
  private async createCompanyFor(
    user: User,
    dto: { companyName: string; companyWebsite?: string },
  ): Promise<string> {
    // Only reached by someone with no active seat: re-running this step as a
    // member is an edit (updateCompanyDetails), never a second company.
    const domain = signInDomainOf(user);
    const taken = domain
      ? await this.prisma.company.findUnique({ where: { domain }, select: { id: true } })
      : null;
    const owns = !!domain && !taken;

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName.trim(),
        ...(owns ? { domain, domainVerifiedAt: new Date(), domainVerifiedMethod: 'sign-in', domainVerifiedById: user.id } : {}),
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
