import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FreelancersService } from '../../../src/freelancers/freelancers.service';
import { UpdateFreelancerProfileDto } from '../../../src/freelancers/dto/update-freelancer-profile.dto';
import { ProviderDirectoryQueryDto } from '../../../src/freelancers/dto/provider-directory-query.dto';
import { AppValidationPipe } from '../../../src/common/pipes/validation.pipe';
import { isPublicProviderReady, providerProfileReadiness } from '../../../src/freelancers/provider-profile-policy';

function profile() {
  return {
    id: '10000000-0000-4000-8000-000000000001', userId: 'provider',
    providerEnabled: true, publicPreviewEnabled: true, category: 'design',
    headline: 'Product designer', title: 'Designer',
    summary: 'I design accessible interfaces and practical products for growing companies.',
    skills: ['Product design'], expertise: ['Accessibility'],
    hourlyRate: '80', currency: 'CAD', country: 'Canada', city: 'Toronto', timezone: 'America/Toronto',
    availableForRemote: true, availability: 'available', hoursPerWeek: 20,
    portfolioUrl: 'https://example.com/work', githubUrl: null as string | null,
    linkedinUrl: null as string | null, workPreferences: ['project'],
    completedProjects: 88, rating: 5, totalEarnings: 100000,
    createdAt: new Date('2026-10-07T00:00:00Z'), updatedAt: new Date('2026-10-07T00:00:00Z'),
    user: {
      id: 'provider', displayName: 'Professional', firstName: 'Pro', lastName: 'Member', avatarUrl: null,
      // Deliberately excessive mock payload: the serializer must still be safe.
      email: 'private@example.com', emailVerified: true, resumeUrl: 'private-resume.pdf',
    },
    recruitingNotes: 'private',
  };
}

function harness() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'JOB_SEEKER', status: 'ACTIVE' }), update: jest.fn() },
    freelancerProfile: {
      findUnique: jest.fn().mockResolvedValue(profile()),
      findFirst: jest.fn().mockResolvedValue(profile()), findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(async ({ update }) => ({ ...profile(), ...update })),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'provider' }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  return { prisma, service: new FreelancersService(prisma as unknown as PrismaService) };
}

