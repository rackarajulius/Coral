import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const run = promisify(execFile);

/** Each suite owns a fresh schema. Never loads the application's .env. */
export async function createTestDatabase() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database. See test/README.md.');
  }
  const schema = `coral_e2e_${randomUUID().replace(/-/g, '')}`;
  const admin = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 30_000 });
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${schema}`,
    max: 4,
    connectionTimeoutMillis: 30_000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
  let created = false;

  async function close() {
    await prisma.$disconnect();
    await pool.end();
    try {
      // The identifier is generated here, never accepted from configuration.
      if (created && /^coral_e2e_[a-f0-9]{32}$/.test(schema)) {
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      }
    } finally {
      await admin.end();
    }
  }

  try {
    const backend = resolve(__dirname, '../..');
    const cli = resolve(dirname(require.resolve('prisma/package.json')), 'build/index.js');
    const { stdout } = await run(process.execPath, [
      cli, 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
      '--config', 'test/prisma.config.ts',
    ], { cwd: backend, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 }).catch((error) => {
      throw new Error(`Could not generate the test schema: ${error.stderr?.trim() || (error.killed ? 'Prisma CLI timed out' : error.message)}`);
    });

    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    // Prisma can emit both qualified and unqualified DDL. Isolate both forms.
    const sql = stdout.replaceAll('"public"', `"${schema}"`);
    const ddl = await admin.connect();
    try {
      await ddl.query('BEGIN');
      await ddl.query(`SET LOCAL search_path TO "${schema}"`);
      await ddl.query(sql);
      await ddl.query('COMMIT');
    } catch (error) {
      await ddl.query('ROLLBACK');
      throw error;
    } finally {
      ddl.release();
    }
    const scope = await pool.query('SELECT current_schema() AS schema');
    if (scope.rows[0]?.schema !== schema) {
      throw new Error('Test database connection did not preserve the isolated search_path. Use a session connection.');
    }
    await prisma.$connect();
    return { prisma, close };
  } catch (error) {
    await close();
    throw error;
  }
}
