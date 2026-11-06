import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FreelancersService } from '../../../src/freelancers/freelancers.service';
import { CitiesService } from '../../../src/locations/cities.service';
import { UpdateFreelancerProfileDto } from '../../../src/freelancers/dto/update-freelancer-profile.dto';
import { ProviderDirectoryQueryDto } from '../../../src/freelancers/dto/provider-directory-query.dto';
import { AppValidationPipe } from '../../../src/common/pipes/validation.pipe';
import { isPublicProviderReady, providerProfileReadiness } from '../../../src/freelancers/provider-profile-policy';
import { readPlaceFilter, readProviderPlace } from '../../../src/freelancers/provider-place';

// The real city list, loaded once for the file: place reading is the point.
const cities = new CitiesService();

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
    jobSeekerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    completedWork: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'provider' }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  return { prisma, service: new FreelancersService(prisma as unknown as PrismaService, cities) };
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
    // Self-declared and never measured: not read back, even for the owner.
    expect(result).not.toHaveProperty('statisticsProvenance');
    expect(prisma.freelancerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ completedProjects: expect.anything(), rating: expect.anything(), totalEarnings: expect.anything() }),
    }));
    expect(prisma.freelancerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        providerEnabled: false, publicPreviewEnabled: false, portfolioUrl: null, headline: null,
        // Every save re-reads where they're based from the city and country kept.
        placeCountryCode: 'CA', placeRegion: 'Ontario', placeCity: 'Toronto',
      },
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

  it('filters directory privacy in the database and advances bounded, numbered pages without recruiting searches', async () => {
    const { service, prisma } = harness();
    const second = { ...profile(), id: '10000000-0000-4000-8000-000000000002' };
    prisma.$queryRaw.mockResolvedValue([{ id: profile().id }, { id: second.id }]);
    prisma.freelancerProfile.findMany.mockResolvedValue([profile()]);
    const result = await service.listPublicProfiles({ category: 'design', q: 'designer', limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result).toMatchObject({ page: 1, nextPage: 2 });
    expect(prisma.freelancerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ category: 'design', providerEnabled: true, publicPreviewEnabled: true }),
      take: 1,
    }));
    expect(JSON.stringify(prisma.freelancerProfile.findMany.mock.calls[0][0].where)).not.toMatch(/email|resume|jobSeekerProfile/);
    await service.listPublicProfiles({ page: 2 });
    const lookup = prisma.$queryRaw.mock.calls[1][0];
    // limit + 1 to know there is more, then the offset for page 2.
    expect(lookup.values.slice(-2)).toEqual([13, 12]);
    expect(lookup.text).toContain("account.status = 'ACTIVE'");
    expect(lookup.text).toContain('profile.public_preview_enabled = true');
    expect(lookup.text).not.toMatch(/email|resume|job_seeker/);
    // The deepest page never offers a next page the bounds would refuse.
    await expect(service.listPublicProfiles({ q: 'designer', limit: 1, page: 24 })).resolves.toMatchObject({ page: 24, nextPage: null });
  });

  it('orders by an explainable rule: best match, then availability, then recently updated', async () => {
    const { service, prisma } = harness();
    prisma.$queryRaw.mockResolvedValue([]);
    await service.listPublicProfiles({ q: 'react' });
    const searched = prisma.$queryRaw.mock.calls[0][0].text;
    // The kind of match leads when searching...
    expect(searched).toMatch(/ORDER BY CASE[\s\S]*WHEN[\s\S]*THEN 0[\s\S]*THEN 1[\s\S]*ELSE 2/);
    expect(searched).toContain('lower(btrim(label)) = lower(');
    // ...then who can take work now, then who updated last, then a stable tie-break.
    expect(searched).toMatch(/CASE profile\.availability WHEN 'available' THEN 0 WHEN 'limited' THEN 1/);
    expect(searched).toMatch(/profile\.updated_at DESC, profile\.id ASC/);

    await service.listPublicProfiles({});
    const browsing = prisma.$queryRaw.mock.calls[1][0].text;
    expect(browsing).not.toContain('lower(btrim(label))');
    // Browsing starts the order at availability. A placeholder relevance of
    // `0` here is read by PostgreSQL as a column position and fails.
    expect(browsing).toMatch(/ORDER BY\s+CASE profile\.availability/);
  });

  it('keeps the directory order when the visibility recheck reads the page back', async () => {
    const { service, prisma } = harness();
    const second = { ...profile(), id: '10000000-0000-4000-8000-000000000002', userId: 'second-provider' };
    // The directory ranks the second profile first...
    prisma.$queryRaw.mockResolvedValue([{ id: second.id }, { id: profile().id }]);
    // ...and the recheck hands them back in the database's own order.
    prisma.freelancerProfile.findMany.mockResolvedValue([profile(), second]);
    const result = await service.listPublicProfiles({});
    expect(result.items.map((item: { userId: string }) => item.userId)).toEqual(['second-provider', profile().userId]);
    expect(prisma.freelancerProfile.findMany.mock.calls[0][0]).not.toHaveProperty('orderBy');
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
      await expect(service.listPublicProfiles({ q: search })).resolves.toEqual({ items: [], page: 1, nextPage: null });
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
    await expect(service.listPublicProfiles({ page: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listPublicProfiles({ page: 25 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listPublicProfiles({ location: 'x'.repeat(101) })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('Where a provider is based, and the directory location filter', () => {
  it.each([
    ['toronto', 'Canada', { placeCountryCode: 'CA', placeRegion: 'Ontario', placeCity: 'Toronto' }],
    // Accents set aside: what they typed finds how the list spells it.
    ['Montreal', 'Canada', { placeCountryCode: 'CA', placeRegion: 'Quebec', placeCity: 'Montréal' }],
    ['Toronto, ON', 'CA', { placeCountryCode: 'CA', placeRegion: 'Ontario', placeCity: 'Toronto' }],
    // A province in the city box is a province.
    ['Ontario', 'Canada', { placeCountryCode: 'CA', placeRegion: 'Ontario', placeCity: null }],
    [null, 'Canada', { placeCountryCode: 'CA', placeRegion: null, placeCity: null }],
    // A city only known elsewhere keeps the country they wrote, not another one.
    ['Kampala', 'Canada', { placeCountryCode: 'CA', placeRegion: null, placeCity: null }],
    ['Kampala', null, { placeCountryCode: 'UG', placeRegion: 'Central Region', placeCity: 'Kampala' }],
    ['Qwxzvq', 'Nowhere', { placeCountryCode: null, placeRegion: null, placeCity: null }],
  ])('reads %j in %j as %j', (city, country, expected) => {
    expect(readProviderPlace(cities, city, country)).toEqual(expected);
  });

  it.each([
    ['London', { kind: 'city', countryCode: 'CA', region: 'Ontario', city: 'London', label: 'London, Ontario, Canada' }],
    ['London, UK', { kind: 'city', countryCode: 'GB', city: 'London' }],
    ['Ontario', { kind: 'region', countryCode: 'CA', region: 'Ontario', label: 'Ontario, Canada' }],
    // Both a province and a city: the province, which holds the city too.
    ['Quebec', { kind: 'region', countryCode: 'CA', region: 'Quebec', label: 'Quebec, Canada' }],
    ['Québec, QC', { kind: 'city', countryCode: 'CA', region: 'Quebec', city: 'Québec' }],
    ['Canada', { kind: 'country', countryCode: 'CA', label: 'Canada' }],
  ])('reads a search for %j', (text, expected) => {
    expect(readPlaceFilter(cities, text, 'CA')).toMatchObject(expected);
  });

  it('matches a city on the place read at save, and says how the search was read', async () => {
    const { service, prisma } = harness();
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(service.listPublicProfiles({ location: 'Toronto, ON' })).resolves.toEqual({
      items: [], page: 1, nextPage: null, place: { kind: 'city', label: 'Toronto, Ontario, Canada' },
    });
    const lookup = prisma.$queryRaw.mock.calls[0][0];
    expect(lookup.text).toMatch(/profile\.place_country_code = \$\d+ AND profile\.place_city = \$\d+\s+AND profile\.place_region = \$\d+/);
    expect(lookup.values).toEqual(expect.arrayContaining(['CA', 'Toronto', 'Ontario']));
    // Never the words they wrote.
    expect(lookup.text).not.toMatch(/profile\.city|profile\.country/);
  });

  it('matches a province or a country without a city', async () => {
    const { service, prisma } = harness();
    prisma.$queryRaw.mockResolvedValue([]);
    await service.listPublicProfiles({ location: 'Ontario' });
    expect(prisma.$queryRaw.mock.calls[0][0].text).toMatch(/place_country_code = \$\d+ AND profile\.place_region = \$\d+/);
    expect(prisma.$queryRaw.mock.calls[0][0].text).not.toContain('place_city');
    await service.listPublicProfiles({ location: 'canada' });
    expect(prisma.$queryRaw.mock.calls[1][0].text).toContain('place_country_code');
    expect(prisma.$queryRaw.mock.calls[1][0].text).not.toMatch(/place_region|place_city/);
  });

  it('finds nobody for a place it does not know, and says so instead of ignoring it', async () => {
    const { service, prisma } = harness();
    await expect(service.listPublicProfiles({ location: 'Qwxzvq' })).resolves.toEqual({ items: [], page: 1, nextPage: null, place: null });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('filters to people open to remote work only when asked', async () => {
    const { service, prisma } = harness();
    prisma.$queryRaw.mockResolvedValue([]);
    await service.listPublicProfiles({ remote: 'true' });
    await service.listPublicProfiles({ remote: 'false' });
    await service.listPublicProfiles({});
    expect(prisma.$queryRaw.mock.calls[0][0].text).toContain('profile.available_for_remote = true');
    expect(prisma.$queryRaw.mock.calls[1][0].text).not.toContain('available_for_remote');
    expect(prisma.$queryRaw.mock.calls[2][0].text).not.toContain('available_for_remote');
    // No location asked, no `place` in the answer.
    await expect(service.listPublicProfiles({})).resolves.not.toHaveProperty('place');
  });

  it('reads the place on save, from what the save leaves, and tells the owner in words', async () => {
    const { service, prisma } = harness();
    // Only the city changes; the country already on the profile still counts.
    const saved = await service.updateMyProfile('provider', { city: ' montreal ' });
    expect(prisma.freelancerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ city: 'montreal', placeCountryCode: 'CA', placeRegion: 'Quebec', placeCity: 'Montréal' }),
    }));
    expect(saved.place).toEqual({ city: 'Montréal', region: 'Quebec', country: 'Canada' });
    expect(saved).not.toHaveProperty('placeCountryCode');

    // Clearing the city leaves the country.
    await service.updateMyProfile('provider', { city: null });
    expect(prisma.freelancerProfile.upsert.mock.calls[1][0].update).toMatchObject({ placeCountryCode: 'CA', placeRegion: null, placeCity: null });
  });

  it('reads a new profile as Canada until told otherwise', async () => {
    const { service, prisma } = harness();
    prisma.freelancerProfile.findUnique.mockResolvedValue(null);
    await service.updateMyProfile('provider', { providerEnabled: true });
    expect(prisma.freelancerProfile.upsert.mock.calls[0][0].create).toMatchObject({ country: 'Canada', placeCountryCode: 'CA' });
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
    { category: 'legal' }, { workPreferences: ['employment'] }, { availability: 'full-time' },
    { hoursPerWeek: 169 }, { portfolioUrl: 'javascript:alert(1)' }, { skills: Array(31).fill('skill') },
    { portfolioUrl: 'https://private:credential@example.com/work' },
  ])('rejects unsupported or unbounded profile values: %j', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: UpdateFreelancerProfileDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bounds and validates public directory pagination', async () => {
    await expect(pipe.transform({ limit: '25' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ page: '0' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ page: 'two' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ page: '2' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).resolves.toMatchObject({ page: 2 });
    await expect(pipe.transform({ limit: '12', q: ' designer ' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).resolves.toMatchObject({ limit: 12, q: 'designer' });
  });

  it('validates the location and remote filters', async () => {
    await expect(pipe.transform({ location: ' Toronto, ON ', remote: 'true' }, { type: 'query', metatype: ProviderDirectoryQueryDto }))
      .resolves.toMatchObject({ location: 'Toronto, ON', remote: 'true' });
    await expect(pipe.transform({ remote: 'yes' }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ location: 'x'.repeat(101) }, { type: 'query', metatype: ProviderDirectoryQueryDto })).rejects.toBeInstanceOf(BadRequestException);
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
