import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadStagingConfig, validateStagingConfig } from './check-config.mjs';

const REF = 'abcdefghijklmnopqrst';
const DEV_REF = 'zyxwvutsrqponmlkjihg';
const PUBLISHABLE = 'sb_publishable_staging_public_fixture';
const SERVER_SECRET = 'sb_secret_staging_server_only_fixture';
const DB_PASSWORD = 'unique-staging-db-fixture-password';
const jwt = (role, ref = REF) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role, ref })).toString('base64url'),
  'fixture-signature-not-a-real-key',
].join('.');

function fixture() {
  return {
    frontendEnv: {
      CORAL_STAGING: 'true', STAGING_FRONTEND_ORIGIN: 'http://127.0.0.1:4173',
      VITE_API_URL: 'http://127.0.0.1:3002/api/v1',
      VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: PUBLISHABLE,
      VITE_GOOGLE_CLIENT_ID: '',
    },
    backendEnv: {
      CORAL_STAGING: 'true', STAGING_SUPABASE_PROJECT_REF: REF,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3002', API_PREFIX: 'api/v1',
      STAGING_API_ORIGIN: 'http://127.0.0.1:3002', FRONTEND_URL: 'http://127.0.0.1:4173',
      CORS_ORIGINS: 'http://127.0.0.1:4173', OAUTH_REDIRECT_URL: 'http://127.0.0.1:4173',
      SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: PUBLISHABLE,
      SUPABASE_SERVICE_ROLE_KEY: SERVER_SECRET,
      DATABASE_URL: `postgresql://postgres.${REF}:${DB_PASSWORD}@aws-0-ca-central-1.pooler.supabase.com:6543/postgres?sslmode=require`,
      DIRECT_URL: `postgresql://postgres.${REF}:${DB_PASSWORD}@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=require`,
      MARKETPLACE_LISTING_WRITES_ENABLED: 'false', MARKETPLACE_ENQUIRIES_ENABLED: 'false',
      SCHEDULED_JOBS_ENABLED: 'true', STRIPE_AUTOMATIC_TAX: 'false',
      DEFAULT_ADMIN_EMAIL: '', STRIPE_SECRET_KEY: '', STRIPE_PUBLISHABLE_KEY: '',
    },
    developmentProjectRef: DEV_REF,
    issues: [],
  };
}

const fields = (result) => result.issues.map((entry) => entry.field);
const serializeEnv = (env) => Object.entries(env).map(([field, value]) => `${field}=${value}`).join('\n');

function temporaryWorkspace(t) {
  const prefix = join(tmpdir(), 'coral-staging-config-test-');
  const rootDir = mkdtempSync(prefix);
  t.after(() => {
    assert.ok(resolve(rootDir).startsWith(resolve(prefix)), 'Only the owned temporary fixture may be removed.');
    rmSync(rootDir, { recursive: true, force: true });
  });
  mkdirSync(join(rootDir, 'staging'));
  return rootDir;
}

test('accepts an isolated project with matching public keys and disabled marketplace defaults', () => {
  const result = validateStagingConfig(fixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.metadata.frontendPort, 4173);
  assert.equal(result.metadata.apiPort, 3002);
  assert.equal(result.metadata.listingWritesEnabled, false);
  assert.equal(result.metadata.enquiriesEnabled, false);
});

test('accepts legacy anon/service-role keys only in their declared project and roles', () => {
  const config = fixture();
  config.frontendEnv.VITE_SUPABASE_ANON_KEY = jwt('anon');
  config.backendEnv.SUPABASE_ANON_KEY = jwt('anon');
  config.backendEnv.SUPABASE_SERVICE_ROLE_KEY = jwt('service_role');
  assert.equal(validateStagingConfig(config).ok, true);
  config.backendEnv.SUPABASE_SERVICE_ROLE_KEY = jwt('anon');
  assert.ok(fields(validateStagingConfig(config)).includes('SUPABASE_SERVICE_ROLE_KEY'));
});

test('rejects reusing the development Supabase project', () => {
  const config = fixture();
  config.developmentProjectRef = REF;
  assert.ok(fields(validateStagingConfig(config)).includes('STAGING_SUPABASE_PROJECT_REF'));
});

