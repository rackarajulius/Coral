import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyMemberStatus, CompanyRole, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { PostsService } from '../src/community/posts/posts.service';
import { TidesService } from '../src/community/tides/tides.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { createTestDatabase } from './support/database';
import { createHiringApp } from './support/hiring-app';

// HTTP exercises real validation, guards, provider/application services and DB.
// Token verification and external delivery use the shared fixture boundary.
describe('Phase 1 provider profiles API (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;

  async function user(role: UserRole = UserRole.JOB_SEEKER, status: UserStatus = UserStatus.ACTIVE) {
    const id = randomUUID();
    return prisma.user.create({ data: {
      id, supabaseId: randomUUID(), email: `${id}@example.test`, role, status,
      displayName: 'Provider test professional', firstName: 'Provider', lastName: 'Fixture',
    } });
  }

  async function request(method: string, path: string, actor: string | null = null, body?: unknown, expected = 200) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json();
    expect({ status: response.status, ...(response.status === expected ? {} : { payload }) })
      .toEqual({ status: expected });
    return payload;
  }

  function completeProfile(label = 'Provider', category: 'design' | 'marketing' | 'software' = 'software') {
    return {
      providerEnabled: true, category, headline: `${label} professional`,
      summary: `${label} helps Canadian teams build clear, useful professional products.`,
      skills: ['TypeScript', 'Product strategy'],
      portfolioUrl: 'https://work.example.test/portfolio',
      workPreferences: ['project', 'consulting'], availability: 'available',
    };
  }

  async function publish(actor: string, label = 'Provider', category: 'design' | 'marketing' | 'software' = 'software') {
    return request('PATCH', '/freelancers/me/profile', actor, {
      ...completeProfile(label, category), publicPreviewEnabled: true,
    });
  }

  async function directory(q: string) {
    return (await request('GET', `/freelancers?q=${encodeURIComponent(q)}`)).data;
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    prisma = database.prisma;
    ({ app, baseUrl } = await createHiringApp(prisma));
  }, 240_000);

  afterAll(async () => {
    try { await app?.close(); }
    finally { await database?.close(); }
  });

  it('does not create or publish a provider profile when an eligible member visits setup', async () => {
    const actor = await user();
    expect((await request('GET', '/freelancers/me/profile', actor.id)).data).toBeNull();
    expect(await prisma.freelancerProfile.count({ where: { userId: actor.id } })).toBe(0);
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
  });

  it('lets a jobseeker offer services while retaining their role, recruiting profile and job applications', async () => {
    const actor = await user();
    const employer = await user(UserRole.EMPLOYER);
    const recruiting = await prisma.jobSeekerProfile.create({ data: {
      userId: actor.id, headline: 'Private recruiting headline', summary: 'Private recruiting summary',
      skills: ['TypeScript'], skillsNormalized: ['typescript'], jobTypes: ['full-time'], languages: ['English'],
      contactEmail: 'private-recruiting@example.test', phone: '+15555550100',
      resumePath: 'private-resumes/fixture.pdf', privacySettings: { profileVisible: false },
    } });
    const label = `dual-role-${randomUUID()}`;
    const setup = await publish(actor.id, label);
    expect(setup.data).toMatchObject({ providerEnabled: true, publicPreviewEnabled: true, currency: 'CAD', country: 'Canada', readiness: { ready: true } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).role).toBe(UserRole.JOB_SEEKER);
    expect(await prisma.jobSeekerProfile.findUniqueOrThrow({ where: { userId: actor.id } })).toEqual(recruiting);

    const job = await prisma.job.create({ data: {
      postedById: employer.id, title: 'Software professional', slug: randomUUID(),
      description: 'Build software with our Canadian team.', employmentType: 'full-time',
      status: 'active', publishedAt: new Date(), skills: ['TypeScript'],
    } });
    const application = await request('POST', '/applications', actor.id, { jobId: job.id }, 201);
    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.data.id } })).toMatchObject({
      jobId: job.id, applicantId: actor.id, status: 'pending',
    });
    expect((await request('GET', '/applications/me', actor.id)).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: application.data.id }),
    ]));
  });

  it('isolates personal profile writes and rejects a forged owner', async () => {
    const owner = await user();
    const stranger = await user();
    await publish(owner.id, `owner-${randomUUID()}`);
    expect((await request('GET', '/freelancers/me/profile', stranger.id)).data).toBeNull();
    await request('PATCH', '/freelancers/me/profile', stranger.id, {
      userId: owner.id, headline: 'Stolen profile',
    }, 400);
    await request('PATCH', `/freelancers/${owner.id}`, stranger.id, { headline: 'Stolen profile' }, 404);
    expect(await prisma.freelancerProfile.count({ where: { userId: stranger.id } })).toBe(0);
    expect((await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: owner.id } })).headline).not.toBe('Stolen profile');
  });

  it('rejects anonymous and invalid-token setup reads and writes', async () => {
    for (const actor of [null, randomUUID()]) {
      await request('GET', '/freelancers/me/profile', actor, undefined, 401);
      await request('PATCH', '/freelancers/me/profile', actor, { providerEnabled: true }, 401);
    }
  });

  it.each([UserRole.EMPLOYER, UserRole.ADMIN])('does not create a personal provider profile for %s', async (role) => {
    const actor = await user(role);
    await request('GET', '/freelancers/me/profile', actor.id, undefined, 403);
    await request('PATCH', '/freelancers/me/profile', actor.id, completeProfile(), 403);
    expect(await prisma.freelancerProfile.count({ where: { userId: actor.id } })).toBe(0);
  });

  it.each([
    { status: UserStatus.PENDING_ONBOARDING, expected: 403 },
    { status: UserStatus.INACTIVE, expected: 403 },
    { status: UserStatus.SUSPENDED, expected: 401 },
    { status: UserStatus.BANNED, expected: 401 },
  ])('requires an active personal account for setup ($status)', async ({ status, expected }) => {
    const actor = await user(UserRole.JOB_SEEKER, status);
    await request('GET', '/freelancers/me/profile', actor.id, undefined, expected);
    await request('PATCH', '/freelancers/me/profile', actor.id, completeProfile(), expected);
    expect(await prisma.freelancerProfile.count({ where: { userId: actor.id } })).toBe(0);
  });

  it('keeps incomplete and completed drafts hidden until explicit public consent', async () => {
    const actor = await user();
    const label = `consent-${randomUUID()}`;
    const draft = await request('PATCH', '/freelancers/me/profile', actor.id, { providerEnabled: true, headline: label });
    expect(draft.data).toMatchObject({ providerEnabled: true, publicPreviewEnabled: false, readiness: { ready: false } });
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
    expect((await directory(label)).items).toEqual([]);
    await request('PATCH', '/freelancers/me/profile', actor.id, { publicPreviewEnabled: true }, 400);
    expect((await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: actor.id } })).publicPreviewEnabled).toBe(false);

    const completed = await request('PATCH', '/freelancers/me/profile', actor.id, completeProfile(label));
    expect(completed.data).toMatchObject({ publicPreviewEnabled: false, readiness: { ready: true } });
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
    expect((await directory(label)).items).toEqual([]);
    await request('PATCH', '/freelancers/me/profile', actor.id, { publicPreviewEnabled: true });
    expect((await request('GET', `/freelancers/${actor.id}`)).data.userId).toBe(actor.id);
    expect((await directory(label)).items.map((profile: { userId: string }) => profile.userId)).toEqual([actor.id]);
  });

  it('publishes a contact-free projection without recruiting data or legacy achievement claims', async () => {
    const actor = await user();
    const label = `projection-${randomUUID()}`;
    await prisma.jobSeekerProfile.create({ data: {
      userId: actor.id, skills: ['Private skill'], skillsNormalized: ['private skill'], jobTypes: ['full-time'], languages: [],
      contactEmail: 'private-contact@example.test', phone: '+15555550101', resumePath: 'private-resume.pdf',
      salaryExpectation: 'Private compensation', parsedResume: { confidential: true }, privacySettings: { profileVisible: false },
    } });
    await publish(actor.id, label);
    await prisma.freelancerProfile.update({ where: { userId: actor.id }, data: {
      completedProjects: 99, rating: 4.9, totalEarnings: 100_000,
    } });
    const detail = (await request('GET', `/freelancers/${actor.id}`)).data;
    const card = (await directory(label)).items[0];
    for (const profile of [detail, card]) {
      expect(profile).toMatchObject({ userId: actor.id, headline: `${label} professional`, category: 'software' });
      expect(Object.keys(profile.user).sort()).toEqual(['avatarUrl', 'displayName', 'firstName', 'id', 'lastName']);
      for (const field of ['email', 'contactEmail', 'phone', 'resumeUrl', 'resumePath', 'parsedResume', 'salaryExpectation',
        'jobSeekerProfile', 'applications', 'completedProjects', 'rating', 'totalEarnings', 'statisticsProvenance',
        'providerEnabled', 'publicPreviewEnabled', 'role', 'status', 'supabaseId', 'verified']) {
        expect(profile).not.toHaveProperty(field);
        expect(profile.user).not.toHaveProperty(field);
      }
      expect(JSON.stringify(profile)).not.toContain('private-contact@example.test');
      expect(JSON.stringify(profile)).not.toContain('private-resume.pdf');
    }
    expect((await request('GET', '/freelancers/me/profile', actor.id)).data).toMatchObject({
      completedProjects: 99, rating: 4.9, totalEarnings: 100_000, statisticsProvenance: 'legacy_self_declared',
    });
  });

  it('requires provider capability before publishing and preserves a published profile on an incomplete edit', async () => {
    const actor = await user();
    const label = `publication-${randomUUID()}`;
    await request('PATCH', '/freelancers/me/profile', actor.id, {
      ...completeProfile(label), providerEnabled: false, publicPreviewEnabled: true,
    });
    // Disabling is dominant: even a simultaneous visibility flag cannot expose it.
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
    await request('PATCH', '/freelancers/me/profile', actor.id, { publicPreviewEnabled: true }, 400);
    await request('PATCH', '/freelancers/me/profile', actor.id, { providerEnabled: true, publicPreviewEnabled: true });
    const before = await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: actor.id } });
    await request('PATCH', '/freelancers/me/profile', actor.id, { summary: null }, 400);
    expect(await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: actor.id } })).toEqual(before);
    expect((await request('GET', `/freelancers/${actor.id}`)).data.summary).toBe(before.summary);
  });

  it.each([
    { label: 'completed project count', forged: { completedProjects: 100 } },
    { label: 'rating', forged: { rating: 5 } },
    { label: 'earnings', forged: { totalEarnings: 1_000_000 } },
    { label: 'account role', forged: { role: 'ADMIN' } },
  ])('rejects forged $label without changing the stored profile', async ({ forged }) => {
    const actor = await user();
    await publish(actor.id, `forgery-${randomUUID()}`);
    const before = await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: actor.id } });
    await request('PATCH', '/freelancers/me/profile', actor.id, forged, 400);
    expect(await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: actor.id } })).toEqual(before);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).role).toBe(UserRole.JOB_SEEKER);
  });

  it.each([
    { providerEnabled: 'false' }, { publicPreviewEnabled: 'true' }, { publicPreviewEnabled: null },
    { availableForRemote: 'false' },
  ])('rejects non-boolean capability/consent values: %j', async (invalid) => {
    const actor = await user();
    await request('PATCH', '/freelancers/me/profile', actor.id, invalid, 400);
    expect(await prisma.freelancerProfile.count({ where: { userId: actor.id } })).toBe(0);
  });

  it('revokes a public preview and clears it when services are disabled', async () => {
    const actor = await user();
    const label = `revocation-${randomUUID()}`;
    await publish(actor.id, label);
    await request('PATCH', '/freelancers/me/profile', actor.id, { publicPreviewEnabled: false });
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
    expect((await directory(label)).items).toEqual([]);
    expect((await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: actor.id } })).providerEnabled).toBe(true);
    await request('PATCH', '/freelancers/me/profile', actor.id, { publicPreviewEnabled: true });
    const disabled = await request('PATCH', '/freelancers/me/profile', actor.id, { providerEnabled: false, publicPreviewEnabled: true });
    expect(disabled.data).toMatchObject({ providerEnabled: false, publicPreviewEnabled: false });
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
    expect((await directory(label)).items).toEqual([]);
    await request('PATCH', '/freelancers/me/profile', actor.id, { providerEnabled: true });
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
  });

  it.each([UserStatus.PENDING_ONBOARDING, UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED])(
    'removes a published provider from direct reads and discovery after status changes to %s', async (status) => {
      const actor = await user();
      const label = `status-${randomUUID()}`;
      await publish(actor.id, label);
      await prisma.user.update({ where: { id: actor.id }, data: { status } });
      await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
      expect((await directory(label)).items).toEqual([]);
    },
  );

  it('keeps legacy freelancer setup available and requires new publication consent', async () => {
    const actor = await user(UserRole.FREELANCER);
    await prisma.freelancerProfile.create({ data: {
      userId: actor.id, headline: 'Legacy freelancer', summary: 'An established professional who has historical profile data.',
      skills: ['Design'], expertise: [], portfolioUrl: 'https://work.example.test/legacy', completedProjects: 7, rating: 4.5,
    } });
    const legacy = (await request('GET', '/freelancers/me/profile', actor.id)).data;
    expect(legacy).toMatchObject({ providerEnabled: false, publicPreviewEnabled: false, completedProjects: 7, statisticsProvenance: 'legacy_self_declared' });
    await request('GET', `/freelancers/${actor.id}`, null, undefined, 404);
    await publish(actor.id, `legacy-${randomUUID()}`, 'design');
    expect((await request('GET', `/freelancers/${actor.id}`)).data.category).toBe('design');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).role).toBe(UserRole.FREELANCER);
  });

  it('filters categories and paginates visible providers without duplicates or hidden profiles', async () => {
    const label = `pagination-${randomUUID()}`;
    const profileIds = [
      '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000005',
    ];
    for (let index = 0; index < profileIds.length; index++) {
      const actor = await user();
      await prisma.freelancerProfile.create({ data: {
        id: profileIds[index], userId: actor.id, ...completeProfile(`${label} ${index}`, index === 3 ? 'marketing' : 'design'),
        expertise: [], publicPreviewEnabled: index !== 4,
      } });
    }
    const query = `/freelancers?category=design&q=${encodeURIComponent(label)}&limit=2`;
    const first = (await request('GET', query)).data;
    expect(first.items.map((profile: { id: string }) => profile.id)).toEqual(profileIds.slice(0, 2));
    expect(first.nextCursor).toBe(profileIds[1]);
    const second = (await request('GET', `${query}&cursor=${first.nextCursor}`)).data;
    expect(second.items.map((profile: { id: string }) => profile.id)).toEqual([profileIds[2]]);
    expect(second.nextCursor).toBeNull();
    const marketing = (await request('GET', `/freelancers?category=marketing&q=${encodeURIComponent(label)}`)).data;
    expect(marketing.items.map((profile: { id: string }) => profile.id)).toEqual([profileIds[3]]);
    await request('GET', '/freelancers?category=unapproved', null, undefined, 400);
    await request('GET', '/freelancers?cursor=invalid', null, undefined, 400);
    await request('GET', '/freelancers?limit=25', null, undefined, 400);
  });

  it('finds partial skill labels regardless of case while excluding hidden matches', async () => {
    const marker = `skill-${randomUUID()}-`;
    const originalSkill = `${marker}React Native`;
    const visible = await user();
    const hidden = await user();
    await request('PATCH', '/freelancers/me/profile', visible.id, {
      ...completeProfile('Visible craft'), publicPreviewEnabled: true, skills: [originalSkill],
    });
    await request('PATCH', '/freelancers/me/profile', hidden.id, {
      ...completeProfile('Hidden craft'), skills: [originalSkill],
    });
    const results = await directory(`${marker.toUpperCase()}rEaCt`);
    expect(results.items.map((profile: { userId: string }) => profile.userId)).toEqual([visible.id]);
    expect(results.items[0].skills).toEqual([originalSkill]);
  });

  it.each(['%', '_', '\\'])('searches for literal %s in skill labels without expanding the results', async (symbol) => {
    const marker = `literal-${randomUUID()}-`;
    const target = await user();
    const distractor = await user();
    await request('PATCH', '/freelancers/me/profile', target.id, {
      ...completeProfile('Literal craft'), publicPreviewEnabled: true, skills: [`${marker}${symbol}Work`],
    });
    await request('PATCH', '/freelancers/me/profile', distractor.id, {
      ...completeProfile('Other craft'), publicPreviewEnabled: true, skills: [`${marker}XWork`],
    });
    const results = await directory(`${marker}${symbol}`);
    expect(results.items.map((profile: { userId: string }) => profile.userId)).toEqual([target.id]);
  });

  it('treats quotes and SQL-shaped search text as a literal term', async () => {
    const actor = await user();
    const search = "' OR 1=1 --";
    await request('PATCH', '/freelancers/me/profile', actor.id, {
      ...completeProfile('Quoted craft'), publicPreviewEnabled: true, skills: [`Special ${search} skill`],
    });
    const results = await directory(search);
    expect(results.items.map((profile: { userId: string }) => profile.userId)).toEqual([actor.id]);
    await request('GET', `/freelancers?q=${'x'.repeat(101)}`, null, undefined, 400);
  });

  it('uses current real company membership for post and Tide maintenance after an author leaves', async () => {
    // Service/database checks complement HTTP provider tests; this fixture does
    // not claim company routes or streaming boundaries were exercised over HTTP.
    const author = await user(UserRole.EMPLOYER);
    const owner = await user(UserRole.EMPLOYER);
    const otherOwner = await user(UserRole.EMPLOYER);
    const company = await prisma.company.create({ data: {
      name: 'Phase 1 company authority fixture', members: { create: [
        { userId: author.id, role: CompanyRole.ADMIN }, { userId: owner.id, role: CompanyRole.OWNER },
      ] },
    } });
    await prisma.company.create({ data: {
      name: 'Unrelated authority fixture', members: { create: { userId: otherOwner.id, role: CompanyRole.OWNER } },
    } });
    const post = await prisma.post.create({ data: { authorId: author.id, companyId: company.id, content: 'Company announcement' } });
    const tide = await prisma.tide.create({ data: {
      hostId: author.id, companyId: company.id, title: 'Company Tide',
      startsAt: new Date(Date.now() + 86_400_000), timezone: 'America/Toronto',
    } });
    const asDependency = <T>(value: unknown): T => value as T;
    const context = new CompanyContextService(asDependency(prisma));
    const posts = new PostsService(
      asDependency(prisma), asDependency({}), asDependency({ resolve: jest.fn().mockResolvedValue(new Map()) }), asDependency({}),
      asDependency({}), asDependency({}), context, asDependency({}),
    );
    const tides = new TidesService(asDependency(prisma), context, asDependency({}), new ConfigService());
    await posts.update(post.id, author, { content: 'Allowed while active' });
    await tides.update(tide.id, author.id, { title: 'Allowed while active' });
    for (const status of [CompanyMemberStatus.REMOVED, CompanyMemberStatus.SUSPENDED, CompanyMemberStatus.PENDING]) {
      await prisma.companyMember.update({ where: { companyId_userId: { companyId: company.id, userId: author.id } }, data: { status } });
      await expect(posts.update(post.id, author, { content: 'Unauthorized' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(posts.delete(post.id, author)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(tides.update(tide.id, author.id, { title: 'Unauthorized' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(tides.cancel(tide.id, author.id, {})).rejects.toBeInstanceOf(ForbiddenException);
      expect((await posts.getById(post.id, author)).canEdit).toBe(false);
    }
    await expect(posts.delete(post.id, otherOwner)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(tides.cancel(tide.id, otherOwner.id, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect((await posts.getById(post.id, owner)).canEdit).toBe(true);
    await posts.update(post.id, owner, { content: 'Maintained by the current owner' });
    await tides.update(tide.id, owner.id, { title: 'Maintained by the current owner' });
    expect(await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({ authorId: author.id, companyId: company.id });
    expect(await prisma.tide.findUniqueOrThrow({ where: { id: tide.id } })).toMatchObject({ hostId: author.id, companyId: company.id });
    await tides.cancel(tide.id, owner.id, { reason: 'Owner canceled' });
    expect((await prisma.tide.findUniqueOrThrow({ where: { id: tide.id } })).canceledAt).not.toBeNull();
    await posts.delete(post.id, owner);
    expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();
  });
});
