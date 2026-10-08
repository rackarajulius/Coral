import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { CompanyRole, UserRole } from '@prisma/client';
import { createTestDatabase } from './support/database';
import { createHiringApp } from './support/hiring-app';

describe('AI scoring persistence and privacy (PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let server: Awaited<ReturnType<typeof createHiringApp>>;
  let employer: string;
  let outsider: string;
  const question = 'Describe a production incident you resolved.';
  const answer = 'I traced a deployment failure to a missing index, rolled back, added the index and restored latency to 90ms.';
  const evaluation = { overallScore: 80, recommendation: 'yes', summary: 'Concrete diagnosis and recovery.', strengths: ['Specific actions.'], concerns: [], perAnswer: [{ question, score: 80, note: 'Explains diagnosis and outcome.' }] };

  async function user(role: UserRole) {
    const id = randomUUID();
    return database.prisma.user.create({ data: { id, supabaseId: randomUUID(), email: `${id}@example.test`, role, status: 'ACTIVE' } });
  }
  async function request(method: string, path: string, actor: string, body?: unknown) {
    const response = await fetch(`${server.baseUrl}${path}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    return { status: response.status, body: await response.json() };
  }
  async function fixture(mode = 'text') {
    const candidate = await user(UserRole.JOB_SEEKER);
    const job = await database.prisma.job.create({ data: { postedById: employer, title: 'Engineer', slug: randomUUID(), description: 'Build APIs', employmentType: 'full-time', status: 'active' } });
    await database.prisma.application.create({ data: { jobId: job.id, applicantId: candidate.id, status: 'screening' } });
    const screen = await database.prisma.aiScreen.create({ data: { employerId: employer, candidateId: candidate.id, jobId: job.id, role: 'Engineer', mode, questions: [question] } });
    return { candidate: candidate.id, screen, job };
  }
  beforeAll(async () => {
    database = await createTestDatabase();
    employer = (await user(UserRole.EMPLOYER)).id;
    outsider = (await user(UserRole.EMPLOYER)).id;
    for (const userId of [employer, outsider]) {
      await database.prisma.company.create({ data: { name: 'AI fixtures', members: { create: { userId, role: CompanyRole.OWNER } } } });
    }
    server = await createHiringApp(database.prisma);
  }, 240_000);
  beforeEach(() => { jest.clearAllMocks(); server.delivery.aiComplete.mockReset().mockResolvedValue(evaluation); });
  afterAll(async () => { try { await server?.app.close(); } finally { await database?.close(); } });

  it('persists a valid score, ranks it on the employer board and keeps the scorecard private', async () => {
    const f = await fixture();
    const submitted = await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer], integrity: { pasteCount: 5, blurCount: 3 } });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.status).toBe('completed');
    for (const key of ['evaluation', 'overallScore', 'recommendation']) expect(submitted.body.data).not.toHaveProperty(key);
    const stored = await database.prisma.aiScreen.findUniqueOrThrow({ where: { id: f.screen.id } });
    expect(stored).toMatchObject({ overallScore: 80, recommendation: 'yes', evaluation });
    const employerView = await request('GET', `/employers/hiring/ai-screens/${f.screen.id}`, employer);
    expect(employerView.status).toBe(200);
    expect(employerView.body.data.evaluation).toEqual(evaluation);
    expect((await request('GET', `/employers/hiring/ai-screens/${f.screen.id}`, outsider)).status).toBe(404);
    const board = await request('GET', `/employers/hiring/jobs/${f.job.id}/screening-board`, employer);
    expect(board.body.data.summary.scored).toBe(1);
    expect(board.body.data.rows[0].screen.overallScore).toBe(80);
    expect(JSON.parse(server.delivery.aiComplete.mock.calls[0][2] as string)).not.toHaveProperty('integrity');
    expect((await database.prisma.application.findFirstOrThrow({ where: { jobId: f.job.id } })).status).toBe('screening');
    expect(server.delivery.webhook).toHaveBeenCalledTimes(1);
    expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer] })).status).toBe(400);
    expect(server.delivery.aiComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid model results unscored and retryable without completion side effects', async () => {
    const f = await fixture();
    const notificationsBefore = await database.prisma.notification.count({ where: { userId: employer } });
    server.delivery.aiComplete.mockResolvedValueOnce({ ...evaluation, overallScore: null });
    expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer] })).status).toBe(503);
    expect(await database.prisma.aiScreen.findUniqueOrThrow({ where: { id: f.screen.id } })).toMatchObject({ status: 'invited', overallScore: null, recommendation: null, completedAt: null });
    expect(server.delivery.webhook).not.toHaveBeenCalled();
    expect(await database.prisma.notification.count({ where: { userId: employer } })).toBe(notificationsBefore);
    expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer] })).status).toBe(201);
  });

  it('rejects empty, extra or missing answers and candidate impersonation before invoking AI', async () => {
    const f = await fixture();
    const other = await user(UserRole.JOB_SEEKER);
    for (const answers of [[], [' '], [answer, answer]]) {
      expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers })).status).toBe(400);
    }
    expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, other.id, { answers: [answer] })).status).toBe(404);
    expect(server.delivery.aiComplete).not.toHaveBeenCalled();
  });

  it('does not allow text submission to bypass live interview consent and transcript requirements', async () => {
    const f = await fixture('live');
    expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer] })).status).toBe(400);
    expect((await request('POST', `/ai-screens/${f.screen.id}/live/complete`, f.candidate)).status).toBe(400);
    expect(server.delivery.aiComplete).not.toHaveBeenCalled();
  });

  it('scores only the assigned live questions after consent and keeps completion idempotent', async () => {
    const f = await fixture('live');
    expect((await request('POST', `/ai-screens/${f.screen.id}/live/consent`, f.candidate)).status).toBe(201);
    expect((await request('POST', `/ai-screens/${f.screen.id}/live/start`, f.candidate)).status).toBe(201);
    expect((await request('POST', `/ai-screens/${f.screen.id}/live/complete`, f.candidate)).status).toBe(400);
    const session = await database.prisma.interviewCoachSession.findUniqueOrThrow({ where: { screenId: f.screen.id } });
    await database.prisma.interviewCoachSession.update({ where: { id: session.id }, data: { answers: [{ question: { text: 'Unassigned question' }, transcript: answer }] } });
    expect((await request('POST', `/ai-screens/${f.screen.id}/live/complete`, f.candidate)).status).toBe(400);
    expect(server.delivery.aiComplete).not.toHaveBeenCalled();
    await database.prisma.interviewCoachSession.update({ where: { id: session.id }, data: { answers: [{ question: { text: question }, transcript: answer }] } });
    for (let i = 0; i < 2; i++) {
      const result = await request('POST', `/ai-screens/${f.screen.id}/live/complete`, f.candidate);
      expect(result.status).toBe(201);
      expect(result.body.data.status).toBe('completed');
      expect(result.body.data).not.toHaveProperty('overallScore');
    }
    expect(server.delivery.aiComplete).toHaveBeenCalledTimes(1);
    expect(server.delivery.aiComplete.mock.calls[0][1]).toContain('automatic speech-to-text');
    expect(server.delivery.webhook).toHaveBeenCalledTimes(1);
  });

  it('commits only one result when two submissions score concurrently', async () => {
    const f = await fixture();
    const releases: ((value: unknown) => void)[] = [];
    let bothStarted!: () => void;
    const pending = new Promise<void>((resolve) => { bothStarted = resolve; });
    server.delivery.aiComplete.mockImplementation(() => new Promise((resolve) => {
      releases.push(resolve);
      if (releases.length === 2) bothStarted();
    }));
    const submissions = [0, 1].map(() => request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer] }));
    await pending;
    releases.forEach((release) => release(evaluation));
    expect((await Promise.all(submissions)).map((r) => r.status).sort()).toEqual([201, 400]);
    expect(server.delivery.webhook).toHaveBeenCalledTimes(1);
  });

  it('does not let an in-flight assessment reopen a declined screening', async () => {
    const f = await fixture();
    let started!: () => void;
    let release!: (value: unknown) => void;
    const pending = new Promise<void>((resolve) => { started = resolve; });
    server.delivery.aiComplete.mockImplementationOnce(() => { started(); return new Promise((resolve) => { release = resolve; }); });
    const submission = request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, { answers: [answer] });
    await pending;
    try { expect((await request('POST', `/ai-screens/${f.screen.id}/decline`, f.candidate)).status).toBe(201); }
    finally { release(evaluation); }
    expect((await submission).status).toBe(400);
    expect(await database.prisma.aiScreen.findUniqueOrThrow({ where: { id: f.screen.id } })).toMatchObject({ status: 'declined', overallScore: null });
    expect(server.delivery.webhook).not.toHaveBeenCalled();
  });

  it('keeps video submissions unscored for human review', async () => {
    const f = await fixture('video');
    await database.prisma.aiScreen.update({ where: { id: f.screen.id }, data: { answers: [{ question, videoPath: 'fixture.webm' }] } });
    expect((await request('POST', `/ai-screens/${f.screen.id}/submit`, f.candidate, {})).status).toBe(201);
    expect(await database.prisma.aiScreen.findUniqueOrThrow({ where: { id: f.screen.id } })).toMatchObject({ status: 'completed', overallScore: null, recommendation: null });
    expect(server.delivery.aiComplete).not.toHaveBeenCalled();
    expect(server.delivery.webhook).toHaveBeenCalledWith(employer, 'screening.completed', expect.objectContaining({ overallScore: null }));
  });
});
