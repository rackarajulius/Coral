// Checks the one-account backfill migration against a real database.
//
//   npm run verify:one-account-backfill
//
// Everything runs inside ONE transaction that is always rolled back: a few
// synthetic employer accounts are written, the migration's SQL runs twice, the
// results are checked, and nothing is kept.
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const MIGRATION = join(__dirname, '../prisma/migrations/20261027140000_one_account_backfill/migration.sql');

let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

const ids = {
  sole: '00000000-0000-4000-8000-00000000a001',
  waiting: '00000000-0000-4000-8000-00000000a002',
  placeholder: '00000000-0000-4000-8000-00000000a003',
  visible: '00000000-0000-4000-8000-00000000a004',
  elsewhere: '00000000-0000-4000-8000-00000000a0c0',
};

async function main() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const rows = async <T>(text: string, params: unknown[] = []) => (await db.query(text, params)).rows as T[];

  try {
    await db.query('BEGIN');

    const employer = async (id: string, tag: string, companyName?: string) => {
      await db.query(
        `INSERT INTO users (id, supabase_id, email, role, status, updated_at)
         VALUES ($1, $2, $3, 'EMPLOYER', 'ACTIVE', now())`,
        [id, `verify-${tag}`, `verify-${tag}@coral.test`],
      );
      if (companyName !== undefined) {
        await db.query(
          `INSERT INTO employer_profiles (id, user_id, company_name, job_title, company_benefits, company_locations, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, '', '{}', '{}', now())`,
          [id, companyName],
        );
      }
    };

    await employer(ids.sole, 'sole', '  Verify Ltd ');
    await employer(ids.waiting, 'waiting', 'Waiting Co');
    await db.query(`INSERT INTO companies (id, name, updated_at) VALUES ($1, 'Somewhere Else', now())`, [ids.elsewhere]);
    await db.query(
      `INSERT INTO company_members (id, company_id, user_id, role, status, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, 'RECRUITER', 'PENDING', now())`,
      [ids.elsewhere, ids.waiting],
    );
    await employer(ids.placeholder, 'placeholder', 'New Company');
    await employer(ids.visible, 'visible');
    await db.query(
      `INSERT INTO job_seeker_profiles (id, user_id, "jobTypes", skills, languages, discoverable, updated_at)
       VALUES (gen_random_uuid()::text, $1, '{}', '{}', '{}', true, now())`,
      [ids.visible],
    );

    await db.query(sql);
    const once = await rows<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM job_seeker_profiles) AS personal,
              (SELECT count(*)::int FROM companies) AS companies,
              (SELECT count(*)::int FROM company_members) AS members`,
    );
    await db.query(sql);
    const twice = await rows<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM job_seeker_profiles) AS personal,
              (SELECT count(*)::int FROM companies) AS companies,
              (SELECT count(*)::int FROM company_members) AS members`,
    );

    const state = async (id: string) =>
      (
        await rows<{
          discoverable: boolean | null; skills: string[] | null; company_id: string | null;
          company_name: string | null; seat_role: string | null; seat_status: string | null;
        }>(
          `SELECT p.discoverable, p.skills, ep.company_id, c.name AS company_name,
                  m.role::text AS seat_role, m.status::text AS seat_status
             FROM users u
             LEFT JOIN job_seeker_profiles p ON p.user_id = u.id
             LEFT JOIN employer_profiles ep ON ep.user_id = u.id
             LEFT JOIN companies c ON c.id = ep.company_id
             LEFT JOIN company_members m ON m.user_id = u.id AND m.company_id = ep.company_id
            WHERE u.id = $1`,
          [id],
        )
      )[0];

    const sole = await state(ids.sole);
    check('a sole operator gets a hidden personal profile', sole.discoverable === false && Array.isArray(sole.skills), sole);
    check('…and a real company under the name they gave, trimmed', sole.company_name === 'Verify Ltd', sole.company_name);
    check('…which they own, and their company page belongs to',
      sole.seat_role === 'OWNER' && sole.seat_status === 'ACTIVE' && !!sole.company_id, sole);

    const waiting = await state(ids.waiting);
    check('someone waiting for approval keeps waiting — no company of their own',
      waiting.company_id === null && waiting.discoverable === false, waiting);

    const placeholder = await state(ids.placeholder);
    check('the app\'s "New Company" placeholder is not made into a company',
      placeholder.company_id === null && placeholder.discoverable === false, placeholder);

    const visible = await state(ids.visible);
    check('an existing visible personal profile is left as it is', visible.discoverable === true, visible);

    check('running it again changes nothing', JSON.stringify(once[0]) === JSON.stringify(twice[0]), { once: once[0], twice: twice[0] });
  } finally {
    await db.query('ROLLBACK');
    const left = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE email LIKE 'verify-%@coral.test'`);
    check('rolled back: nothing synthetic left', left[0].n === 0, left[0].n);
    await db.end();
  }

  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
