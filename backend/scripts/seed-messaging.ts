/**
 * Dev seed for the messaging flow (and the ATS Candidates board).
 *
 * Creates, for a REAL employer you can log in as:
 *   - a candidate (see below),
 *   - a published Job posted by the employer,
 *   - an Application from the candidate to that job (this satisfies the messaging
 *     consent gate), and
 *   - a Conversation seeded with a few messages.
 *
 * The candidate is either:
 *   - a REAL existing job-seeker account (pass CANDIDATE_EMAIL) — so you can log in
 *     on both sides and test the full two-way loop, or
 *   - a synthetic "Dev Candidate" (default) — DB-only, cannot log in (enough to
 *     test the employer side: send + notify).
 *
 * Usage (from backend/):
 *   npm run seed:messaging                                    # first EMPLOYER + Dev Candidate
 *   EMPLOYER_EMAIL=boss@x.com npm run seed:messaging
 *   EMPLOYER_EMAIL=boss@x.com CANDIDATE_EMAIL=seeker@x.com npm run seed:messaging  # both real
 *
 * A real CANDIDATE_EMAIL must already exist (sign up as that job seeker first —
 * the seed never creates a log-in-able account). Idempotent — safe to re-run.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const SYNTHETIC_CANDIDATE_EMAIL = 'dev.candidate@coral.test';
const CANDIDATE_EMAIL = process.env.CANDIDATE_EMAIL; // if set, must be a REAL existing account
const EMPLOYER_EMAIL = process.env.EMPLOYER_EMAIL;

async function run() {
  // 1. Resolve the employer (must be a real, log-in-able account).
  const employer = EMPLOYER_EMAIL
    ? await prisma.user.findUnique({ where: { email: EMPLOYER_EMAIL } })
    : await prisma.user.findFirst({ where: { role: 'EMPLOYER' }, orderBy: { createdAt: 'desc' } });

  if (!employer) {
    console.error(
      '\n✗ No employer user found.\n' +
        '  Sign up / log in as an EMPLOYER first, then re-run with:\n' +
        '  EMPLOYER_EMAIL=you@example.com npm run seed:messaging\n',
    );
    process.exit(1);
  }
  if (employer.role !== 'EMPLOYER' && employer.role !== 'ADMIN') {
    console.error(`\n✗ ${employer.email} is ${employer.role}, not an EMPLOYER. Pass EMPLOYER_EMAIL of an employer.\n`);
    process.exit(1);
  }

  // 2. Ensure the employer has a profile (company name shows in the UI).
  const employerProfile = await prisma.employerProfile.upsert({
    where: { userId: employer.id },
    update: {},
    create: {
      userId: employer.id,
      companyName: 'Northwind Labs',
      jobTitle: 'Hiring Manager',
      companyBenefits: [],
      companyLocations: [],
    },
  });

  // 3. Candidate: a REAL existing account (CANDIDATE_EMAIL) or the synthetic DB-only one.
  let candidate;
  let candidateIsReal = false;
  if (CANDIDATE_EMAIL) {
    candidate = await prisma.user.findUnique({ where: { email: CANDIDATE_EMAIL } });
    if (!candidate) {
      console.error(
        `\n✗ CANDIDATE_EMAIL ${CANDIDATE_EMAIL} not found.\n` +
          "  Real accounts can't be created by the seed — sign up / log in as that job seeker first,\n" +
          '  or omit CANDIDATE_EMAIL to use the DB-only Dev Candidate.\n',
      );
      process.exit(1);
    }
    candidateIsReal = true;
    if (candidate.role !== 'JOB_SEEKER') {
      console.warn(`  ! ${candidate.email} is ${candidate.role}; they can still open the thread at /jobseeker/chat.`);
    }
  } else {
    candidate = await prisma.user.upsert({
      where: { email: SYNTHETIC_CANDIDATE_EMAIL },
      update: {},
      create: {
        supabaseId: 'dev-seed-candidate',
        email: SYNTHETIC_CANDIDATE_EMAIL,
        firstName: 'Dev',
        lastName: 'Candidate',
        displayName: 'Dev Candidate',
        emailVerified: true,
        role: 'JOB_SEEKER',
        status: 'ACTIVE',
      },
    });
  }

  if (candidate.id === employer.id) {
    console.error('\n✗ Candidate and employer are the same account — use a different CANDIDATE_EMAIL.\n');
    process.exit(1);
  }

  // Ensure a job-seeker profile (never overwrites a real candidate's existing profile).
  await prisma.jobSeekerProfile.upsert({
    where: { userId: candidate.id },
    update: {},
    create: {
      userId: candidate.id,
      headline: 'Senior Frontend Engineer',
      currentTitle: 'Senior Frontend Engineer',
      city: 'Toronto',
      skills: ['React', 'TypeScript', 'Node.js'],
      openToWork: true,
    },
  });

  // 4. A published job posted by the employer.
  const job = await prisma.job.upsert({
    where: { slug: 'dev-seed-frontend-role' },
    update: { postedById: employer.id },
    create: {
      postedById: employer.id,
      title: 'Senior Frontend Engineer',
      slug: 'dev-seed-frontend-role',
      description: 'Dev-seed role used to test messaging and the candidates board.',
      employmentType: 'full-time',
      location: 'Toronto, ON',
      status: 'published',
      companyName: employerProfile.companyName,
      skills: ['React', 'TypeScript'],
    },
  });

  // 5. The application (satisfies the messaging consent gate).
  await prisma.application.upsert({
    where: { jobId_applicantId: { jobId: job.id, applicantId: candidate.id } },
    update: {},
    create: { jobId: job.id, applicantId: candidate.id, status: 'pending' },
  });

  // 6. A conversation seeded with a few messages (only if empty).
  const convo = await prisma.conversation.upsert({
    where: { employerId_candidateId: { employerId: employer.id, candidateId: candidate.id } },
    update: {},
    create: { employerId: employer.id, candidateId: candidate.id, jobId: job.id },
  });

  const existing = await prisma.message.count({ where: { conversationId: convo.id } });
  if (existing === 0) {
    const now = Date.now();
    await prisma.message.createMany({
      data: [
        {
          conversationId: convo.id,
          senderId: candidate.id,
          body: "Hi! I applied for the Senior Frontend Engineer role — really excited about the team.",
          createdAt: new Date(now - 3_600_000),
        },
        {
          conversationId: convo.id,
          senderId: employer.id,
          body: 'Thanks for applying! Your background looks strong. Do you have time for a quick chat this week?',
          createdAt: new Date(now - 1_800_000),
        },
        {
          conversationId: convo.id,
          senderId: candidate.id,
          body: 'Absolutely — Thursday afternoon works well for me.',
          createdAt: new Date(now - 600_000),
        },
      ],
    });
    // Candidate spoke last → the employer sees it as unread.
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { lastMessageAt: new Date(now - 600_000), candidateLastReadAt: new Date(now - 600_000) },
    });
  }

  const candidateName = candidate.displayName || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.email;
  console.log('\n✓ Messaging dev-seed complete.\n');
  console.log(`  Employer : ${employer.email} (${employerProfile.companyName})`);
  console.log(`  Candidate: ${candidateName} <${candidate.email}> (${candidateIsReal ? 'REAL — can log in' : 'DB-only, cannot log in'})`);
  console.log(`  Job      : ${job.title}`);
  console.log(`  Thread   : conversation ${convo.id} (${existing === 0 ? 'seeded 3 messages' : 'already had messages'})\n`);
  console.log('  Test it:');
  console.log('    • Employer: log in, then /employers/chat (open the thread) or /employers/candidates → Message.');
  if (candidateIsReal) {
    console.log(`    • Candidate: log in as ${candidate.email}, then /jobseeker/chat → reply, attach a file, watch it appear live.\n`);
  } else {
    console.log('    • Candidate is DB-only — pass CANDIDATE_EMAIL of a real job seeker to test both sides.\n');
  }

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error('Messaging dev-seed failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
