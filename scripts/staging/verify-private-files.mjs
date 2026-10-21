import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Called only by the explicitly selected, isolated staging acceptance runner.
// Never retain signed URLs, credentials or document bytes in its public report.
export async function verifyPrivateFiles({ api, baseUrl, auth, config, provider, owner, outsider, admin,
  conversation, privateObjects, save }) {
  const content = 'Synthetic Coral QA resume. TypeScript software professional. No personal information.';
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  async function upload(actor, route, bytes, type, name, expected = 201) {
    const form = new FormData(); form.append('file', new Blob([bytes], { type }), name);
    const response = await fetch(`${baseUrl}${route}`, { method: 'POST', headers: { Authorization: `Bearer ${actor.token}` },
      body: form, signal: AbortSignal.timeout(45_000) });
    assert.equal(response.status, expected, `Upload ${route}`);
    const result = await response.json(); return result.data ?? result;
  }
  function remember(bucket, path) { privateObjects.push({ bucket, path }); save(); }
  const resume = await upload(provider, '/job-seekers/me/resume/for-application', content, 'text/plain', 'synthetic-resume.txt');
  remember('resumes', resume.path);
  const document = await upload(provider, '/verifications/document', pdf, 'application/pdf', 'synthetic-document.pdf');
  remember('verification-documents', document.documentUrl);
  const verification = await api(provider, 'POST', '/verifications', { type: 'IDENTITY', documentUrl: document.documentUrl,
    note: 'Synthetic staging fixture. Not a real identity document.' });
  await api(outsider, 'POST', '/verifications', { type: 'IDENTITY', documentUrl: document.documentUrl }, 400);
  await api(outsider, 'GET', `/admin/verifications/${verification.id}/document`, undefined, 403);
  await api(provider, 'GET', `/admin/verifications/${verification.id}/document`, undefined, 403);
  await api(null, 'GET', '/job-seekers/me/resume', undefined, 401);
  const signedDocument = await api(admin, 'GET', `/admin/verifications/${verification.id}/document`);
  const attachment = await upload(provider, `/messaging/conversations/${conversation.id}/attachments`, content, 'text/plain', 'synthetic-attachment.txt');
  remember('message-attachments', attachment.path);
  await upload(outsider, `/messaging/conversations/${conversation.id}/attachments`, content, 'text/plain', 'denied.txt', 403);
  const message = await api(provider, 'POST', `/messaging/conversations/${conversation.id}/messages`, { body: 'Synthetic private attachment', attachments: [attachment] });
  await api(outsider, 'GET', `/messaging/conversations/${conversation.id}/messages`, undefined, 403);
  const signedAttachment = message.attachments?.[0]?.url;
  assert.ok(signedAttachment, 'Participant response must include attachment download');
  const outsiderStorage = createClient(config.backendEnv.SUPABASE_URL, config.backendEnv.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${outsider.token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const results = [];
  for (const [bucket, path, url] of [
    ['resumes', resume.path, resume.url],
    ['verification-documents', document.documentUrl, signedDocument.url],
    ['message-attachments', attachment.path, signedAttachment],
  ]) {
    const metadata = await auth.storage.getBucket(bucket);
    assert.equal(metadata.data?.public, false);
    const direct = await fetch(`${config.backendEnv.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`, { signal: AbortSignal.timeout(20_000) });
    assert.ok(!direct.ok, 'Anonymous public-object download must fail');
    const denied = await outsiderStorage.storage.from(bucket).download(path);
    assert.ok(denied.error, 'Unrelated identity must not read storage directly');
    const mint = await outsiderStorage.storage.from(bucket).createSignedUrl(path, 60);
    assert.ok(mint.error, 'Unrelated identity must not mint a signed URL');
    assert.ok(url);
    const copied = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    assert.equal(copied.status, 200, 'Signed links are bearer capabilities until expiry');
    const claims = JSON.parse(Buffer.from(new URL(url).searchParams.get('token').split('.')[1], 'base64url').toString());
    results.push({ bucket, anonymousPublicReadDenied: true, unrelatedReadDenied: true, unrelatedMintDenied: true,
      copiedSignedLinkReadable: true, signedLifetimeSeconds: claims.exp - claims.iat });
  }
  return { checks: results, limitation: 'Copied signed URLs remain readable until expiry; these are bearer links, not session-bound downloads. Expiry timing is not yet exercised.' };
}
