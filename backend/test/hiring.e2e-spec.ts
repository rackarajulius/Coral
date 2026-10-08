import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { INestApplication } from '@nestjs/common';
import { CompanyRole, OfferStatus, PipelineStage, PrismaClient, UserRole } from '@prisma/client';
import { createTestDatabase } from './support/database';
import { createHiringApp } from './support/hiring-app';

describe('Hiring API journey (PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let owner: string;
  let recruiter: string;
  let viewer: string;
  let interviewer: string;
  let outsider: string;
  let removed: string;

  async function user(role: UserRole = UserRole.JOB_SEEKER) {
    const id = randomUUID();
    return prisma.user.create({ data: {
      id, supabaseId: randomUUID(), email: `${id}@example.test`,
      role, status: 'ACTIVE', displayName: 'Hiring test user',
    } });
  }

  async function request(method: string, path: string, actor: string | null, body?: unknown, expected = 200) {
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

  async function eventually(check: () => Promise<void>) {
    const deadline = Date.now() + 10_000;
    while (true) {
      try { await check(); return; }
      catch (error) { if (Date.now() >= deadline) throw error; }
      await delay(30);
    }
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    prisma = database.prisma;
    const actors = await Promise.all(Array.from({ length: 6 }, () => user(UserRole.EMPLOYER)));
    [owner, recruiter, viewer, interviewer, outsider, removed] = actors.map((actor) => actor.id);
    await prisma.company.create({ data: {
      name: 'Hiring journey fixtures',
      members: { create: [
        { userId: owner, role: CompanyRole.OWNER },
        { userId: recruiter, role: CompanyRole.RECRUITER },
        { userId: viewer, role: CompanyRole.VIEWER },
        { userId: interviewer, role: CompanyRole.INTERVIEWER },
        { userId: removed, role: CompanyRole.RECRUITER, status: 'REMOVED' },
      ] },
    } });
    await prisma.company.create({ data: {
      name: 'Unrelated company', members: { create: { userId: outsider, role: CompanyRole.OWNER } },
    } });
    ({ app, baseUrl } = await createHiringApp(prisma));
  }, 240_000);

  afterAll(async () => {
    try { await app?.close(); }
    finally { await database?.close(); }
  });

  async function fixture(status = 'active') {
    const candidate = await user();
    const job = await prisma.job.create({ data: {
      postedById: owner, title: 'Backend Engineer', slug: randomUUID(),
      description: 'Build APIs', employmentType: 'full-time', status,
      publishedAt: status === 'active' ? new Date() : null, skills: ['TypeScript'],
    } });
    const shortlist = await prisma.shortlist.create({ data: {
      employerId: recruiter, name: 'Engineering search',
      items: { create: { candidateId: candidate.id, stage: 'CONTACTED', snapshot: {} } },
    }, include: { items: true } });
    return { candidate: candidate.id, jobId: job.id, cardId: shortlist.items[0].id };
  }

  async function apply(f: Awaited<ReturnType<typeof fixture>>) {
    const result = await request('POST', '/applications', f.candidate, { jobId: f.jobId }, 201);
    await eventually(async () => {
      const card = await prisma.shortlistItem.findUniqueOrThrow({ where: { id: f.cardId } });
      expect(card).toMatchObject({ applicationId: result.data.id, stage: PipelineStage.APPLIED });
    });
    return result.data.id as string;
  }

  async function draft(applicationId: string) {
    const response = await request('POST', `/employers/ats/applications/${applicationId}/offer`, recruiter, {
      salaryAmount: 8_500_000, salaryCurrency: 'cad', salaryPeriod: 'yearly',
      message: 'We would like you to join us.', internalNotes: 'Private compensation discussion',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }, 201);
    return response.data.id as string;
  }

  async function expectStage(applicationId: string, cardId: string, status: string, stage: PipelineStage) {
    const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    const card = await prisma.shortlistItem.findUniqueOrThrow({ where: { id: cardId } });
    expect(application.status).toBe(status);
    expect(card.stage).toBe(stage);
  }

  it('links a sourced candidate, progresses the application, sends an offer and records acceptance on both boards', async () => {
    const f = await fixture();
    const applicationId = await apply(f);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: f.jobId } })).applicationsCount).toBe(1);

    // Another company member can work the application; both views follow the same person.
    for (const [status, stage] of [['reviewing', PipelineStage.SCREENING], ['interviewing', PipelineStage.INTERVIEW]] as const) {
      await request('PATCH', `/applications/${applicationId}/pipeline`, recruiter, { status });
      await eventually(() => expectStage(applicationId, f.cardId, status, stage));
    }
    const firstResponse = (await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).firstRespondedAt;
    expect(firstResponse).not.toBeNull();
    const offerId = await draft(applicationId);
    expect((await request('GET', '/offers/me', f.candidate)).data).toEqual([]);
    await request('POST', `/offers/${offerId}/accept`, f.candidate, undefined, 400);

    await request('POST', `/employers/ats/offers/${offerId}/send`, recruiter, undefined, 201);
    await expectStage(applicationId, f.cardId, 'offered', PipelineStage.OFFER);
    const candidateOffer = (await request('GET', '/offers/me', f.candidate)).data[0];
    expect(candidateOffer).toMatchObject({ id: offerId, status: 'SENT', salaryAmount: 8_500_000 });
    expect(candidateOffer).not.toHaveProperty('internalNotes');
    expect(candidateOffer).not.toHaveProperty('signalsAtSend');
    expect(await prisma.notification.count({ where: { userId: f.candidate, title: 'You have an offer' } })).toBe(1);

    await request('POST', `/offers/${offerId}/accept`, f.candidate, undefined, 201);
    await expectStage(applicationId, f.cardId, 'hired', PipelineStage.HIRED);
    const stored = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(stored.firstRespondedAt).toEqual(firstResponse);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe(OfferStatus.ACCEPTED);
    const board = await request('GET', '/applications/pipeline-board', recruiter);
    expect(board.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ id: applicationId, stage: 'Hired' })]));
    expect(board.candidates.some((row: { id: string }) => row.id === `sourced:${f.cardId}`)).toBe(false);
    const tracker = await request('GET', '/applications/me', f.candidate);
    expect(tracker.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: applicationId, status: 'hired' })]));
    await request('PATCH', `/applications/${applicationId}/pipeline`, recruiter, { status: 'reviewing' }, 400);
    await request('POST', `/offers/${offerId}/decline`, f.candidate, undefined, 400);
  });

  it('refuses duplicate applications without incrementing the job count', async () => {
    const f = await fixture();
    await apply(f);
    await request('POST', '/applications', f.candidate, { jobId: f.jobId }, 400);
    expect(await prisma.application.count({ where: { jobId: f.jobId } })).toBe(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: f.jobId } })).applicationsCount).toBe(1);
  });

  it('rejects anonymous, wrong-role, malformed and closed-job applications without writing', async () => {
    const f = await fixture('draft');
    await request('POST', '/applications', null, { jobId: f.jobId }, 401);
    await request('POST', '/applications', recruiter, { jobId: f.jobId }, 403);
    await request('POST', '/applications', f.candidate, { jobId: 'not-a-uuid' }, 400);
    await request('POST', '/applications', f.candidate, { jobId: f.jobId, status: 'hired' }, 400);
    await request('POST', '/applications', f.candidate, { jobId: f.jobId }, 400);
    expect(await prisma.application.count({ where: { jobId: f.jobId } })).toBe(0);
  });

  it('isolates applications and offers by company, candidate and seat permissions', async () => {
    const f = await fixture();
    const otherCandidate = await user();
    const applicationId = await apply(f);
    const offerId = await draft(applicationId);
    await request('GET', `/applications/${applicationId}`, recruiter);
    await request('GET', `/applications/${applicationId}`, outsider, undefined, 403);
    await request('GET', `/applications/${applicationId}`, otherCandidate.id, undefined, 403);
    await request('PATCH', `/applications/${applicationId}/pipeline`, outsider, { status: 'rejected' }, 403);
    await request('GET', `/employers/ats/applications/${applicationId}/offer`, outsider, undefined, 404);
    await request('POST', `/employers/ats/offers/${offerId}/send`, outsider, undefined, 404);
    for (const actor of [viewer, interviewer, removed]) {
      await request('PATCH', `/applications/${applicationId}/pipeline`, actor, { status: 'rejected' }, 403);
      await request('POST', `/employers/ats/offers/${offerId}/send`, actor, undefined, 403);
    }
    await request('POST', `/employers/ats/offers/${offerId}/send`, recruiter, undefined, 201);
    expect((await request('GET', '/offers/me', otherCandidate.id)).data).toEqual([]);
    expect((await request('GET', '/employers/ats/offers', outsider)).data).toEqual([]);
    await request('POST', `/offers/${offerId}/accept`, otherCandidate.id, undefined, 403);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe('SENT');
  });

  it('records a declined offer consistently on the application and sourcing card', async () => {
    const f = await fixture();
    const applicationId = await apply(f);
    const offerId = await draft(applicationId);
    await request('POST', `/employers/ats/offers/${offerId}/send`, owner, undefined, 201);
    await request('POST', `/offers/${offerId}/decline`, f.candidate, undefined, 201);
    await expectStage(applicationId, f.cardId, 'rejected', PipelineStage.REJECTED);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe('DECLINED');
  });

  it('refuses expired and withdrawn offers without hiring the candidate', async () => {
    const f = await fixture();
    const applicationId = await apply(f);
    const offerId = await draft(applicationId);
    await request('POST', `/employers/ats/offers/${offerId}/send`, owner, undefined, 201);
    await prisma.offer.update({ where: { id: offerId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request('POST', `/offers/${offerId}/accept`, f.candidate, undefined, 400);
    await request('POST', `/employers/ats/offers/${offerId}/withdraw`, owner, undefined, 201);
    await request('POST', `/offers/${offerId}/accept`, f.candidate, undefined, 400);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).status).not.toBe('hired');
  });

  it('cannot send an offer for a withdrawn application and leaves the draft unchanged', async () => {
    const f = await fixture();
    const applicationId = await apply(f);
    const offerId = await draft(applicationId);
    await request('POST', `/applications/${applicationId}/withdraw`, f.candidate, undefined, 201);
    await request('POST', `/employers/ats/offers/${offerId}/send`, recruiter, undefined, 400);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe('DRAFT');
    expect(await prisma.notification.count({ where: { userId: f.candidate, title: 'You have an offer' } })).toBe(0);
  });

  it('cannot accept an offer after the application has been withdrawn', async () => {
    const f = await fixture();
    const applicationId = await apply(f);
    const offerId = await draft(applicationId);
    await request('POST', `/employers/ats/offers/${offerId}/send`, recruiter, undefined, 201);
    await request('POST', `/applications/${applicationId}/withdraw`, f.candidate, undefined, 201);
    await request('POST', `/offers/${offerId}/accept`, f.candidate, undefined, 400);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe('SENT');
    expect((await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).status).toBe('withdrawn');
  });

  it('allows only one of two simultaneous, conflicting offer responses to commit', async () => {
    const f = await fixture();
    const applicationId = await apply(f);
    const offerId = await draft(applicationId);
    await request('POST', `/employers/ats/offers/${offerId}/send`, recruiter, undefined, 201);
    const responses = await Promise.all(['accept', 'decline'].map((action) => fetch(`${baseUrl}/offers/${offerId}/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${f.candidate}` }, signal: AbortSignal.timeout(20_000),
    })));
    // Consume bodies so keep-alive sockets can be closed cleanly during teardown.
    await Promise.all(responses.map((response) => response.text()));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
    const accepted = offer.status === OfferStatus.ACCEPTED;
    expect([OfferStatus.ACCEPTED, OfferStatus.DECLINED]).toContain(offer.status);
    await expectStage(applicationId, f.cardId, accepted ? 'hired' : 'rejected', accepted ? PipelineStage.HIRED : PipelineStage.REJECTED);
  });
});