describe('Personal provider setup and privacy', () => {
  it('does not create or enable a provider merely by reading setup', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findUnique.mockResolvedValue(null);
    await expect(service.getMyProfile('provider')).resolves.toBeNull();
    expect(prisma.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each(['JOB_SEEKER', 'FREELANCER'])('lets an active %s save a private draft without replacing role/history', async (role) => {
    const { service, prisma } = harness();
    prisma.user.findUnique.mockResolvedValue({ role, status: 'ACTIVE' });
    prisma.freelancerProfile.findUnique.mockResolvedValue(null);
    await service.updateMyProfile('provider', { providerEnabled: true, headline: '  Designer  ', skills: [' UX ', 'ux', ''] });
    expect(prisma.freelancerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'provider' },
      create: expect.objectContaining({ userId: 'provider', headline: 'Designer', skills: ['UX'], currency: 'CAD', country: 'Canada' }),
      update: expect.not.objectContaining({ role: expect.anything(), completedProjects: expect.anything() }),
    }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'EMPLOYER', status: 'ACTIVE' }, { role: 'ADMIN', status: 'ACTIVE' },
    { role: 'JOB_SEEKER', status: 'PENDING_ONBOARDING' }, { role: 'FREELANCER', status: 'SUSPENDED' },
    { role: 'JOB_SEEKER', status: 'BANNED' }, { role: 'JOB_SEEKER', status: 'INACTIVE' },
  ])('rejects setup and writes for $role / $status', async (account) => {
    const { service, prisma } = harness();
    prisma.user.findUnique.mockResolvedValue(account);
    await expect(service.getMyProfile('provider')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateMyProfile('provider', { providerEnabled: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.freelancerProfile.upsert).not.toHaveBeenCalled();
  });

  it('rejects stale writes for a deleted member', async () => {
    const { service, prisma } = harness();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.updateMyProfile('provider', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.freelancerProfile.upsert).not.toHaveBeenCalled();
  });

  it('rejects public consent while required work evidence is incomplete', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findUnique.mockResolvedValue({ ...profile(), portfolioUrl: null, linkedinUrl: 'https://example.com/profile' });
    await expect(service.updateMyProfile('provider', { publicPreviewEnabled: true })).rejects.toThrow('work evidence');
    expect(prisma.freelancerProfile.upsert).not.toHaveBeenCalled();
  });

  it('does not make a public preview from consent alone when offering is disabled', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findUnique.mockResolvedValue({ ...profile(), providerEnabled: false });
    await expect(service.updateMyProfile('provider', { publicPreviewEnabled: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.freelancerProfile.upsert).not.toHaveBeenCalled();
  });

  it('allows clearing work links and text when offering is disabled, and withdraws public access', async () => {
    const { service, prisma } = harness();
    const result = await service.updateMyProfile('provider', { providerEnabled: false, portfolioUrl: null, headline: null });
    expect(result.publicPreviewEnabled).toBe(false);
    expect(result.completedProjects).toBe(88);
    expect(result.statisticsProvenance).toBe('legacy_self_declared');
    expect(prisma.freelancerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { providerEnabled: false, publicPreviewEnabled: false, portfolioUrl: null, headline: null },
    }));
  });

  it('prevents an incomplete edit from leaving a published preview accessible', async () => {
    const { service, prisma } = harness();
    await expect(service.updateMyProfile('provider', { skills: [] })).rejects.toThrow('skills');
    expect(prisma.freelancerProfile.upsert).not.toHaveBeenCalled();
  });

  it.each(['completedProjects', 'rating', 'totalEarnings', 'userId', 'role'])('rejects a direct self-service attempt to assign %s', async (field) => {
    const { service, prisma } = harness();
    await expect(service.updateMyProfile('provider', { [field]: 99 } as UpdateFreelancerProfileDto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('Provider public preview and people discovery', () => {
  it('projects safe fields and withholds email, resume, private data and self-declared trust statistics', async () => {
    const { service, prisma } = harness();
    const result = await service.getPublicProfile('provider');
    expect(result.user).toEqual({ id: 'provider', displayName: 'Professional', firstName: 'Pro', lastName: 'Member', avatarUrl: null });
    for (const key of ['completedProjects', 'rating', 'totalEarnings', 'recruitingNotes', 'providerEnabled', 'publicPreviewEnabled']) {
      expect(result).not.toHaveProperty(key);
    }
    expect(prisma.freelancerProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'provider', providerEnabled: true, publicPreviewEnabled: true,
        user: { is: { status: 'ACTIVE', role: { in: ['JOB_SEEKER', 'FREELANCER'] } } },
      }),
      select: expect.not.objectContaining({ completedProjects: expect.anything(), rating: expect.anything(), totalEarnings: expect.anything() }),
    }));
  });

  it('uses the same 404 for absent or visibility-filtered profiles', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findFirst.mockResolvedValue(null);
    await expect(service.getPublicProfile('provider')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('withholds an invalid legacy profile even if flags were incorrectly set', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findFirst.mockResolvedValue({ ...profile(), portfolioUrl: 'javascript:alert(1)' });
    await expect(service.getPublicProfile('provider')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('redacts unsafe non-evidence links and unsupported historical availability', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findFirst.mockResolvedValue({ ...profile(), linkedinUrl: 'javascript:alert(1)', availability: 'full-time' });
    const result = await service.getPublicProfile('provider');
    expect(result.linkedinUrl).toBeNull();
    expect(result.availability).toBeNull();
  });

  it('filters directory privacy in the database and advances stable bounded pages without recruiting searches', async () => {
    const { service, prisma } = harness();
    const second = { ...profile(), id: '10000000-0000-4000-8000-000000000002' };
    prisma.$queryRaw.mockResolvedValue([{ id: profile().id }, { id: second.id }]);
    prisma.freelancerProfile.findMany.mockResolvedValue([profile()]);
    const result = await service.listPublicProfiles({ category: 'design', q: 'designer', limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe(profile().id);
    expect(prisma.freelancerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ category: 'design', providerEnabled: true, publicPreviewEnabled: true }),
      take: 1, orderBy: { id: 'asc' },
    }));
    expect(JSON.stringify(prisma.freelancerProfile.findMany.mock.calls[0][0].where)).not.toMatch(/email|resume|jobSeekerProfile/);
    await service.listPublicProfiles({ cursor: profile().id });
    const lookup = prisma.$queryRaw.mock.calls[1][0];
    expect(lookup.text).toContain('AND profile.id >');
    expect(lookup.values).toContain(profile().id);
    expect(lookup.values.at(-1)).toBe(13);
    expect(lookup.text).toContain("account.status = 'ACTIVE'");
    expect(lookup.text).toContain('profile.public_preview_enabled = true');
    expect(lookup.text).not.toMatch(/email|resume|job_seeker/);
  });

  it('matches skill labels case-insensitively and partially in the database', async () => {
    const { service, prisma } = harness();
    prisma.$queryRaw.mockResolvedValue([{ id: profile().id }]);
    prisma.freelancerProfile.findMany.mockResolvedValue([profile()]);
    await service.listPublicProfiles({ q: 'react' });
    const lookup = prisma.$queryRaw.mock.calls[0][0];
    expect(lookup.text).toContain('unnest(profile.skills)');
    expect(lookup.text).toMatch(/label ILIKE \$\d+ ESCAPE \$\d+/);
    expect(lookup.values).toContain('%react%');
    expect(prisma.freelancerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [profile().id] }, publicPreviewEnabled: true }),
    }));
  });

  it.each(['%', '_', '\\', "' OR 1=1 --"])(
    'binds and escapes search punctuation literally: %s', async (search) => {
      const { service, prisma } = harness();
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.listPublicProfiles({ q: search })).resolves.toEqual({ items: [], nextCursor: null });
      const lookup = prisma.$queryRaw.mock.calls[0][0];
      const literal = search.replace(/[\\%_]/g, (character) => `\\${character}`);
      expect(lookup.values).toContain(`%${literal}%`);
      expect(lookup.values).toContain('\\');
      expect(lookup.text).not.toContain("' OR 1=1 --");
      expect(prisma.freelancerProfile.findMany).not.toHaveBeenCalled();
    },
  );

  it('rejects oversized directory queries before touching the database', async () => {
    const { service, prisma } = harness();
    await expect(service.listPublicProfiles({ q: 'x'.repeat(101) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listPublicProfiles({ limit: 25 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('Provider DTO validation and shared visibility policy', () => {
  const pipe = new AppValidationPipe();

  it.each(['completedProjects', 'rating', 'totalEarnings'])('rejects historical %s mutation at the HTTP validation boundary', async (field) => {
    await expect(pipe.transform({ [field]: 100 }, { type: 'body', metatype: UpdateFreelancerProfileDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['providerEnabled', 'publicPreviewEnabled', 'availableForRemote'])('requires an actual boolean for %s, even with implicit conversion enabled', async (field) => {
    await expect(pipe.transform({ [field]: 'false' }, { type: 'body', metatype: UpdateFreelancerProfileDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ [field]: null }, { type: 'body', metatype: UpdateFreelancerProfileDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ [field]: false }, { type: 'body', metatype: UpdateFreelancerProfileDto })).resolves.toHaveProperty(field, false);
  });

  it('supports nullable clearing while rejecting null non-nullable arrays', async () => {
    await expect(pipe.transform({ headline: null, portfolioUrl: null, category: null }, { type: 'body', metatype: UpdateFreelancerProfileDto }))
      .resolves.toMatchObject({ headline: null, portfolioUrl: null, category: null });
    await expect(pipe.transform({ skills: null }, { type: 'body', metatype: UpdateFreelancerProfileDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { category: 'finance' }, { workPreferences: ['employment'] }, { availability: 'full-time' },
    { hoursPerWeek: 169 }, { portfolioUrl: 'javascript:alert(1)' }, { skills: Array(31).fill('skill') },
    { portfolioUrl: 'https://private:credential@example.com/work' },
  ])('rejects unsupported or unbounded profile values: %j', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: UpdateFreelancerProfileDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bounds and validates public directory pagination', async () => {
    await expect(pipe.transform({ limit: '25' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ cursor: 'private-owner' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ limit: '12', q: ' designer ' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).resolves.toMatchObject({ limit: 12, q: 'designer' });
  });

  it('requires explicit personal visibility and evidence in the shared byline rule', () => {
    const candidate = profile();
    expect(providerProfileReadiness(candidate)).toEqual({ ready: true, missingFields: [] });
    expect(isPublicProviderReady(candidate, { role: 'JOB_SEEKER', status: 'ACTIVE' })).toBe(true);
    expect(isPublicProviderReady({ ...candidate, publicPreviewEnabled: false }, { role: 'JOB_SEEKER', status: 'ACTIVE' })).toBe(false);
    expect(isPublicProviderReady(candidate, { role: 'FREELANCER', status: 'SUSPENDED' })).toBe(false);
    expect(isPublicProviderReady(candidate, { role: 'EMPLOYER', status: 'ACTIVE' })).toBe(false);
    expect(isPublicProviderReady({ ...candidate, portfolioUrl: null }, { role: 'JOB_SEEKER', status: 'ACTIVE' })).toBe(false);
  });
});