test('rejects frontend/backend project mismatch and mismatched publishable keys', () => {
  const config = fixture();
  config.frontendEnv.VITE_SUPABASE_URL = `https://${DEV_REF}.supabase.co`;
  config.backendEnv.SUPABASE_ANON_KEY = 'sb_publishable_other_public_fixture';
  const result = validateStagingConfig(config);
  assert.ok(fields(result).includes('VITE_SUPABASE_URL'));
  assert.ok(fields(result).includes('SUPABASE_ANON_KEY'));
});

test('rejects a legacy key with a different project reference', () => {
  const config = fixture();
  config.frontendEnv.VITE_SUPABASE_ANON_KEY = jwt('anon', DEV_REF);
  config.backendEnv.SUPABASE_ANON_KEY = jwt('anon', DEV_REF);
  assert.ok(fields(validateStagingConfig(config)).includes('VITE_SUPABASE_ANON_KEY'));
});

test('accepts a direct database hostname belonging to the expected project', () => {
  const config = fixture();
  config.backendEnv.DIRECT_URL = `postgresql://postgres:${DB_PASSWORD}@db.${REF}.supabase.co:5432/postgres`;
  assert.equal(validateStagingConfig(config).ok, true);
});

test('rejects a database hostname or pooler username belonging to another project', () => {
  const config = fixture();
  config.backendEnv.DIRECT_URL = `postgresql://postgres:${DB_PASSWORD}@db.${DEV_REF}.supabase.co:5432/postgres`;
  config.backendEnv.DATABASE_URL = `postgresql://postgres.${DEV_REF}:${DB_PASSWORD}@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`;
  const result = validateStagingConfig(config);
  assert.ok(fields(result).includes('DATABASE_URL'));
  assert.ok(fields(result).includes('DIRECT_URL'));
});

test('rejects a fake Supabase-looking pooler host and missing database password', () => {
  const config = fixture();
  config.backendEnv.DATABASE_URL = `postgresql://postgres.${REF}:${DB_PASSWORD}@pooler.supabase.com.attacker.test:6543/postgres`;
  config.backendEnv.DIRECT_URL = `postgresql://postgres@db.${REF}.supabase.co:5432/postgres`;
  const result = validateStagingConfig(config);
  assert.ok(fields(result).includes('DATABASE_URL'));
  assert.ok(fields(result).includes('DIRECT_URL'));
});

test('rejects transaction-pooler port 6543 for Prisma migration connection', () => {
  const config = fixture();
  config.backendEnv.DIRECT_URL = config.backendEnv.DATABASE_URL;
  assert.ok(validateStagingConfig(config).issues.some((entry) => entry.field === 'DIRECT_URL' && entry.message.includes('6543')));
});

test('rejects server secret fields and server-key content in browser configuration', () => {
  const config = fixture();
  config.frontendEnv.VITE_SERVICE_ROLE_KEY = SERVER_SECRET;
  config.frontendEnv.VITE_GOOGLE_CLIENT_ID = jwt('service_role');
  const result = validateStagingConfig(config);
  assert.ok(fields(result).includes('frontend.VITE_SERVICE_ROLE_KEY'));
  assert.ok(fields(result).includes('frontend.VITE_GOOGLE_CLIENT_ID'));
});

test('rejects a non-VITE server field in the frontend file too', () => {
  const config = fixture();
  config.frontendEnv.SUPABASE_SERVICE_ROLE_KEY = SERVER_SECRET;
  assert.ok(fields(validateStagingConfig(config)).includes('frontend.SUPABASE_SERVICE_ROLE_KEY'));
});

test('rejects live Stripe keys on either side', () => {
  const config = fixture();
  config.backendEnv.STRIPE_SECRET_KEY = 'sk_live_not_a_real_fixture_key';
  config.frontendEnv.VITE_GOOGLE_CLIENT_ID = 'pk_live_not_a_real_fixture_key';
  const result = validateStagingConfig(config);
  assert.ok(fields(result).includes('backend.STRIPE_SECRET_KEY'));
  assert.ok(fields(result).includes('frontend.VITE_GOOGLE_CLIENT_ID'));
});

