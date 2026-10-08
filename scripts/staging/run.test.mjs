import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { childEnvironment, createStagingPlan, frontendFingerprint, requireCleanRuntime } from './run.mjs';

const config = {
  frontendEnv: { CORAL_STAGING: 'true', VITE_SUPABASE_ANON_KEY: 'public-staging-key' },
  backendEnv: { CORAL_STAGING: 'true', HOST: '127.0.0.1', DATABASE_URL: 'private-staging-url', SUPABASE_SERVICE_ROLE_KEY: 'private-staging-key' },
};
const accepted = {
  ok: true,
  metadata: { frontendOrigin: 'http://127.0.0.1:4173', frontendPort: 4173, apiOrigin: 'http://127.0.0.1:3002', apiPort: 3002 },
};

test('browser child cannot inherit database, payment, server credentials or Node injection', () => {
  const env = childEnvironment(config.frontendEnv, {
    Path: 'system-path', TEMP: 'temp', DATABASE_URL: 'development-url', VITE_SUPABASE_URL: 'development-project',
    SUPABASE_SERVICE_ROLE_KEY: 'development-secret', STRIPE_SECRET_KEY: 'sk_live_secret', NODE_OPTIONS: '--require secret.js',
  });
  assert.equal(env.Path, 'system-path');
  assert.equal(env.VITE_SUPABASE_ANON_KEY, 'public-staging-key');
  for (const field of ['DATABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'NODE_OPTIONS']) {
    assert.equal(env[field], undefined);
  }
});

test('API starts with staging-only environment and an isolated runtime working directory', () => {
  const plan = createStagingPlan('api', config, accepted);
  assert.match(plan.steps[0].cwd.replaceAll('\\', '/'), /\.staging\.local\/api-runtime$/);
  assert.match(plan.steps[0].args[0].replaceAll('\\', '/'), /backend\/\.staging\.local\/dist\/main\.js$/);
  assert.equal(plan.steps[0].env.DATABASE_URL, 'private-staging-url');
  assert.equal(plan.steps[0].env.NODE_ENV, 'production');
  assert.equal(plan.steps[0].env.VITE_SUPABASE_ANON_KEY, undefined);
});

test('build keeps backend credentials out of compiler and browser processes', () => {
  const plan = createStagingPlan('build', config, accepted);
  assert.equal(plan.steps[0].env.DATABASE_URL, 'private-staging-url');
  for (const step of plan.steps.slice(1)) {
    assert.equal(step.env.DATABASE_URL, undefined);
    assert.equal(step.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  }
});

test('invalid configuration, non-local origins and conflicting ports refuse launch', () => {
  assert.throws(() => createStagingPlan('api', config, { ...accepted, ok: false }), /configuration must pass/);
  assert.throws(() => createStagingPlan('api', config, {
    ...accepted, metadata: { ...accepted.metadata, apiOrigin: 'https://coral.example.org' },
  }), /local staging starter/);
  assert.throws(() => createStagingPlan('web', config, {
    ...accepted, metadata: { ...accepted.metadata, frontendPort: 3002 },
  }), /ports must differ/);
});

test('migration plan uses deploy and the staging config; it never uses reset or db push', () => {
  const plan = createStagingPlan('migrate', config, accepted);
  assert.equal(plan.steps.length, 1);
  assert.deepEqual(plan.steps[0].args.slice(1, 4), ['migrate', 'deploy', '--config']);
  assert.match(plan.steps[0].args[4].replaceAll('\\', '/'), /scripts\/staging\/prisma\.config\.ts$/);
});

test('runtime refuses both dotenv filenames before Nest can load development settings', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'coral-staging-runtime-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('coral-staging-runtime-'));
    rmSync(directory, { recursive: true, force: true });
  });
  requireCleanRuntime(directory);
  for (const name of ['.env', '.env.local']) {
    writeFileSync(join(directory, name), 'DATABASE_URL=wrong-project\n');
    assert.throws(() => requireCleanRuntime(directory), /contains an application env file/);
    rmSync(join(directory, name));
  }
});

test('browser configuration changes invalidate the built frontend fingerprint', () => {
  assert.equal(frontendFingerprint({ A: '1', B: '2' }), frontendFingerprint({ B: '2', A: '1' }));
  assert.notEqual(frontendFingerprint({ VITE_API_URL: 'old' }), frontendFingerprint({ VITE_API_URL: 'new' }));
});
