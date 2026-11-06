import { CompanyMemberStatus } from '@prisma/client';
import { CommunityIdentityService } from '../../../src/community/identity.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

function provider(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'professional', providerEnabled: true, publicPreviewEnabled: true,
    category: 'design', headline: 'Public product designer',
    summary: 'I help teams create accessible products and clear user experiences.',
    skills: ['Product design'], portfolioUrl: 'https://example.test/work', githubUrl: null,
    user: { role: 'JOB_SEEKER', status: 'ACTIVE' }, ...overrides,
  };
}

function seeker(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'professional', headline: 'Recruiting professional headline',
    currentTitle: 'Self-declared role', privacySettings: null, ...overrides,
  };
}

function harness() {
  const prisma = {
    companyMember: { findMany: jest.fn().mockResolvedValue([]) },
    // The first query supplies titles; a second conditional query supplies the
    // company's public page IDs, never private page contents.
    employerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    jobSeekerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    freelancerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    // Each company's one page (Company.pageId): where its badge links, and
    // whose review earns the check.
    company: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new CommunityIdentityService(prisma as unknown as PrismaService) };
}

describe('Phase 1 community identity: public provider and recruiting privacy', () => {
  it.each(['JOB_SEEKER', 'FREELANCER'])('links an active consenting %s to the public provider preview without verifying self-described skills', async (role) => {
    const { prisma, service } = harness();
    prisma.freelancerProfile.findMany.mockResolvedValue([provider({ user: { role, status: 'ACTIVE' } })]);
    await expect(service.resolveOne('professional')).resolves.toEqual({
      label: 'Public product designer', verified: false, companyId: null,
      companyName: null, companyProfileId: null, profileUrl: '/providers/professional',
    });
  });

  it('prefers the public provider introduction over a visible recruiting profile', async () => {
    const { prisma, service } = harness();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker()]);
    prisma.freelancerProfile.findMany.mockResolvedValue([provider()]);
    await expect(service.resolveOne('professional')).resolves.toMatchObject({
      label: 'Public product designer', profileUrl: '/providers/professional', verified: false,
    });
  });

  it.each([
    { providerEnabled: false }, { publicPreviewEnabled: false }, { category: 'unapproved' },
    { headline: '  ' }, { summary: 'too short' }, { skills: [] },
    { portfolioUrl: null }, { portfolioUrl: 'javascript:alert(1)' },
  ])('withholds an ineligible provider byline: %j', async (invalid) => {
    const { prisma, service } = harness();
    // Deliberately return a record which should normally have been filtered by
    // Prisma: the shared policy must also protect the link construction.
    prisma.freelancerProfile.findMany.mockResolvedValue([provider(invalid)]);
    const identity = await service.resolveOne('professional');
    expect(identity).toEqual({ label: null, verified: false, companyId: null, companyName: null, companyProfileId: null });
    expect(identity).not.toHaveProperty('profileUrl');
  });

  it.each([
    { role: 'JOB_SEEKER', status: 'PENDING_ONBOARDING' }, { role: 'JOB_SEEKER', status: 'INACTIVE' },
    { role: 'FREELANCER', status: 'SUSPENDED' }, { role: 'JOB_SEEKER', status: 'BANNED' },
    { role: 'EMPLOYER', status: 'ACTIVE' }, { role: 'ADMIN', status: 'ACTIVE' },
  ])('does not link a provider for $role / $status', async (account) => {
    const { prisma, service } = harness();
    prisma.freelancerProfile.findMany.mockResolvedValue([provider({ user: account })]);
    const identity = await service.resolveOne('professional');
    expect(identity.label).toBeNull();
    expect(identity.profileUrl).toBeUndefined();
    expect(identity.verified).toBe(false);
  });

  it('uses the authenticated recruiting profile as fallback when its discovery and visibility allow it', async () => {
    const { prisma, service } = harness();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker({ headline: '  ', privacySettings: { profileVisible: true } })]);
    prisma.freelancerProfile.findMany.mockResolvedValue([provider({ publicPreviewEnabled: false })]);
    await expect(service.resolveOne('professional')).resolves.toEqual({
      label: 'Self-declared role', verified: false, companyId: null,
      companyName: null, companyProfileId: null, profileUrl: '/profile/professional',
    });
    expect(prisma.jobSeekerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: { in: ['professional'] }, discoverable: true, user: { is: { status: 'ACTIVE' } } },
    }));
  });

  it('withholds private recruiting text and links when profileVisible is false', async () => {
    const { prisma, service } = harness();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker({ privacySettings: { profileVisible: false } })]);
    const identity = await service.resolveOne('professional');
    expect(identity.label).toBeNull();
    expect(identity.profileUrl).toBeUndefined();
    expect(JSON.stringify(identity)).not.toContain('Recruiting professional headline');
  });

  it('asks the database to exclude non-discoverable recruiting profiles instead of exposing a fallback label', async () => {
    const { prisma, service } = harness();
    // An empty query result represents the hidden candidate. Actual predicate
    // execution belongs to PostgreSQL integration; this checks the projection
    // and required authorization predicate passed to the data boundary.
    prisma.jobSeekerProfile.findMany.mockResolvedValue([]);
    await expect(service.resolveOne('professional')).resolves.toMatchObject({ label: null, verified: false });
    expect(prisma.jobSeekerProfile.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['professional'] }, discoverable: true, user: { is: { status: 'ACTIVE' } } },
      select: { userId: true, headline: true, currentTitle: true, privacySettings: true },
    });
  });

  it('does not make a private recruiting profile public merely because its provider preview is public', async () => {
    const { prisma, service } = harness();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker({ privacySettings: { profileVisible: false } })]);
    prisma.freelancerProfile.findMany.mockResolvedValue([provider()]);
    const identity = await service.resolveOne('professional');
    expect(identity.profileUrl).toBe('/providers/professional');
    expect(identity.label).toBe('Public product designer');
    expect(JSON.stringify(identity)).not.toContain('Recruiting professional headline');
  });
});