test('rejects missing service key, placeholder admin email and ambiguous flag values', () => {
  const config = fixture();
  config.backendEnv.SUPABASE_SERVICE_ROLE_KEY = '';
  config.backendEnv.DEFAULT_ADMIN_EMAIL = 'admin@example.com';
  config.backendEnv.MARKETPLACE_ENQUIRIES_ENABLED = 'TRUE';
  config.backendEnv.MARKETPLACE_LISTING_WRITES_ENABLED = '1';
  const result = validateStagingConfig(config);
  for (const field of ['SUPABASE_SERVICE_ROLE_KEY', 'DEFAULT_ADMIN_EMAIL', 'MARKETPLACE_ENQUIRIES_ENABLED', 'MARKETPLACE_LISTING_WRITES_ENABLED']) {
    assert.ok(fields(result).includes(field));
  }
});

test('rejects quoted flag whitespace and non-loopback server binding', () => {
  const config = fixture();
  config.backendEnv.MARKETPLACE_ENQUIRIES_ENABLED = ' true ';
  config.backendEnv.HOST = '0.0.0.0';
  config.frontendEnv.CORAL_STAGING = 'true ';
  const result = validateStagingConfig(config);
  for (const field of ['MARKETPLACE_ENQUIRIES_ENABLED', 'HOST', 'frontend.CORAL_STAGING']) {
    assert.ok(fields(result).includes(field));
  }
  assert.equal(result.metadata.enquiriesEnabled, false);
});

test('rejects mismatched origins, permissive CORS and wrong API prefix or port', () => {
  const config = fixture();
  config.backendEnv.FRONTEND_URL = 'http://127.0.0.1:8081';
  config.backendEnv.CORS_ORIGINS = '*';
  config.backendEnv.PORT = '3001';
  config.frontendEnv.VITE_API_URL = 'http://127.0.0.1:3002/api/v2';
  const result = validateStagingConfig(config);
  for (const field of ['FRONTEND_URL', 'CORS_ORIGINS', 'PORT', 'VITE_API_URL']) assert.ok(fields(result).includes(field));
});

test('rejects credential-bearing and non-loopback HTTP browser origins', () => {
  const config = fixture();
  config.frontendEnv.STAGING_FRONTEND_ORIGIN = 'http://private:fixture@127.0.0.1:4173';
  config.backendEnv.STAGING_API_ORIGIN = 'http://staging.example.net:3002';
  const result = validateStagingConfig(config);
  assert.ok(fields(result).includes('STAGING_FRONTEND_ORIGIN'));
  assert.ok(fields(result).includes('STAGING_API_ORIGIN'));
});

test('returns only safe metadata and issue messages, without secret values', () => {
  const config = fixture();
  config.backendEnv.DIRECT_URL = `postgresql://postgres:${DB_PASSWORD}@db.${DEV_REF}.supabase.co:5432/postgres`;
  const output = JSON.stringify(validateStagingConfig(config));
  assert.equal(output.includes(DB_PASSWORD), false);
  assert.equal(output.includes(SERVER_SECRET), false);
  assert.equal(output.includes(PUBLISHABLE), false);
});

test('loader uses dedicated files, reads development project only, and ignores inherited credentials', (t) => {
  const rootDir = temporaryWorkspace(t);
  const config = fixture();
  writeFileSync(join(rootDir, 'staging/frontend.env.local'), serializeEnv(config.frontendEnv));
  writeFileSync(join(rootDir, 'staging/backend.env.local'), serializeEnv(config.backendEnv));
  writeFileSync(join(rootDir, '.env'), `VITE_SUPABASE_URL=https://${DEV_REF}.supabase.co\nVITE_SUPABASE_ANON_KEY=development-fixture-not-exported`);
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'inherited-secret-must-be-ignored';
  t.after(() => previous === undefined ? delete process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY = previous);
  const loaded = loadStagingConfig({ rootDir });
  assert.equal(loaded.developmentProjectRef, DEV_REF);
  assert.equal(loaded.backendEnv.SUPABASE_SERVICE_ROLE_KEY, SERVER_SECRET);
  assert.equal('developmentEnv' in loaded, false);
  assert.equal(validateStagingConfig(loaded).ok, true);
});

