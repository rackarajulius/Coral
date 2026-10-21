import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadStagingConfig, validateStagingConfig } from './check-config.mjs';

// Recovery after an interrupted acceptance runner. Deletes only identities
// whose saved IDs AND synthetic email prefix match this exact run.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [apply, refFlag, projectRef, runFlag, runId, ...extra] = process.argv.slice(2);
const config = loadStagingConfig(), validated = validateStagingConfig(config);
if (!validated.ok || apply !== '--apply' || refFlag !== '--project-ref' || projectRef !== validated.metadata.projectRef
  || runFlag !== '--run' || !/^[a-f0-9]{32}$/.test(runId ?? '') || extra.length) {
  console.error('Use --apply --project-ref <declared-staging-reference> --run <32-character-run-id>.'); process.exit(1);
}
const directory = resolve(root, '.staging.local', `marketplace-${runId}`);
const reportPath = resolve(directory, 'report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const owned = JSON.parse(readFileSync(resolve(directory, 'owned-records.json'), 'utf8'));
assert.equal(report.projectRef, projectRef); assert.equal(report.runId, runId); assert.equal(owned.runId, runId);
if (owned.projectRef) assert.equal(owned.projectRef, projectRef);
assert.ok(Array.isArray(owned.authIds) && owned.authIds.every(id => /^[0-9a-f-]{36}$/.test(id)));
// Never kill an unverified/reused PID. The operator first verifies any owned
// API still running from its command, creation time and recorded loopback URL.
for (const pid of [owned.runnerPid, owned.apiPid].filter(Boolean)) {
  try { process.kill(pid, 0); throw new Error('Verify and stop the saved runner/API process before cleanup.'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}
const require = createRequire(resolve(root, 'backend/package.json'));
const { Pool } = require('pg');
const db = new Pool({ connectionString: config.backendEnv.DIRECT_URL, max: 1, connectionTimeoutMillis: 15_000, query_timeout: 20_000 });
db.on('error', () => {});
const auth = createClient(config.backendEnv.SUPABASE_URL, config.backendEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const prefix = `coral-qa-${runId}-`;
const syntheticEmail = email => typeof email === 'string' && email.startsWith(prefix) && email.endsWith('@example.test');
try {
  const users = (await db.query('SELECT id,email FROM users WHERE supabase_id=ANY($1::text[])', [owned.authIds])).rows;
  assert.ok(users.every(user => syntheticEmail(user.email)), 'An application identity does not belong to this run');
  const authToDelete = [];
  for (const id of owned.authIds) {
    const result = await auth.auth.admin.getUserById(id);
    if (result.error?.status === 404) continue;
    assert.ok(!result.error && result.data.user && syntheticEmail(result.data.user.email), 'An auth identity could not be verified as run-owned');
    authToDelete.push(id);
  }
  const ids = users.map(user => user.id), trigger = `qa_marketplace_${runId}`;
  await db.query(`DROP TRIGGER IF EXISTS ${trigger} ON notifications`);
  await db.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
  await db.query('DELETE FROM marketplace_events WHERE actor_id=ANY($1::text[])', [ids]);
  await db.query('DELETE FROM companies WHERE name=$1', [`Coral QA ${runId}`]);
  await db.query('DELETE FROM users WHERE id=ANY($1::text[])', [ids]);
  for (const id of authToDelete) {
    const result = await auth.auth.admin.deleteUser(id); assert.ok(!result.error, 'Synthetic auth deletion failed');
  }
  const remaining = await db.query('SELECT count(*)::int AS count FROM users WHERE supabase_id=ANY($1::text[])', [owned.authIds]);
  assert.equal(remaining.rows[0].count, 0);
  report.cleanup = [...(report.cleanup ?? []), 'recovery verified run-owned identities and removed application/auth fixtures'];
  report.recoveredAt = new Date().toISOString(); report.passed = false;
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ runId, recovered: true, applicationUsers: users.length, authUsers: authToDelete.length }));
} catch (error) {
  console.error(`Recovery incomplete (${error.code ?? error.name ?? 'error'}); retain the owned-records manifest for a retry.`);
  process.exitCode = 1;
} finally { await db.end(); }
