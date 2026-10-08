import { createHash, X509Certificate } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadStagingConfig, validateStagingConfig } from './check-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const qualified = (name) => `public.${quote(name)}`;
const fail = (code) => { const error = new Error('Staging database preparation refused.'); error.auditCode = code; throw error; };

export function validateTarget(arguments_, validation, backend) {
  if (!validation.ok || backend.CORAL_STAGING !== 'true') fail('STAGING_CONFIGURATION_INVALID');
  const confirmation = arguments_['project-ref'];
  if (arguments_.apply && !confirmation) fail('PROJECT_REF_CONFIRMATION_REQUIRED');
  if (confirmation && (!/^[a-z0-9]{20}$/.test(confirmation) || confirmation !== validation.metadata.projectRef)) fail('PROJECT_REF_MISMATCH');
  if (backend.MARKETPLACE_LISTING_WRITES_ENABLED !== 'false' || backend.MARKETPLACE_ENQUIRIES_ENABLED !== 'false') fail('MARKETPLACE_FLAGS_MUST_BE_OFF');
}

async function loadExpected() {
  const schema = await readFile(resolve(ROOT, 'backend/prisma/schema.prisma'), 'utf8');
  const tables = [...schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)].map((model) => model[1].match(/@@map\("([^"]+)"\)/)?.[1]);
  if (!tables.length || tables.some((table) => !table) || new Set(tables).size !== tables.length || tables.includes('_prisma_migrations')) fail('APPLICATION_SCHEMA_INVALID');
  const migrationRoot = resolve(ROOT, 'backend/prisma/migrations');
  const directories = (await readdir(migrationRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!directories.length) fail('MIGRATIONS_MISSING');
  const migrations = new Map();
  for (const name of directories) {
    const source = await readFile(resolve(migrationRoot, name, 'migration.sql'));
    migrations.set(name, createHash('sha256').update(source).digest('hex'));
  }
  return { tables: [...tables, '_prisma_migrations'].sort(), migrations };
}

async function loadCa(connection) {
  const certificatePath = connection.searchParams.get('sslrootcert');
  if (!certificatePath || !isAbsolute(certificatePath)) fail('ABSOLUTE_SSLROOTCERT_REQUIRED');
  let pem;
  try { pem = await readFile(certificatePath, 'utf8'); } catch { fail('SUPABASE_CA_UNREADABLE'); }
  const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!certificates?.length || pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) fail('SUPABASE_CA_INVALID_PEM');
  try {
    for (const pemCertificate of certificates) {
      const certificate = new X509Certificate(pemCertificate);
      const start = Date.parse(certificate.validFrom), end = Date.parse(certificate.validTo);
      if (!certificate.ca || !Number.isFinite(start) || !Number.isFinite(end) || Date.now() < start || Date.now() > end) fail('SUPABASE_CA_INVALID_OR_EXPIRED');
    }
  } catch (error) { fail(error.auditCode ?? 'SUPABASE_CA_INVALID_PEM'); }
  return pem;
}

const INVENTORY_SQL = `SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S') ORDER BY c.relname`;

function validateInventory(rows, expected) {
  const tables = rows.filter((row) => row.relkind !== 'S');
  if (tables.length !== expected.tables.length || tables.some((row) => !['r', 'p'].includes(row.relkind) || !expected.tables.includes(row.relname))) fail('PUBLIC_SCHEMA_DOES_NOT_MATCH_APPLICATION');
  if (rows.some((row) => row.owner !== 'postgres')) fail('PUBLIC_OBJECT_NOT_OWNED_BY_POSTGRES');
  return rows.filter((row) => row.relkind === 'S');
}

async function verifyPrivileges(client, tablePrivileges) {
  const tables = await client.query(`SELECT count(*)::int AS remaining
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN pg_roles r CROSS JOIN unnest($1::text[]) AS p(privilege)
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND r.rolname IN ('anon', 'authenticated') AND has_table_privilege(r.oid, c.oid, p.privilege)`, [tablePrivileges]);
  const columns = await client.query(`SELECT count(*)::int AS remaining
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN pg_roles r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) AS p(privilege)
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND r.rolname IN ('anon', 'authenticated') AND has_any_column_privilege(r.oid, c.oid, p.privilege)`);
  const sequences = await client.query(`SELECT count(*)::int AS remaining
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN pg_roles r CROSS JOIN unnest(ARRAY['SELECT','UPDATE','USAGE']) AS p(privilege)
    WHERE n.nspname = 'public' AND c.relkind = 'S'
      AND r.rolname IN ('anon', 'authenticated') AND has_sequence_privilege(r.oid, c.oid, p.privilege)`);
  if ([tables, columns, sequences].some((result) => result.rows[0].remaining !== 0)) fail('API_ROLE_EFFECTIVE_PRIVILEGES_REMAIN');
  const defaults = await client.query(`SELECT count(*)::int AS remaining
    FROM pg_default_acl d JOIN pg_roles owner ON owner.oid = d.defaclrole
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE owner.rolname = 'postgres' AND d.defaclobjtype IN ('r', 'S')
      AND (d.defaclnamespace = 0 OR n.nspname = 'public')
      AND CASE WHEN a.grantee = 0 THEN true ELSE EXISTS (
        SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated')
          AND pg_has_role(r.oid, a.grantee, 'USAGE')) END`);
  if (defaults.rows[0].remaining !== 0) fail('POSTGRES_FUTURE_DATA_PRIVILEGES_REMAIN');
}