test('missing staging files are explicit failures, even if shell credentials exist', (t) => {
  const loaded = loadStagingConfig({ rootDir: temporaryWorkspace(t) });
  const result = validateStagingConfig(loaded);
  assert.equal(result.ok, false);
  assert.ok(fields(result).includes('staging/frontend.env.local'));
  assert.ok(fields(result).includes('staging/backend.env.local'));
});

test('loader rejects project reuse found only in a backend development env', (t) => {
  const rootDir = temporaryWorkspace(t);
  const config = fixture();
  writeFileSync(join(rootDir, 'staging/frontend.env.local'), serializeEnv(config.frontendEnv));
  writeFileSync(join(rootDir, 'staging/backend.env.local'), serializeEnv(config.backendEnv));
  writeFileSync(join(rootDir, '.env'), `VITE_SUPABASE_URL=https://${DEV_REF}.supabase.co`);
  mkdirSync(join(rootDir, 'backend'));
  writeFileSync(join(rootDir, 'backend/.env.local'), `SUPABASE_URL=https://${REF}.supabase.co`);
  const loaded = loadStagingConfig({ rootDir });
  assert.deepEqual(loaded.developmentProjectRefs, [DEV_REF, REF]);
  assert.ok(fields(validateStagingConfig(loaded)).includes('STAGING_SUPABASE_PROJECT_REF'));
});

test('loader also rejects development database reuse without a declared backend auth URL', (t) => {
  const rootDir = temporaryWorkspace(t);
  const config = fixture();
  writeFileSync(join(rootDir, 'staging/frontend.env.local'), serializeEnv(config.frontendEnv));
  writeFileSync(join(rootDir, 'staging/backend.env.local'), serializeEnv(config.backendEnv));
  mkdirSync(join(rootDir, 'backend'));
  writeFileSync(join(rootDir, 'backend/.env'), `DIRECT_URL=postgresql://postgres:${DB_PASSWORD}@db.${REF}.supabase.co:5432/postgres`);
  const loaded = loadStagingConfig({ rootDir });
  assert.deepEqual(loaded.developmentProjectRefs, [REF]);
  assert.ok(fields(validateStagingConfig(loaded)).includes('STAGING_SUPABASE_PROJECT_REF'));
  assert.equal(JSON.stringify(validateStagingConfig(loaded)).includes(DB_PASSWORD), false);
});

test('examples remain deliberately incomplete and fail until a separate project is configured', () => {
  const config = loadStagingConfig({ frontendPath: 'staging/frontend.env.example', backendPath: 'staging/backend.env.example' });
  assert.equal(validateStagingConfig(config).ok, false);
  assert.equal(config.backendEnv.MARKETPLACE_ENQUIRIES_ENABLED, 'false');
  assert.equal(config.backendEnv.MARKETPLACE_LISTING_WRITES_ENABLED, 'false');
});

test('CLI fails safely without printing database passwords or key content', (t) => {
  const rootDir = temporaryWorkspace(t);
  const config = fixture();
  config.backendEnv.DIRECT_URL = `postgresql://postgres:${DB_PASSWORD}@db.${DEV_REF}.supabase.co:5432/postgres`;
  writeFileSync(join(rootDir, 'staging/frontend.env.local'), serializeEnv(config.frontendEnv));
  writeFileSync(join(rootDir, 'staging/backend.env.local'), serializeEnv(config.backendEnv));
  writeFileSync(join(rootDir, '.env'), `VITE_SUPABASE_URL=https://${DEV_REF}.supabase.co`);
  mkdirSync(join(rootDir, 'scripts/staging'), { recursive: true });
  const scriptPath = join(rootDir, 'scripts/staging/check-config.mjs');
  writeFileSync(scriptPath, readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'check-config.mjs')));
  const child = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  assert.equal(child.status, 1);
  const output = `${child.stdout}${child.stderr}`;
  assert.ok(output.includes('DIRECT_URL'));
  assert.ok(output.includes('No connection or deployment was attempted'));
  for (const secret of [DB_PASSWORD, SERVER_SECRET, PUBLISHABLE]) assert.equal(output.includes(secret), false);
});
