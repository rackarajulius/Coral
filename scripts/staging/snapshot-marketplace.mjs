import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Consistent, fixture-only logical export. This deliberately excludes real
// staging users, Auth credentials, storage objects and unrelated app tables.
export async function snapshotMarketplace({ db, directory, runId, provider, customer, service, request }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const ids = [provider.id, customer.id];
    const definitions = [
      ['users', 'id=ANY($1::text[])', ids],
      ['job_seeker_profiles', 'user_id=ANY($1::text[])', ids],
      ['freelancer_profiles', 'user_id=ANY($1::text[])', ids],
      ['service_listings', 'id=$1', service.id],
      ['marketplace_requests', 'id=$1', request.id],
      ['marketplace_messages', 'request_id=$1', request.id],
      ['notifications', 'user_id=ANY($1::text[])', ids],
      ['marketplace_deliveries', 'request_id=$1', request.id],
    ];
    const tables = {};
    for (const [table, where, parameter] of definitions) {
      tables[table] = (await client.query(`SELECT row_to_json(t) AS row FROM ${table} t WHERE ${where} ORDER BY id`, [parameter])).rows.map(r => r.row);
    }
    assert.equal(tables.users.length, 2);
    assert.ok(tables.users.every(u => u.email.startsWith(`coral-qa-${runId}-`) && u.email.endsWith('@example.test')));
    assert.equal(tables.marketplace_requests.length, 1);
    assert.ok(tables.marketplace_messages.length > 0);
    const migrations = (await client.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
    await client.query('COMMIT');
    const bytes = JSON.stringify({ format: 'coral-synthetic-marketplace-v1', runId, migrations, tables }, null, 2) + '\n';
    writeFileSync(resolve(directory, 'synthetic-backup.json'), bytes);
    return { sha256: createHash('sha256').update(bytes).digest('hex'), tableCounts: Object.fromEntries(Object.entries(tables).map(([k,v]) => [k,v.length])),
      scope: 'Consistent logical export of run-owned service enquiry records; excludes hosted Auth, storage and other application data.' };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
