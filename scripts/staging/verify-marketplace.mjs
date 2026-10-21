import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { loadStagingConfig, validateStagingConfig } from './check-config.mjs';
import { childEnvironment, requireCleanRuntime, frontendFingerprint } from './run.mjs';
import { verifyPrivateFiles } from './verify-private-files.mjs';
import { snapshotMarketplace } from './snapshot-marketplace.mjs';

// Real Supabase password sessions and the compiled Nest API. Creates only
// labelled synthetic fixtures, sends no invitations/email, and cleans owned
// rows in finally. Never reads the application's development environment.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'backend/package.json'));
const { Pool } = require('pg');
const config = loadStagingConfig(), validation = validateStagingConfig(config);
const args = process.argv.slice(2);
if (!validation.ok || args.length !== 3 || args[0] !== '--apply' || args[1] !== '--project-ref'
  || args[2] !== validation.metadata.projectRef) {
  console.error('Requires valid isolated staging configuration and --apply --project-ref <declared-staging-reference>.');
  process.exit(1);
}
if (['RESEND_API_KEY', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'SLACK_CLIENT_ID'].some(key => config.backendEnv[key])) {
  console.error('Acceptance fixtures require external delivery/payment/AI integrations to remain unconfigured.');
  process.exit(1);
}
const runId = randomUUID().replaceAll('-', '');
const directory = resolve(root, '.staging.local', `marketplace-${runId}`);
mkdirSync(directory, { recursive: true });
requireCleanRuntime(directory);
const report = { runId, projectRef: validation.metadata.projectRef, startedAt: new Date().toISOString(),
  evidence: 'Real Supabase password authentication + compiled local staging API + hosted PostgreSQL; synthetic participants, not browser or pilot acceptance.',
  checks: [], cleanup: [], passed: false };
const actors = [], companies = [], spaces = [], authIds = [];
const privateObjects = [];
const trigger = `qa_marketplace_${runId}`;
const db = new Pool({ connectionString: config.backendEnv.DIRECT_URL, max: 1,
  connectionTimeoutMillis: 15_000, query_timeout: 20_000, idleTimeoutMillis: 10_000, keepAlive: true });
