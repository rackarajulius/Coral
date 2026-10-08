import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FreelancerProfile, PrismaClient, UserRole } from '@prisma/client';
import { createTestDatabase } from './support/database';

function legacyFields(profile: FreelancerProfile) {
  const { providerEnabled: _enabled, publicPreviewEnabled: _preview, category: _category,
    workPreferences: _preferences, ...legacy } = profile;
  return legacy;
}

// This rehearsal owns a disposable schema. It does not run migration deploy or
// edit an application/staging database, and does not claim all old migrations pass.
describe('Phase 1 additive provider migration (isolated PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    database = await createTestDatabase();
    prisma = database.prisma;
  }, 240_000);

  afterAll(async () => { if (database) await database.close(); });

  it('backfills legacy freelancer capability without public consent or changes to hiring/history', async () => {
    async function user(role: UserRole) {
      const id = randomUUID();
      return prisma.user.create({ data: {
        id, supabaseId: randomUUID(), email: `${id}@example.test`, role, status: 'ACTIVE',
      } });
    }
    const freelancer = await user(UserRole.FREELANCER);
    const jobseeker = await user(UserRole.JOB_SEEKER);
    const employer = await user(UserRole.EMPLOYER);
    const noProfileFreelancer = await user(UserRole.FREELANCER);
    const oldFreelancerProfile = await prisma.freelancerProfile.create({ data: {
      userId: freelancer.id, headline: 'Legacy design professional',
      summary: 'Existing career information survives the provider capability migration.',
      title: 'Designer', skills: ['Design'], expertise: ['Branding'], hourlyRate: '85', currency: 'CAD',
      country: 'Canada', city: 'Toronto', timezone: 'America/Toronto',
      portfolioUrl: 'https://work.example.test/legacy-design',
      completedProjects: 42, rating: 4.7, totalEarnings: 15_000, availability: 'full-time',
    } });
    const oldSeekerProvider = await prisma.freelancerProfile.create({ data: {
      userId: jobseeker.id, headline: 'Existing jobseeker profile record',
      skills: ['TypeScript'], expertise: [], completedProjects: 3, totalEarnings: 500, rating: 3.8,
    } });
    const recruitingProfile = await prisma.jobSeekerProfile.create({ data: {
      userId: jobseeker.id, headline: 'Existing private recruiting profile',
      skills: ['TypeScript'], skillsNormalized: ['typescript'], jobTypes: ['full-time'], languages: ['English'],
      contactEmail: 'private-recruiting@example.test', resumePath: 'private-resume/legacy.pdf',
      privacySettings: { profileVisible: false },
    } });
    const job = await prisma.job.create({ data: {
      postedById: employer.id, title: 'Existing software job', slug: randomUUID(),
      description: 'Hiring data must remain unchanged.', employmentType: 'full-time', status: 'active',
      publishedAt: new Date(), skills: ['TypeScript'], applicationsCount: 1,
    } });
    const application = await prisma.application.create({ data: {
      jobId: job.id, applicantId: jobseeker.id, status: 'reviewing',
      coverLetter: 'Existing private application', resumePath: 'private-resume/application.pdf',
    } });
    const beforeUsers = await prisma.user.findMany({ orderBy: { id: 'asc' } });

    const migrationPath = resolve(__dirname, '../prisma/migrations/20261007120000_provider_profiles/migration.sql');
    const migrationSql = await readFile(migrationPath, 'utf8');
    // The reviewed additive migration has three statements with no semicolons
    // in string literals. Fail for review if that execution contract changes.
    const statements = migrationSql.split(';').map((statement) => statement.trim()).filter(Boolean);
    expect(statements).toHaveLength(3);

    await prisma.$transaction(async (tx) => {
      const [{ schema }] = await tx.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
      if (!/^coral_e2e_[a-f0-9]{32}$/.test(schema)) {
        throw new Error('Refusing migration rehearsal outside the generated owned test schema');
      }
      // All DDL targets are fully qualified or transaction-local to the schema
      // verified above. No caller-supplied identifier reaches these statements.
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`DROP INDEX "${schema}"."freelancer_provider_public_category_id_idx"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "${schema}"."freelancer_profiles"
        DROP COLUMN "provider_enabled", DROP COLUMN "public_preview_enabled",
        DROP COLUMN "category", DROP COLUMN "work_preferences"`);
      const columns = await tx.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = 'freelancer_profiles'
          AND column_name IN ('provider_enabled', 'public_preview_enabled', 'category', 'work_preferences')`;
      expect(columns).toEqual([]);
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const [{ count }] = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM pg_indexes
        WHERE schemaname = ${schema} AND indexname = 'freelancer_provider_public_category_id_idx'`;
      expect(Number(count)).toBe(1);
    }, { timeout: 30_000 });

    const afterFreelancer = await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: freelancer.id } });
    const afterSeeker = await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: jobseeker.id } });
    expect(afterFreelancer).toMatchObject({ providerEnabled: true, publicPreviewEnabled: false, category: null, workPreferences: [] });
    expect(afterSeeker).toMatchObject({ providerEnabled: false, publicPreviewEnabled: false, category: null, workPreferences: [] });
    expect(legacyFields(afterFreelancer)).toEqual(legacyFields(oldFreelancerProfile));
    expect(legacyFields(afterSeeker)).toEqual(legacyFields(oldSeekerProvider));
    expect(await prisma.user.findMany({ orderBy: { id: 'asc' } })).toEqual(beforeUsers);
    expect(await prisma.freelancerProfile.count()).toBe(2);
    expect(await prisma.freelancerProfile.findUnique({ where: { userId: noProfileFreelancer.id } })).toBeNull();
    expect(await prisma.jobSeekerProfile.findUniqueOrThrow({ where: { id: recruitingProfile.id } })).toEqual(recruitingProfile);
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toEqual(job);
    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toEqual(application);

    // Migration defaults remain conservative for future rows, even when the
    // future user is a legacy account role. Backfill never becomes auto-consent.
    const futureProfile = await prisma.freelancerProfile.create({ data: {
      userId: noProfileFreelancer.id, skills: [], expertise: [],
    } });
    expect(futureProfile).toMatchObject({ providerEnabled: false, publicPreviewEnabled: false, category: null, workPreferences: [] });
  });
});
