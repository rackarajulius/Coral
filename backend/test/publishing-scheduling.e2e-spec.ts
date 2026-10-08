import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { CompanyRole, UserRole } from '@prisma/client';
import { createTestDatabase } from './support/database';
import { createHiringApp } from './support/hiring-app';

describe('Job publishing and interview scheduling (PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let server: Awaited<ReturnType<typeof createHiringApp>>;
  let owner: string;
  let teammate: string;
  let viewer: string;
  let outsider: string;
  let candidate: string;
  let otherCandidate: string;
  const future = (days = 2) => new Date(Date.now() + days * 86_400_000).toISOString();
  const icsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  async function request(method: string, path: string, actor: string | null, body?: unknown) {
    const response = await fetch(`${server.baseUrl}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
  }
  async function ok(method: string, path: string, actor: string | null, body?: unknown) {
    const result = await request(method, path, actor, body);
    expect(result.status < 300 ? result.status : result).toBe(method === 'POST' ? 201 : 200);
    return result.body;
  }
  async function invite(slots = [future()]) {
    return (await ok('POST', '/employers/hiring/interviews', owner, { candidateId: candidate, role: 'Engineer', proposedSlots: slots })).data;
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    const users = await Promise.all([UserRole.EMPLOYER, UserRole.EMPLOYER, UserRole.EMPLOYER, UserRole.EMPLOYER, UserRole.JOB_SEEKER, UserRole.JOB_SEEKER].map((role) => {
      const id = randomUUID();
      return database.prisma.user.create({ data: { id, supabaseId: randomUUID(), email: `${id}@example.test`, role, status: 'ACTIVE' } });
    }));
    [owner, teammate, viewer, outsider, candidate, otherCandidate] = users.map((u) => u.id);
    await database.prisma.company.create({ data: { name: 'Scheduling company', members: { create: [
      { userId: owner, role: CompanyRole.OWNER }, { userId: teammate, role: CompanyRole.RECRUITER }, { userId: viewer, role: CompanyRole.VIEWER },
    ] } } });
    await database.prisma.company.create({ data: { name: 'Other company', members: { create: { userId: outsider, role: CompanyRole.OWNER } } } });
    await Promise.all([owner, teammate, outsider].map((userId) => database.prisma.employerProfile.create({ data: {
      userId, companyName: 'Scheduling company', jobTitle: 'Recruiter', verificationStatus: 'verified', companyBenefits: [],
    } })));
    await database.prisma.googleCredential.create({ data: { userId: owner, refreshToken: 'test-only' } });
    server = await createHiringApp(database.prisma);
  }, 240_000);
  afterAll(async () => { try { await server?.app.close(); } finally { await database?.close(); } });
  beforeEach(() => { jest.clearAllMocks(); });

  it('publishes a draft, accepts applications, then removes paused jobs from public access', async () => {
    const job = (await ok('POST', '/jobs', owner, { title: 'Publishing engineer', description: 'Build APIs', employmentType: 'full-time' })).data;
    expect(job.status).toBe('draft');
    expect((await request('PATCH', `/jobs/${job.id}`, owner, { status: 'closed' })).status).toBe(400);
    expect((await request('GET', `/jobs/${job.id}`, null)).status).toBe(404);
    await ok('PATCH', `/jobs/${job.id}/status`, teammate, { status: 'active' });
    const published = await database.prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(published.publishedAt).not.toBeNull();
    expect((await ok('GET', `/jobs/${job.id}`, null)).data.id).toBe(job.id);
    await ok('POST', `/jobs/${job.id}/apply`, candidate, {});
    await ok('PATCH', `/jobs/${job.id}`, owner, { status: 'paused' });
    expect((await request('GET', `/jobs/${job.id}`, null)).status).toBe(404);
    expect((await request('POST', `/jobs/${job.id}/apply`, otherCandidate, {})).status).toBe(400);
    await ok('PATCH', `/jobs/${job.id}`, owner, { status: 'active' });
    expect((await database.prisma.job.findUniqueOrThrow({ where: { id: job.id } })).publishedAt).toEqual(published.publishedAt);
  });

  it('enforces verification, role, seat and company isolation on publishing endpoints', async () => {
    const job = (await ok('POST', '/jobs', owner, { title: 'Restricted draft', description: 'Build APIs', employmentType: 'full-time' })).data;
    for (const path of [`/jobs/${job.id}`, `/jobs/${job.id}/status`]) {
      for (const actor of [candidate, viewer, outsider]) {
        expect((await request('PATCH', path, actor, { status: 'active' })).status).toBe(403);
      }
    }
    await database.prisma.employerProfile.update({ where: { userId: owner }, data: { verificationStatus: 'unverified' } });
    try {
      for (const path of [`/jobs/${job.id}`, `/jobs/${job.id}/status`]) {
        expect((await request('PATCH', path, owner, { status: 'active' })).status).toBe(403);
      }
      expect((await request('POST', `/jobs/${job.id}/duplicate`, owner, { status: 'active' })).status).toBe(403);
      expect((await request('POST', '/jobs', owner, { title: 'Unverified post', description: 'Build APIs', employmentType: 'full-time', status: 'active' })).status).toBe(403);
      expect((await database.prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('draft');
    } finally {
      await database.prisma.employerProfile.update({ where: { userId: owner }, data: { verificationStatus: 'verified' } });
    }
  });

  it('confirms the selected invitation time, delivers a calendar attachment and cancels with the organizer credentials', async () => {
    const slots = [future(3), future(4)];
    const interview = await invite(slots);
    expect((await request('GET', `/interviews/${interview.id}/calendar.ics`, candidate)).status).toBe(400);
    expect((await request('POST', `/interviews/${interview.id}/respond`, otherCandidate, { action: 'accept' })).status).toBe(404);
    const confirmed = (await ok('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept', slot: slots[1] })).data;
    expect(confirmed).toMatchObject({ status: 'confirmed', scheduledAt: slots[1], calendarProvider: 'google', calendarEventId: 'google-event' });
    expect(server.delivery.googleCreate).toHaveBeenCalledWith(owner, expect.objectContaining({ startISO: slots[1], durationMinutes: 30, attendees: expect.arrayContaining([`${candidate}@example.test`, `${owner}@example.test`]) }));
    expect(server.delivery.email).toHaveBeenCalledWith(expect.objectContaining({ to: `${candidate}@example.test`, attachments: expect.any(Array) }));
    const ics = await ok('GET', `/interviews/${interview.id}/calendar.ics`, candidate);
    expect(ics).toContain(`DTSTART:${icsDate(slots[1])}`);
    expect(ics).toContain('https://meet.example.test/interview');
    expect((await request('GET', `/interviews/${interview.id}/calendar.ics`, otherCandidate)).status).toBe(403);
    expect((await request('POST', `/employers/hiring/interviews/${interview.id}/cancel`, outsider)).status).toBe(404);
    await ok('POST', `/employers/hiring/interviews/${interview.id}/cancel`, teammate);
    expect(server.delivery.googleDelete).toHaveBeenCalledWith(owner, 'google-event');
    expect((await ok('GET', `/interviews/${interview.id}/room`, candidate)).data.canJoin).toBe(false);
  });

  it('rejects invalid/past invitation times and an unoffered response without changing the invitation', async () => {
    for (const proposedSlots of [[future(), 'invalid'], [new Date(0).toISOString()]]) {
      expect((await request('POST', '/employers/hiring/interviews', owner, { candidateId: candidate, proposedSlots })).status).toBe(400);
    }
    expect((await request('POST', '/employers/hiring/interviews', viewer, { candidateId: candidate, proposedSlots: [future()] })).status).toBe(403);
    const interview = await invite();
    expect((await request('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept', slot: future(9) })).status).toBe(400);
    expect((await database.prisma.interview.findUniqueOrThrow({ where: { id: interview.id } })).status).toBe('proposed');
    await database.prisma.interview.update({ where: { id: interview.id }, data: { proposedSlots: [new Date(0).toISOString()] } });
    expect((await request('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept' })).status).toBe(400);
    expect(server.delivery.googleCreate).not.toHaveBeenCalled();
  });

  it('allows only one conflicting response to commit', async () => {
    const interview = await invite();
    const results = await Promise.all(['accept', 'decline'].map((action) => request('POST', `/interviews/${interview.id}/respond`, candidate, { action })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const stored = await database.prisma.interview.findUniqueOrThrow({ where: { id: interview.id } });
    expect(server.delivery.googleCreate).toHaveBeenCalledTimes(stored.status === 'confirmed' ? 1 : 0);
    expect(await database.prisma.notification.count({ where: { userId: owner, title: { contains: 'your interview invitation' } } })).toBeGreaterThan(0);
  });

  it('books one candidate atomically, carries duration into calendar/ICS and closes cancelled availability', async () => {
    const start = future(6);
    const published = await ok('POST', '/employers/availability', owner, { slots: [start], durationMins: 60, role: 'Engineer' });
    const slot = published.data.slots.find((s: { startAt: string }) => s.startAt === start);
    expect((await ok('GET', `/booking/${owner}`, candidate)).data.slots).toEqual(expect.arrayContaining([expect.objectContaining({ id: slot.id, durationMins: 60 })]));
    const before = await database.prisma.interview.count();
    const results = await Promise.all([candidate, otherCandidate].map((actor) => request('POST', `/booking/slots/${slot.id}`, actor)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect([400, 404]).toContain(results.find((r) => r.status !== 201)!.status);
    expect(await database.prisma.interview.count()).toBe(before + 1);
    const booked = results.find((r) => r.status === 201)!.body.data;
    expect(booked.status).toBe('confirmed');
    expect(server.delivery.googleCreate).toHaveBeenCalledTimes(1);
    expect(server.delivery.googleCreate).toHaveBeenCalledWith(owner, expect.objectContaining({ startISO: start, durationMinutes: 60 }));
    const ics = await ok('GET', `/interviews/${booked.id}/calendar.ics`, booked.candidateId);
    expect(ics).toContain(`DTEND:${icsDate(new Date(new Date(start).getTime() + 3_600_000).toISOString())}`);
    expect((await request('DELETE', `/employers/availability/${slot.id}`, owner)).status).toBe(400);
    await ok('POST', `/employers/hiring/interviews/${booked.id}/cancel`, owner);
    expect((await database.prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe('cancelled');
    expect((await ok('GET', `/booking/${owner}`, candidate)).data.slots.some((s: { id: string }) => s.id === slot.id)).toBe(false);
  });

  it('keeps a confirmed booking and Zoom link when calendar delivery fails', async () => {
    server.delivery.googleCreate.mockRejectedValueOnce(new Error('Provider unavailable'));
    server.delivery.zoomCreate.mockResolvedValueOnce({ meetingId: 'zoom-meeting', joinUrl: 'https://zoom.example.test/interview' });
    const interview = await invite();
    const confirmed = (await ok('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept' })).data;
    expect(confirmed).toMatchObject({ status: 'confirmed', meetingLink: 'https://zoom.example.test/interview', zoomMeetingId: 'zoom-meeting', calendarEventId: null });
    await ok('POST', `/employers/hiring/interviews/${interview.id}/cancel`, teammate);
    expect(server.delivery.zoomDelete).toHaveBeenCalledWith(owner, 'zoom-meeting');
  });

  it('uses Microsoft when connected and deletes from the original provider after a connection switch', async () => {
    await database.prisma.microsoftCredential.create({ data: { userId: teammate, refreshToken: 'test-only' } });
    const interview = (await ok('POST', '/employers/hiring/interviews', teammate, { candidateId: candidate, proposedSlots: [future()] })).data;
    const confirmed = (await ok('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept' })).data;
    expect(confirmed.calendarProvider).toBe('microsoft');
    expect(server.delivery.microsoftCreate).toHaveBeenCalledTimes(1);
    await database.prisma.googleCredential.create({ data: { userId: teammate, refreshToken: 'test-only' } });
    await ok('POST', `/employers/hiring/interviews/${interview.id}/cancel`, owner);
    expect(server.delivery.microsoftDelete).toHaveBeenCalledWith(teammate, 'microsoft-event');
    expect(server.delivery.googleDelete).not.toHaveBeenCalled();
  });

  it('confirms without a connected calendar and preserves manually supplied meeting links', async () => {
    for (const meetingLink of [undefined, 'https://video.example.test/manual']) {
      const interview = (await ok('POST', '/employers/hiring/interviews', outsider, { candidateId: candidate, proposedSlots: [future()], meetingLink })).data;
      const confirmed = (await ok('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept' })).data;
      expect(confirmed).toMatchObject({ status: 'confirmed', calendarEventId: null, meetingLink: meetingLink ?? null });
      expect(await ok('GET', `/interviews/${interview.id}/calendar.ics`, candidate)).toContain(meetingLink ?? `/interview/${interview.id}/room`);
    }
    expect(server.delivery.googleCreate).not.toHaveBeenCalled();
    expect(server.delivery.microsoftCreate).not.toHaveBeenCalled();
  });

  it('cleans up a calendar event returned after the interview was cancelled', async () => {
    let release!: (event: { eventId: string; meetLink: string }) => void;
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => { started = resolve; });
    server.delivery.googleCreate.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => { release = resolve; });
    });
    const interview = await invite();
    const acceptance = request('POST', `/interviews/${interview.id}/respond`, candidate, { action: 'accept' });
    await providerStarted;
    try {
      await ok('POST', `/employers/hiring/interviews/${interview.id}/cancel`, teammate);
    } finally {
      release({ eventId: 'late-event', meetLink: 'https://meet.example.test/late' });
    }
    expect((await acceptance).body.data.status).toBe('cancelled');
    expect(server.delivery.googleDelete).toHaveBeenCalledWith(owner, 'late-event');
    expect((await database.prisma.interview.findUniqueOrThrow({ where: { id: interview.id } })).calendarEventId).toBeNull();
    expect(server.delivery.email.mock.calls.some(([input]) => input.attachments)).toBe(false);
  });
});