export async function main(argv = process.argv.slice(2)) {
  let client, inTransaction = false, stage = 'arguments', connectionError;
  try {
    const { values } = parseArgs({ args: argv, options: { apply: { type: 'boolean' }, 'project-ref': { type: 'string' } }, strict: true, allowPositionals: false });
    stage = 'configuration';
    const config = loadStagingConfig({ rootDir: ROOT }), validation = validateStagingConfig(config);
    validateTarget(values, validation, config.backendEnv);
    const projectRef = validation.metadata.projectRef;
    stage = 'repository';
    const expected = await loadExpected();
    if (!values.apply) {
      console.log(JSON.stringify({ state: 'plan', projectRef, databaseConnectionAttempted: false,
        expectedPublicTables: expected.tables.length, expectedMigrations: expected.migrations.size,
        steps: ['Verify exact migrated public schema and postgres ownership.',
          'Revoke anon, authenticated and PUBLIC table, column and sequence privileges in public.',
          'Revoke postgres future public table and sequence defaults for those grantees.',
          'Verify effective privileges are zero before committing.'],
        applyCommand: `npm run staging:secure-db -- --apply --project-ref ${projectRef}` }));
      return 0;
    }
    stage = 'tls_certificate';
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('TLS_VERIFICATION_DISABLED_IN_ENVIRONMENT');
    const connection = new URL(config.backendEnv.DIRECT_URL), ca = await loadCa(connection);
    const { Client } = createRequire(resolve(ROOT, 'backend/package.json'))('pg');
    // Parse properties explicitly so URL SSL options cannot replace verified TLS.
    client = new Client({ host: connection.hostname, port: Number(connection.port || '5432'),
      user: decodeURIComponent(connection.username), password: decodeURIComponent(connection.password),
      database: decodeURIComponent(connection.pathname.slice(1)),
      ssl: { ca, rejectUnauthorized: true, servername: connection.hostname },
      connectionTimeoutMillis: 15000, query_timeout: 15000, application_name: 'coral-staging-public-privileges' });
    client.on('error', (error) => { connectionError = /^[A-Z0-9_]{1,40}$/.test(error?.code ?? '') ? error.code : 'DATABASE_CONNECTION_ERROR'; });
    stage = 'connection';
    await client.connect();
    await client.query('BEGIN'); inTransaction = true;
    await client.query("SET LOCAL statement_timeout = '10s'");
    stage = 'preconditions';
    const identity = (await client.query("SELECT current_user AS role, current_setting('server_version_num')::int AS version")).rows[0];
    if (identity.role !== 'postgres') fail('CONNECTION_ROLE_MUST_BE_POSTGRES');
    const roles = (await client.query("SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")).rows;
    if (roles.length !== 2 || roles.some((role) => role.rolsuper || role.rolbypassrls)) fail('API_ROLE_MISSING_OR_PRIVILEGED');
    const sequences = validateInventory((await client.query(INVENTORY_SQL)).rows, expected);
    const migrations = (await client.query(`SELECT migration_name, checksum,
      finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations`)).rows;
    if (migrations.length !== expected.migrations.size || migrations.some((migration) => !migration.finished || migration.rolled_back
      || expected.migrations.get(migration.migration_name) !== migration.checksum)
      || new Set(migrations.map((migration) => migration.migration_name)).size !== expected.migrations.size) fail('SAVED_MIGRATION_CHAIN_MISMATCH');
    const columnGrants = (await client.query(`SELECT DISTINCT c.relname, a.attname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
        AND (x.grantee = 0 OR x.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')))`)).rows;
    stage = 'privileges';
    await client.query(`REVOKE ALL PRIVILEGES ON TABLE ${expected.tables.map(qualified).join(', ')} FROM anon, authenticated, PUBLIC`);
    if (sequences.length) await client.query(`REVOKE ALL PRIVILEGES ON SEQUENCE ${sequences.map((sequence) => qualified(sequence.relname)).join(', ')} FROM anon, authenticated, PUBLIC`);
    const byTable = new Map();
    for (const grant of columnGrants) { const columns = byTable.get(grant.relname) ?? []; columns.push(grant.attname); byTable.set(grant.relname, columns); }
    for (const [table, columns] of byTable) await client.query(`REVOKE ALL PRIVILEGES (${columns.map(quote).join(', ')}) ON TABLE ${qualified(table)} FROM anon, authenticated, PUBLIC`);
    await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, PUBLIC');
    await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, PUBLIC');
    stage = 'verification';
    const tablePrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
    if (identity.version >= 170000) tablePrivileges.push('MAINTAIN');
    await verifyPrivileges(client, tablePrivileges);
    validateInventory((await client.query(INVENTORY_SQL)).rows, expected);
    if (connectionError) fail(connectionError);
    stage = 'commit';
    await client.query('COMMIT'); inTransaction = false;
    console.log(JSON.stringify({ state: 'applied', projectRef, tables: expected.tables.length,
      sequences: sequences.length, columnsWithExplicitGrantsRevoked: columnGrants.length,
      verifiedMigrations: migrations.length, remainingApiDataPrivileges: 0, tlsCertificateVerification: true }));
    return 0;
  } catch (error) {
    if (client && inTransaction) { try { await client.query('ROLLBACK'); } catch { /* Keep database errors private. */ } }
    const code = error?.auditCode ?? (/^[A-Z0-9_]{1,40}$/.test(error?.code ?? '') ? error.code : 'DATABASE_PREPARATION_FAILED');
    console.error(JSON.stringify({ state: 'failed', stage, code }));
    return 1;
  } finally {
    if (client) { try { await client.end(); } catch { /* Never print raw connection errors. */ } }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