describe('Phase 1 community identity: verified company membership and safe projections', () => {
  // A company that has proven its domain, unless a test says otherwise.
  function membershipFixture(
    domain: string | null = 'company-a.example',
    page: { visibility: string } | null = { visibility: 'public' },
    reviewed: string[] = [],
    deactivatedAt: Date | null = null,
  ) {
    const result = harness();
    result.prisma.companyMember.findMany.mockResolvedValue([
      { userId: 'professional', companyId: 'company-a', company: { name: 'Company A', domain } },
    ]);
    // Their own row holds only their title; the company is shown by its page.
    result.prisma.employerProfile.findMany.mockResolvedValue([{ userId: 'professional', jobTitle: 'Recruiter' }]);
    result.prisma.company.findMany.mockImplementation(async (args: { where: { page?: unknown } }) =>
      args.where.page
        ? reviewed.map((id) => ({ id }))
        : [{ id: 'company-a', deactivatedAt, page: page && { id: 'company-page', ...page } }],
    );
    return result;
  }

  it('keeps the membership-backed company label while linking a consenting public provider', async () => {
    const { prisma, service } = membershipFixture();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker()]);
    prisma.freelancerProfile.findMany.mockResolvedValue([provider()]);
    await expect(service.resolveOne('professional')).resolves.toEqual({
      label: 'Recruiter at Company A', verified: true, companyId: 'company-a',
      companyName: 'Company A', companyProfileId: 'company-page', profileUrl: '/providers/professional',
    });
  });

  it("links the company's page whoever on the team is speaking, and nothing when that page is private", async () => {
    const { service } = membershipFixture('company-a.example', { visibility: 'private' });
    await expect(service.resolveOne('professional')).resolves.toMatchObject({
      label: 'Recruiter at Company A', companyId: 'company-a', companyProfileId: null,
    });
  });

  it('preserves verification and uses visible recruiting fallback when provider consent is absent', async () => {
    const { prisma, service } = membershipFixture();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker()]);
    prisma.freelancerProfile.findMany.mockResolvedValue([provider({ publicPreviewEnabled: false })]);
    await expect(service.resolveOne('professional')).resolves.toMatchObject({
      label: 'Recruiter at Company A', verified: true, profileUrl: '/profile/professional',
    });
  });

  it('keeps a verified company label without leaking a private recruiting destination', async () => {
    const { prisma, service } = membershipFixture();
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker({ privacySettings: { profileVisible: false } })]);
    const identity = await service.resolveOne('professional');
    expect(identity).toMatchObject({ label: 'Recruiter at Company A', verified: true });
    expect(identity.profileUrl).toBeUndefined();
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['professional'] }, status: CompanyMemberStatus.ACTIVE },
      select: { userId: true, companyId: true, company: { select: { name: true, domain: true } } },
    });
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['company-a'] } },
      select: { id: true, deactivatedAt: true, page: { select: { id: true, visibility: true } } },
    });
  });

  it("keeps the label but links nowhere while the company has deactivated its page", async () => {
    const { service } = membershipFixture('company-a.example', { visibility: 'public' }, [], new Date());
    await expect(service.resolveOne('professional')).resolves.toMatchObject({
      label: 'Recruiter at Company A', companyId: 'company-a', companyProfileId: null,
    });
  });

  it('gives an unproven company membership its label but not the check', async () => {
    // Anyone can create an "Airtel Uganda"; without a proven domain or a
    // reviewed page, saying who they work with is not saying it is real.
    const { prisma, service } = membershipFixture(null);
    await expect(service.resolveOne('professional')).resolves.toMatchObject({
      label: 'Recruiter at Company A', verified: false, companyId: 'company-a', companyProfileId: 'company-page',
    });
    // The review that counts is the company page's — never any one member's
    // own row, which is not what candidates see.
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['company-a'] }, page: { is: { verificationStatus: 'verified' } } },
      select: { id: true },
    });
    expect(prisma.employerProfile.findMany).toHaveBeenCalledTimes(1);
  });

  it('gives the check to a company whose page a person at Coral reviewed, without a domain', async () => {
    const { service } = membershipFixture(null, { visibility: 'public' }, ['company-a']);
    await expect(service.resolveOne('professional')).resolves.toMatchObject({ label: 'Recruiter at Company A', verified: true });
  });

  it('does not award a company badge from a self-entered title without active membership', async () => {
    const { prisma, service } = harness();
    prisma.employerProfile.findMany.mockResolvedValue([{ userId: 'professional', jobTitle: 'CEO at Claimed Company' }]);
    prisma.jobSeekerProfile.findMany.mockResolvedValue([seeker({ headline: 'Self-declared CEO' })]);
    await expect(service.resolveOne('professional')).resolves.toMatchObject({
      label: 'Self-declared CEO', verified: false, companyId: null, companyName: null, companyProfileId: null,
    });
    expect(prisma.companyMember.findMany.mock.calls[0][0].where.status).toBe(CompanyMemberStatus.ACTIVE);
  });

  it('projects only readiness and safe byline data, with status/consent predicates and deduplicated authors', async () => {
    const { prisma, service } = harness();
    await service.resolve(['professional', 'professional', 'other']);
    expect(prisma.freelancerProfile.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ['professional', 'other'] }, providerEnabled: true, publicPreviewEnabled: true,
        user: { is: { status: 'ACTIVE', role: { in: ['JOB_SEEKER', 'FREELANCER'] } } },
      },
      select: {
        userId: true, providerEnabled: true, publicPreviewEnabled: true,
        category: true, headline: true, summary: true, skills: true,
        portfolioUrl: true, githubUrl: true, user: { select: { role: true, status: true } },
      },
    });
    for (const projection of [
      prisma.freelancerProfile.findMany.mock.calls[0][0].select,
      prisma.jobSeekerProfile.findMany.mock.calls[0][0].select,
    ]) {
      expect(JSON.stringify(projection)).not.toMatch(/email|phone|resume|applications|rating|earnings|completedProjects/i);
    }
    expect(prisma.companyMember.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns an empty map without a database lookup for an empty feed', async () => {
    const { prisma, service } = harness();
    expect(await service.resolve([])).toEqual(new Map());
    for (const relation of Object.values(prisma)) expect(relation.findMany).not.toHaveBeenCalled();
  });
});
