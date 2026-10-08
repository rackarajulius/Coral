import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { createTestDatabase } from './support/database';

// Applies the delivered SQL to synthetic pre-Phase-2 records in an owned schema.
// No app configuration, deployed database, or historical migration reset is used.
describe('Phase 2 additive marketplace migration (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient;
  beforeAll(async () => { database = await createTestDatabase(); prisma = database.prisma; }, 240_000);
  afterAll(async () => { await database?.close(); });

  it('preserves legacy identities, hiring records and posts while defaulting old purposes safely', async () => {
    const provider = await prisma.user.create({ data: {
      supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: UserRole.JOB_SEEKER, status: UserStatus.ACTIVE,
    } });
    const employer = await prisma.user.create({ data: {
      supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: UserRole.EMPLOYER, status: UserStatus.ACTIVE,
    } });
    const profile = await prisma.freelancerProfile.create({ data: {
      userId: provider.id, providerEnabled: true, publicPreviewEnabled: false,
      headline: 'Existing private provider profile', skills: ['Figma'], expertise: [],
    } });
    const job = await prisma.job.create({ data: {
      postedById: employer.id, title: 'Existing Canadian role', slug: randomUUID(),
      description: 'Existing job and application data must survive.', employmentType: 'full-time',
      status: 'active', publishedAt: new Date(), skills: ['Figma'],
    } });
    const application = await prisma.application.create({ data: { jobId: job.id, applicantId: provider.id, status: 'pending' } });
    const post = await prisma.post.create({ data: { authorId: provider.id, content: 'An existing discussion', postType: 'TEXT', mediaUrls: [], hashtags: [] } });
    const oldUsers = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    const { purpose: _purpose, linkedServiceListingId: _service, linkedGigId: _gig, linkedJobId: _job, ...oldPost } = post;
    const migrationRoot = resolve(__dirname, '../prisma/migrations');
    const candidates = (await readdir(migrationRoot)).filter(name => name === '20261007140000_phase2_marketplace');
    expect(candidates).toHaveLength(1);
    const sql = await readFile(resolve(migrationRoot, candidates[0], 'migration.sql'), 'utf8');
    // The migration is additive DDL; reject procedural SQL needing a real parser.
    expect(sql).not.toMatch(/\$\$/);
    const statements = sql.split(';').map(statement => statement.trim()).filter(Boolean);
    expect(statements.length).toBeGreaterThan(5);

    await prisma.$transaction(async tx => {
      const [{ schema }] = await tx.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
      if (!/^coral_e2e_[a-f0-9]{32}$/.test(schema)) throw new Error('Refusing DDL outside generated owned test schema');
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      // Reconstruct the pre-Phase-2 fixture without later request foreign keys.
      // Only these empty newer tables in this generated schema are removed.
      for (const name of ['marketplace_deliveries', 'marketplace_messages', 'marketplace_request_reports', 'marketplace_requests', 'marketplace_blocks', 'marketplace_events']) {
        await tx.$executeRawUnsafe(`DROP TABLE "${schema}"."${name}"`);
      }
      await tx.$executeRawUnsafe(`ALTER TABLE "${schema}"."posts" DROP COLUMN "purpose", DROP COLUMN "linked_service_listing_id", DROP COLUMN "linked_gig_id", DROP COLUMN "linked_job_id"`);
      for (const name of ['marketplace_reports', 'service_listings', 'project_briefs']) {
        await tx.$executeRawUnsafe(`DROP TABLE "${schema}"."${name}"`);
      }
      await tx.$executeRawUnsafe(`DROP TYPE "${schema}"."PostPurpose"`);
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement.replaceAll('"public"', `"${schema}"`));
      }
    }, { timeout: 30_000 });

    expect(await prisma.user.findMany({ orderBy: { id: 'asc' } })).toEqual(oldUsers);
    expect(await prisma.freelancerProfile.findUniqueOrThrow({ where: { id: profile.id } })).toEqual(profile);
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toEqual(job);
    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toEqual(application);
    const migrated = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(migrated).toMatchObject({ ...oldPost, purpose: 'GENERAL', linkedServiceListingId: null, linkedGigId: null, linkedJobId: null });
    expect(await prisma.serviceListing.count()).toBe(0);
    expect(await prisma.projectBrief.count()).toBe(0);
    expect(await prisma.marketplaceReport.count()).toBe(0);
    const draft = await prisma.serviceListing.create({ data: { ownerUserId: provider.id } });
    expect(draft).toMatchObject({ status: 'draft', publicConsent: false, currency: 'CAD' });
    await expect(prisma.serviceListing.update({ where: { id: draft.id }, data: { amountMinor: -1 } })).rejects.toThrow();
    await expect(prisma.marketplaceReport.create({ data: { reporterId: employer.id, reason: 'spam' } })).rejects.toThrow();
    const brief = await prisma.projectBrief.create({ data: { ownerUserId: employer.id } });
    await expect(prisma.post.update({ where: { id: post.id }, data: { linkedServiceListingId: draft.id, linkedGigId: brief.id } })).rejects.toThrow();
    await prisma.user.delete({ where: { id: provider.id } });
    expect(await prisma.serviceListing.findUnique({ where: { id: draft.id } })).toBeNull();
  });
});