// A hosted connection can disappear while the script is working through Auth.
// Pool replaces idle failed connections; never let an idle 'error' bypass finally.
db.on('error', () => { report.databaseDisconnects = (report.databaseDisconnects ?? 0) + 1; save(); });
const auth = createClient(config.backendEnv.SUPABASE_URL, config.backendEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
let processHandle, baseUrl, connected = false, activeCheck = 'initialization';
let triggerInstalled = false;
function verifyBackendBuild(relative = '') {
  const hash = createHash('sha256');
  function visit(subdirectory) {
    for (const entry of readdirSync(resolve(root, 'backend/src', subdirectory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${subdirectory}${entry.name}`;
      if (entry.isDirectory()) { visit(`${name}/`); continue; }
      if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;
      const source = resolve(root, 'backend/src', name), artifact = resolve(root, 'backend/.staging.local/dist', name.slice(0, -3) + '.js');
      if (!existsSync(artifact) || statSync(source).mtimeMs > statSync(artifact).mtimeMs) throw new Error('Backend build is stale; rebuild staging first');
      hash.update(name).update(readFileSync(artifact));
    }
  }
  visit(relative); return hash.digest('hex');
}
function save() {
  writeFileSync(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  // IDs only; enough to recover cleanup after a killed process, never sessions/passwords.
  writeFileSync(resolve(directory, 'owned-records.json'), JSON.stringify({ runId, projectRef: validation.metadata.projectRef,
    runnerPid: process.pid, apiPid: processHandle?.pid ?? null, apiUrl: baseUrl ?? null,
    authIds, userIds: actors.map(a => a.id), companies, spaces, trigger, privateObjects }, null, 2) + '\n');
}
async function check(name, work) {
  activeCheck = name; report.activeCheck = name; save(); const start = Date.now(); await work();
  report.checks.push({ name, passed: true, durationMs: Date.now() - start }); save();
  console.log(`Passed: ${name}`);
}
async function api(actor, method, path, body, expected = method === 'POST' ? 201 : 200, timeoutMs = 45_000) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json();
  // Deliberately exclude response bodies from diagnostics (may contain private data).
  if (response.status !== expected) throw new Error(`HTTP ${method} ${path.split('?')[0]} expected ${expected}, received ${response.status}`);
  return data.data ?? data;
}
async function stopApi() {
  if (!processHandle || processHandle.exitCode !== null) return;
  const child = processHandle;
  const ended = new Promise(done => child.once('exit', done));
  child.kill(); await Promise.race([ended, delay(10_000)]);
  if (child.exitCode === null && child.signalCode === null) throw new Error('Owned API did not stop');
  processHandle = undefined;
  save();
}
async function startApi(enabled) {
  await stopApi();
  const socket = createServer();
  await new Promise((done, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', done); });
  const port = socket.address().port; await new Promise(done => socket.close(done));
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const log = createWriteStream(resolve(directory, 'api.log'), { flags: 'a' });
  processHandle = spawn(process.execPath, [resolve(root, 'backend/.staging.local/dist/main.js')], {
    cwd: directory, windowsHide: true, shell: false,
    env: childEnvironment({ ...config.backendEnv, PORT: String(port), HOST: '127.0.0.1',
      SCHEDULED_JOBS_ENABLED: 'false', MARKETPLACE_LISTING_WRITES_ENABLED: String(enabled), MARKETPLACE_ENQUIRIES_ENABLED: String(enabled) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processHandle.stdout.pipe(log, { end: false }); processHandle.stderr.pipe(log, { end: false });
  processHandle.once('close', () => log.end());
  processHandle.once('error', () => {});
  save();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw Object.assign(new Error('Owned API exited during startup'), { code: 'API_STARTUP_EXIT' });
    try { await api(null, 'GET', '/auth/verify', undefined, 200, 2_000); return; }
    catch { await delay(1000); }
  }
  throw Object.assign(new Error('Owned API startup timeout'), { code: 'API_STARTUP_TIMEOUT' });
}
async function identity(label, employer = false) {
  const email = `coral-qa-${runId}-${label}@example.test`, password = randomBytes(32).toString('base64url');
  const created = await auth.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Coral QA ${label}` } });
  if (created.error || !created.data.user) throw new Error('Synthetic auth identity creation failed');
  authIds.push(created.data.user.id); save();
  const client = createClient(config.backendEnv.SUPABASE_URL, config.backendEnv.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw new Error('Synthetic password sign-in failed');
  const actor = { label, token: login.data.session.access_token, authId: created.data.user.id };
  const current = await api(actor, 'GET', '/auth/me'); actor.id = current.user.id; actors.push(actor); save();
  if (employer) {
    await api(actor, 'POST', '/auth/role', { role: 'EMPLOYER' }, 200);
    await api(actor, 'POST', '/employers/me/onboarding/company', { companyName: `Coral QA ${runId}`, companySize: '1-10', industry: 'Technology', headquarters: 'Toronto, Ontario, Canada' });
    const seats = await db.query('SELECT m.company_id FROM company_members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND c.name=$2', [actor.id, `Coral QA ${runId}`]);
    assert.equal(seats.rows.length, 1, 'The synthetic company must be owned exclusively by this run');
    for (const row of seats.rows) companies.push(row.company_id); save();
    actor.companyId = seats.rows[0].company_id;
    await api(actor, 'POST', '/employers/me/onboarding/complete', {});
  } else {
    await api(actor, 'POST', '/auth/onboarding', { role: 'JOB_SEEKER', profileData: { headline: 'Synthetic software professional', country: 'Canada', city: 'Toronto', skills: ['TypeScript'] } }, 200);
  }
  assert.equal((await api(actor, 'GET', '/auth/me')).user.status, 'ACTIVE');
  return actor;
}
async function runDeliveryJob(phase) {
  const result = await api(admin, 'POST', '/admin/scheduled-jobs/marketplace-notification-delivery/run', {}, 201, 120_000);
  report.notificationRecovery ??= {};
  // Keep operational outcomes, never a job's exception text or message contents.
  report.notificationRecovery[phase] = { ran: result.ran, status: result.status, reason: result.reason, durationMs: result.durationMs };
  save();
  assert.equal(result.ran, true, 'The notification worker must acquire its lease');
  assert.equal(result.status, 'ok', 'The notification worker must finish its scan');
}
const sample = { label: 'Synthetic work sample', url: 'https://example.test/qa-work' };
const serviceDto = { title: `Coral QA service ${runId}`, description: 'Synthetic software service for staging acceptance only.', category: 'software',
  skills: ['TypeScript'], deliverables: ['A synthetic QA deliverable'], workSamples: [sample], availability: 'available', pricingMode: 'quote', currency: 'CAD', workMode: 'remote', country: 'Canada', city: 'Toronto', publicConsent: true };
let provider, customer, owner, colleague, outsider, admin, service, request, project, response;
try {
  await check('compiled staging artifacts and database migration status', async () => {
    const manifest = JSON.parse(readFileSync(resolve(root, '.staging.local/build.json'), 'utf8'));
    assert.equal(manifest.frontendFingerprint, frontendFingerprint(config.frontendEnv)); report.build = manifest;
    assert.ok(existsSync(resolve(root, 'backend/.staging.local/dist/main.js')));
    report.backendArtifactSha256 = verifyBackendBuild();
    await db.query('SELECT 1'); connected = true;
    const state = await db.query('SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL');
    assert.equal(state.rows[0].count, 0);
  });
  await check('flags-off anonymous reads and private denial', async () => {
    await startApi(false);
    assert.equal((await api(null, 'GET', '/marketplace/capabilities')).listingWritesEnabled, false);
    await api(null, 'GET', '/services'); await api(null, 'GET', '/gigs');
    await api(null, 'GET', '/marketplace/requests', undefined, 401);
  });
  await check('six separate real password sessions and candidate/company onboarding', async () => {
    provider = await identity('provider'); customer = await identity('customer'); owner = await identity('company', true);
    colleague = await identity('colleague'); outsider = await identity('outsider'); admin = await identity('admin');
    await db.query("UPDATE users SET role='ADMIN' WHERE id=$1", [admin.id]);
    await db.query("INSERT INTO company_members (id,company_id,user_id,role,status,updated_at) VALUES ($1,$2,$3,'ADMIN','ACTIVE',now())", [randomUUID(),owner.companyId,colleague.id]);
    await api(provider, 'POST', '/services', serviceDto, 403);
  });
  await check('provider opt-in retains employment role and explicit public consent', async () => {
    await api(provider, 'PATCH', '/freelancers/me/profile', { providerEnabled: true, publicPreviewEnabled: false, category: 'software', headline: 'Synthetic software services', summary: 'This is a synthetic professional used solely for staging acceptance.', skills: ['TypeScript'], portfolioUrl: sample.url, country: 'Canada', city: 'Toronto', availability: 'available' });
    await api(null, 'GET', `/freelancers/${provider.id}`, undefined, 404);
    await api(provider, 'PATCH', '/freelancers/me/profile', { publicPreviewEnabled: true });
    await api(null, 'GET', `/freelancers/${provider.id}`);
    assert.equal((await api(provider, 'GET', '/auth/me')).user.role, 'JOB_SEEKER');
  });
  await check('service draft privacy, publication and owner isolation', async () => {
    await startApi(true); service = await api(provider, 'POST', '/services', serviceDto);
    await api(null, 'GET', `/services/${service.id}`, undefined, 404);
    await api(outsider, 'GET', `/services/mine/${service.id}`, undefined, 404);
    await api(provider, 'POST', `/services/${service.id}/state`, { status: 'published' });
    await api(null, 'GET', `/services/${service.id}`);
  });
  await check('service enquiry retry, consent, first reply and private participant isolation', async () => {
    const dto = { kind: 'service', listingId: service.id, body: 'Synthetic private service enquiry for staging acceptance.', idempotencyKey: randomUUID(), source: 'directory' };
    request = await api(customer, 'POST', '/marketplace/requests', dto);
    assert.equal((await api(customer, 'POST', '/marketplace/requests', dto)).id, request.id);
    await api(customer, 'POST', `/marketplace/requests/${request.id}/messages`, { body: 'Cannot send before acceptance', idempotencyKey: randomUUID() }, 403);
    for (const actor of [outsider, colleague, admin]) await api(actor, 'GET', `/marketplace/requests/${request.id}`, undefined, 404);
    await api(provider, 'POST', `/marketplace/requests/${request.id}/messages`, { body: 'Synthetic recipient reply to open the conversation.', idempotencyKey: randomUUID() });
    assert.equal((await api(customer, 'GET', `/marketplace/requests/${request.id}`)).status, 'accepted');
  });
  await check('company project response, colleague denial and seat revocation', async () => {
    project = await api(owner, 'POST', '/gigs', { title: `Coral QA project ${runId}`, description: 'Synthetic project for staging acceptance.', scope: 'Build a small synthetic example and document the results.', category: 'software', skills: ['TypeScript'], companyId: owner.companyId, country: 'Canada', workMode: 'remote', budgetMode: 'negotiable', currency: 'CAD', publicConsent: true });
    await api(owner, 'POST', `/gigs/${project.id}/state`, { status: 'open' });
    response = await api(provider, 'POST', '/marketplace/requests', { kind: 'project', listingId: project.id, body: 'Synthetic private response to the QA software project.', workSamples: [sample], idempotencyKey: randomUUID() });
    await api(colleague, 'GET', `/marketplace/requests/${response.id}`, undefined, 404);
    await api(owner, 'POST', `/marketplace/requests/${response.id}/messages`, { body: 'Synthetic company reply to the project response.', idempotencyKey: randomUUID() });
    await db.query("UPDATE company_members SET status='REMOVED' WHERE company_id=$1 AND user_id=$2", [owner.companyId,owner.id]);
    await api(owner, 'GET', `/marketplace/requests/${response.id}`, undefined, 403);
    await api(provider, 'POST', `/marketplace/requests/${response.id}/messages`, { body: 'Must not send after company departure', idempotencyKey: randomUUID() }, 403);
    await db.query("UPDATE company_members SET status='ACTIVE' WHERE company_id=$1 AND user_id=$2", [owner.companyId,owner.id]);
  });
  await check('notification outage persists retries, restart delivers exactly one notification', async () => {
    const ids = actors.map(a => a.id);
    const unrelated = await db.query("SELECT count(*)::int AS count FROM marketplace_deliveries WHERE status='pending' AND NOT (user_id=ANY($1::text[]))", [ids]);
    assert.equal(unrelated.rows[0].count, 0, 'Unrelated pending deliveries prevent a fixture-only worker check');
    // UUIDs are generated/validated identifiers, not user-supplied SQL fragments.
    assert.ok(ids.every(id => /^[0-9a-f-]{36}$/.test(id)));
    await db.query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id IN (${ids.map(id => `'${id}'`).join(',')}) THEN RAISE EXCEPTION 'synthetic_notification_outage'; END IF; RETURN NEW; END $$`);
    triggerInstalled = true;
    await db.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
    await runDeliveryJob('outage');
    const failed = await db.query("SELECT count(*)::int AS count FROM marketplace_deliveries WHERE user_id=ANY($1::text[]) AND status='pending' AND last_error='delivery_failed'", [ids]);
    report.notificationRecovery.retainedFailures = failed.rows[0].count; save();
    assert.ok(failed.rows[0].count > 0);
    await db.query(`DROP TRIGGER ${trigger} ON notifications`); await db.query(`DROP FUNCTION ${trigger}()`); triggerInstalled = false;
    await startApi(true);
    // PostgreSQL and the local worker can differ by seconds. Put only these
    // synthetic retries firmly in the past, rather than on a clock boundary.
    await db.query("UPDATE marketplace_deliveries SET next_attempt_at=now()-interval '5 minutes' WHERE user_id=ANY($1::text[]) AND status='pending'", [ids]);
    await runDeliveryJob('restart');
    await runDeliveryJob('repeat');
    const delivery = await db.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE d.status='delivered' AND n.id IS NOT NULL)::int AS delivered,(SELECT count(*)::int FROM notifications WHERE user_id=ANY($1::text[]) AND type='marketplace') AS notifications FROM marketplace_deliveries d LEFT JOIN notifications n ON n.id=d.notification_id WHERE d.user_id=ANY($1::text[])", [ids]);
    const states = await db.query("SELECT status,last_error,count(*)::int AS count FROM marketplace_deliveries WHERE user_id=ANY($1::text[]) GROUP BY status,last_error", [ids]);
    report.notificationRecovery.delivery = delivery.rows[0]; report.notificationRecovery.states = states.rows; save();
    assert.ok(delivery.rows[0].total > 0); assert.equal(delivery.rows[0].delivered, delivery.rows[0].total);
    assert.equal(delivery.rows[0].notifications, delivery.rows[0].total, 'Retries must not create additional marketplace notifications');
  });
  await check('unverified hiring denial and synthetic verified application-to-conversation journey', async () => {
    const jobDto = { title: `Coral QA software job ${runId}`, description: 'Synthetic QA employment opportunity. No real recruitment.', employmentType: 'full-time', status: 'active' };
    await api(owner, 'POST', '/jobs', jobDto, 403);
    // Only the run-owned synthetic employer is elevated, never an existing company.
    await db.query("UPDATE employer_profiles SET verification_status='verified' WHERE user_id=$1", [owner.id]);
    const job = await api(owner, 'POST', '/jobs', jobDto);
    await api(provider, 'POST', '/applications', { jobId: job.id });
    const conversation = await api(owner, 'POST', '/messaging/conversations', { candidateId: provider.id, jobId: job.id });
    await api(owner, 'POST', `/messaging/conversations/${conversation.id}/messages`, { body: 'Synthetic recruiting reply after the application.' });
    await api(provider, 'GET', `/messaging/conversations/${conversation.id}/messages`);
    await api(outsider, 'GET', `/messaging/conversations/${conversation.id}/messages`, undefined, 403);
    await check('real private uploads, authorization and signed-link behavior', async () => {
      report.privateFiles = await verifyPrivateFiles({ api, baseUrl, auth, config, provider, owner, outsider, admin,
        conversation, privateObjects, save });
    });
  });
  await check('provider-enabled jobseeker closure removes profile/listing and rejects the old session', async () => {
    const closing = await identity('closure');
    await api(closing, 'PATCH', '/freelancers/me/profile', { providerEnabled: true, publicPreviewEnabled: false });
    const draft = await api(closing, 'POST', '/services', { ...serviceDto, publicConsent: false });
    // Real objects in each private namespace used by account closure. Upload
    // acceptance above uses application routes; these are closure-only fixtures.
    const closureObjects = [
      ['resumes', `resumes/${closing.id}/closure.txt`],
      ['verification-documents', `${closing.id}/closure.pdf`],
    ];
    for (const [bucket, path] of closureObjects) {
      privateObjects.push({ bucket, path }); save();
      const result = await auth.storage.from(bucket).upload(path, Buffer.from('Synthetic closure fixture'),
        { contentType: bucket === 'resumes' ? 'text/plain' : 'application/pdf' });
      assert.equal(result.error, null);
    }
    await api(closing, 'DELETE', '/auth/account', { confirmation: 'CLOSE' });
    await api(closing, 'GET', '/auth/me', undefined, 401);
    const records = await db.query('SELECT (SELECT count(*) FROM users WHERE id=$1)::int AS users, (SELECT count(*) FROM freelancer_profiles WHERE user_id=$1)::int AS profiles, (SELECT count(*) FROM service_listings WHERE id=$2)::int AS listings', [closing.id, draft.id]);
    assert.deepEqual(records.rows[0], { users: 0, profiles: 0, listings: 0 });
    const deletedIdentity = await auth.auth.admin.getUserById(closing.authId);
    assert.ok(deletedIdentity.error?.status === 404 || deletedIdentity.error?.code === 'user_not_found');
    for (const [bucket, path] of closureObjects) {
      const result = await auth.storage.from(bucket).download(path);
      assert.ok(result.error, 'Closed account file must no longer exist');
    }
  });
  await check('listing pause, block/report and flags-off preserve authorized history and safety actions', async () => {
    await api(provider, 'POST', `/services/${service.id}/state`, { status: 'paused' });
    await api(customer, 'GET', `/marketplace/requests/${request.id}`);
    await api(customer, 'POST', `/marketplace/requests/${request.id}/report`, { reason: 'other', details: 'Synthetic staging report; no real complaint.' });
    await startApi(false);
    await api(customer, 'POST', `/marketplace/requests/${request.id}/messages`, { body: 'Flag-off send must be refused', idempotencyKey: randomUUID() }, 403);
    await api(customer, 'POST', `/marketplace/requests/${request.id}/state`, { action: 'block' });
    await api(provider, 'GET', `/marketplace/requests/${request.id}`);
    await api(provider, 'PATCH', '/freelancers/me/profile', { publicPreviewEnabled: false });
    await api(null, 'GET', `/freelancers/${provider.id}`, undefined, 404);
    await api(admin, 'GET', '/marketplace/metrics');
    await api(outsider, 'GET', '/marketplace/metrics', undefined, 403);
  });
  await check('consistent backup of synthetic populated marketplace records', async () => {
    report.backup = await snapshotMarketplace({ db, directory, runId, provider, customer, service, request });
  });
  report.passed = true;
} catch (error) {
  report.checks.push({ name: activeCheck, passed: false, failure: error.message?.startsWith('HTTP ') ? error.message : `Check failed (${error.code ?? error.name ?? 'error'}); inspect locally without sharing credentials.` });
  console.error(`Failed: ${activeCheck}`);
} finally {
  try { await stopApi(); report.cleanup.push('owned API stopped'); }
  catch { report.cleanup.push('API cleanup failed'); report.passed = false; }
  try {
    for (const { bucket, path } of privateObjects) {
      const result = await auth.storage.from(bucket).remove([path]);
      if (result.error) throw new Error('Private object cleanup failed');
    }
    if (privateObjects.length) report.cleanup.push('owned private objects removed');
  } catch { report.cleanup.push('private object cleanup needs attention'); report.passed = false; }
  if (connected) {
    try {
      if (triggerInstalled) { await db.query(`DROP TRIGGER IF EXISTS ${trigger} ON notifications`); await db.query(`DROP FUNCTION IF EXISTS ${trigger}()`); }
      const owned = await db.query('SELECT id FROM users WHERE supabase_id=ANY($1::text[])', [authIds]);
      const ids = owned.rows.map(row => row.id);
      // Some legacy relations lack cascades; remove only fixtures explicitly
      // referenced by this run. Company deletion also clears its owned records.
      await db.query('DELETE FROM marketplace_events WHERE actor_id=ANY($1::text[])', [ids]);
      await db.query('DELETE FROM companies WHERE id=ANY($1::text[]) AND name=$2', [companies, `Coral QA ${runId}`]);
      await db.query('DELETE FROM users WHERE id=ANY($1::text[])', [ids]);
      const remaining = await db.query('SELECT count(*)::int AS count FROM users WHERE supabase_id=ANY($1::text[])', [authIds]);
      assert.equal(remaining.rows[0].count, 0);
      report.cleanup.push('owned application records removed');
    } catch (error) { report.cleanup.push(`application cleanup needs attention (${error.code ?? 'error'})`); report.passed = false; }
  }
  for (const id of authIds) {
    try { const result = await auth.auth.admin.deleteUser(id);
      if (result.error && result.error.status !== 404 && result.error.code !== 'user_not_found') throw new Error(); }
    catch { report.cleanup.push('auth cleanup needs attention'); report.passed = false; }
  }
  if (authIds.length && !report.cleanup.includes('auth cleanup needs attention')) report.cleanup.push('owned auth identities removed');
  await db.end().catch(() => {});
  report.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, cleanup: report.cleanup, report: resolve(directory, 'report.json') }));
  process.exitCode = report.passed ? 0 : 1;
}
