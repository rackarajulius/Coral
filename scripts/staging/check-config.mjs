import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PLACEHOLDER = /replace[-_ ]with|your[-_ ]|\[[^\]]+\]|example\.(?:com|org)|changeme|placeholder/i;
const FRONTEND_FIELDS = new Set([
  'CORAL_STAGING', 'STAGING_FRONTEND_ORIGIN', 'VITE_API_URL',
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_GOOGLE_CLIENT_ID',
  'VITE_SOCIAL_AUTH_PROVIDERS',
]);

const issue = (field, message) => ({ field, message });
const valueOf = (env, field) => typeof env[field] === 'string' ? env[field].trim() : '';
const absolutePath = (rootDir, path) => isAbsolute(path) ? path : resolve(rootDir, path);

/** Reads dedicated files only; never merges the shell or normal application env. */
export function loadStagingConfig(options = {}) {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT);
  const paths = {
    frontend: absolutePath(rootDir, options.frontendPath ?? 'staging/frontend.env.local'),
    backend: absolutePath(rootDir, options.backendPath ?? 'staging/backend.env.local'),
    development: absolutePath(rootDir, options.developmentPath ?? '.env'),
    developmentLocal: absolutePath(rootDir, '.env.local'),
    developmentBackend: absolutePath(rootDir, 'backend/.env'),
    developmentBackendLocal: absolutePath(rootDir, 'backend/.env.local'),
  };
  const issues = [];
  const read = (path, field, optional = false) => {
    try {
      return parseEnv(readFileSync(path, 'utf8'));
    } catch (error) {
      if (optional && error?.code === 'ENOENT') return {};
      issues.push(issue(field, error?.code === 'ENOENT'
        ? 'Configuration file is missing; copy its staging example and fill the staging values.'
        : 'Configuration file could not be read or parsed.'));
      return {};
    }
  };
  const frontendEnv = read(paths.frontend, 'staging/frontend.env.local');
  const backendEnv = read(paths.backend, 'staging/backend.env.local');
  const developmentEnvs = [
    read(paths.development, '.env', true),
    read(paths.developmentLocal, '.env.local', true),
    read(paths.developmentBackend, 'backend/.env', true),
    read(paths.developmentBackendLocal, 'backend/.env.local', true),
  ];
  const developmentProjectRefs = [...new Set(developmentEnvs.flatMap((env) => [
    projectRef(valueOf(env, 'VITE_SUPABASE_URL')),
    projectRef(valueOf(env, 'SUPABASE_URL')),
    databaseProjectRef(valueOf(env, 'DATABASE_URL')),
    databaseProjectRef(valueOf(env, 'DIRECT_URL')),
  ]).filter(Boolean))];
  const developmentProjectRef = developmentProjectRefs[0] ?? null;
  return { frontendEnv, backendEnv, developmentProjectRef, developmentProjectRefs, issues, paths };
}

function safeUrl(value) {
  try { return new URL(value); } catch { return null; }
}

function projectRef(value) {
  const url = safeUrl(value);
  const match = url?.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  return match?.[1] ?? null;
}

function databaseProjectRef(value) {
  const url = safeUrl(value);
  if (!url || !['postgresql:', 'postgres:'].includes(url.protocol)) return null;
  const direct = url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) return direct[1];
  if (!/(?:^|\.)pooler\.supabase\.com$/.test(url.hostname)) return null;
  try { return decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1] ?? null; }
  catch { return null; }
}

function claims(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch { return null; }
}

function validateKey(key, role, expectedRef, field, issues) {
  if (!key || PLACEHOLDER.test(key)) {
    issues.push(issue(field, 'Provide the corresponding key from the separate staging Supabase project.'));
    return;
  }
  const payload = claims(key);
  const modern = role === 'anon' ? /^sb_publishable_[A-Za-z0-9_-]+$/ : /^sb_secret_[A-Za-z0-9_-]+$/;
  if (!payload && !modern.test(key)) {
    issues.push(issue(field, 'Use a Supabase publishable/anon key or server secret/service-role key of the required kind.'));
  } else if (payload) {
    if (payload.role !== role) issues.push(issue(field, 'The encoded Supabase key role does not match this field.'));
    if (payload.ref && payload.ref !== expectedRef) issues.push(issue(field, 'The encoded Supabase project does not match the staging project.'));
  }
}

/** Structural isolation checks, not a network test or proof that credentials work. */
export function validateStagingConfig(config = {}) {
  const frontend = config.frontendEnv ?? {};
  const backend = config.backendEnv ?? {};
  const issues = [...(config.issues ?? [])];
  const warnings = [];
  const required = (env, field, label = field) => {
    const value = valueOf(env, field);
    if (!value || PLACEHOLDER.test(value)) issues.push(issue(label, 'A non-placeholder staging value is required.'));
    return value;
  };
  const marker = (env, label) => {
    if (env.CORAL_STAGING !== 'true') issues.push(issue(label, 'Must be exactly true for this isolated staging starter.'));
  };
  marker(frontend, 'frontend.CORAL_STAGING');
  marker(backend, 'backend.CORAL_STAGING');
  const expectedRef = required(backend, 'STAGING_SUPABASE_PROJECT_REF');
  if (expectedRef && !/^[a-z0-9]{20}$/.test(expectedRef)) {
    issues.push(issue('STAGING_SUPABASE_PROJECT_REF', 'Use the twenty-character Supabase staging project reference.'));
  }
  const developmentRefs = [...new Set([...(config.developmentProjectRefs ?? []), config.developmentProjectRef].filter(Boolean))];
  if (developmentRefs.includes(expectedRef)) {
    issues.push(issue('STAGING_SUPABASE_PROJECT_REF', 'Staging must use a different Supabase project from the local development configuration.'));
  } else if (developmentRefs.length === 0) {
    warnings.push(issue('STAGING_SUPABASE_PROJECT_REF', 'Development project comparison is unavailable; independently confirm this is a separate project.'));
  }

  for (const [field, value] of Object.entries(frontend)) {
    if (!FRONTEND_FIELDS.has(field)) {
      issues.push(issue(`frontend.${field}`, 'This field is not allowed in the browser configuration; keep private settings server-only.'));
    }
    if (typeof value === 'string' && (/^sb_secret_|^sk_(?:test|live)_/.test(value.trim()) || claims(value.trim())?.role === 'service_role')) {
      issues.push(issue(`frontend.${field}`, 'A server secret cannot be included in browser configuration.'));
    }
  }
  const socialProviders = frontend.VITE_SOCIAL_AUTH_PROVIDERS;
  if (socialProviders !== undefined && (typeof socialProviders !== 'string'
    || socialProviders.split(',').some((provider) => provider.trim()
      && !['google', 'apple', 'facebook'].includes(provider.trim())))) {
    issues.push(issue('VITE_SOCIAL_AUTH_PROVIDERS', 'List only configured google, apple or facebook providers, separated by commas; leave blank for email only.'));
  }
  for (const [side, env] of [['frontend', frontend], ['backend', backend]]) {
    for (const [field, value] of Object.entries(env)) {
      if (typeof value === 'string' && /^(?:sk|pk|rk)_live_/.test(value.trim())) {
        issues.push(issue(`${side}.${field}`, 'Live Stripe keys are not allowed in staging.'));
      }
    }
  }

  const supabaseFields = [
    [frontend, 'VITE_SUPABASE_URL'], [backend, 'SUPABASE_URL'],
  ];
  for (const [env, field] of supabaseFields) {
    const raw = required(env, field);
    const url = safeUrl(raw);
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || !['', '/'].includes(url.pathname) || projectRef(raw) !== expectedRef) {
      issues.push(issue(field, 'Must be the HTTPS Supabase URL for the explicitly declared staging project.'));
    }
  }
  const frontendAnon = valueOf(frontend, 'VITE_SUPABASE_ANON_KEY');
  const backendAnon = valueOf(backend, 'SUPABASE_ANON_KEY');
  validateKey(frontendAnon, 'anon', expectedRef, 'VITE_SUPABASE_ANON_KEY', issues);
  validateKey(backendAnon, 'anon', expectedRef, 'SUPABASE_ANON_KEY', issues);
  validateKey(valueOf(backend, 'SUPABASE_SERVICE_ROLE_KEY'), 'service_role', expectedRef, 'SUPABASE_SERVICE_ROLE_KEY', issues);
  if (frontendAnon && backendAnon && frontendAnon !== backendAnon) {
    issues.push(issue('SUPABASE_ANON_KEY', 'Frontend and backend must use the same staging publishable/anon key.'));
  }

  for (const field of ['DATABASE_URL', 'DIRECT_URL']) {
    const raw = required(backend, field);
    const url = safeUrl(raw);
    const protocolAllowed = url && ['postgresql:', 'postgres:'].includes(url.protocol);
    let username = '';
    let password = '';
    try {
      username = decodeURIComponent(url?.username ?? '');
      password = decodeURIComponent(url?.password ?? '');
    } catch { /* Validation below rejects invalid credential encoding. */ }
    const direct = url?.hostname === `db.${expectedRef}.supabase.co` && username === 'postgres';
    const pooled = /(?:^|\.)pooler\.supabase\.com$/.test(url?.hostname ?? '') && username === `postgres.${expectedRef}`;
    if (!protocolAllowed || !password || PLACEHOLDER.test(password) || !url?.pathname || url.pathname === '/'
      || (!direct && !pooled) || url?.hash) {
      issues.push(issue(field, 'Use a password-bearing PostgreSQL URL belonging to the declared staging Supabase project.'));
    }
    if (field === 'DIRECT_URL' && url?.port === '6543') {
      issues.push(issue(field, 'Prisma migrations require a direct/session connection, not transaction-pooler port 6543.'));
    }
  }

  const origin = (env, field) => {
    const raw = required(env, field);
    const url = safeUrl(raw);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url?.hostname ?? '');
    if (!url || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))
      || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
      issues.push(issue(field, 'Use an HTTPS origin or a loopback HTTP origin, without credentials or a path.'));
      return null;
    }
    return url;
  };
  const frontendOrigin = origin(frontend, 'STAGING_FRONTEND_ORIGIN');
  const backendFrontend = origin(backend, 'FRONTEND_URL');
  const apiOrigin = origin(backend, 'STAGING_API_ORIGIN');
  if (frontendOrigin && backendFrontend && frontendOrigin.origin !== backendFrontend.origin) {
    issues.push(issue('FRONTEND_URL', 'Must match the declared staging frontend origin.'));
  }
  const portRaw = valueOf(backend, 'PORT');
  const port = Number(portRaw);
  if (!/^\d+$/.test(portRaw) || !Number.isInteger(port) || port < 1 || port > 65535
    || (apiOrigin && Number(apiOrigin.port || (apiOrigin.protocol === 'https:' ? 443 : 80)) !== port)) {
    issues.push(issue('PORT', 'Use a valid server port matching STAGING_API_ORIGIN.'));
  }
  if (backend.NODE_ENV !== 'production') issues.push(issue('NODE_ENV', 'Must be production for staging acceptance of the production build.'));
  if (backend.HOST !== '127.0.0.1') issues.push(issue('HOST', 'Must be 127.0.0.1 so this local staging starter binds to loopback only.'));
  if (backend.API_PREFIX !== 'api/v1') issues.push(issue('API_PREFIX', 'Must be api/v1 for this staging starter.'));
  const apiUrl = safeUrl(required(frontend, 'VITE_API_URL'));
  if (!apiUrl || !apiOrigin || apiUrl.origin !== apiOrigin.origin || apiUrl.pathname !== '/api/v1'
    || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
    issues.push(issue('VITE_API_URL', 'Must match the staging API origin and /api/v1 prefix.'));
  }
  const cors = valueOf(backend, 'CORS_ORIGINS').split(',').map((entry) => entry.trim()).filter(Boolean);
  if (!frontendOrigin || cors.length !== 1 || cors[0] !== frontendOrigin.origin) {
    issues.push(issue('CORS_ORIGINS', 'Must contain only the exact staging frontend origin for this starter.'));
  }
  const oauthRedirect = valueOf(backend, 'OAUTH_REDIRECT_URL');
  if (oauthRedirect && (!frontendOrigin || safeUrl(oauthRedirect)?.origin !== frontendOrigin.origin)) {
    issues.push(issue('OAUTH_REDIRECT_URL', 'Must use the staging frontend origin.'));
  }
  for (const field of ['MARKETPLACE_LISTING_WRITES_ENABLED', 'MARKETPLACE_ENQUIRIES_ENABLED', 'SCHEDULED_JOBS_ENABLED', 'STRIPE_AUTOMATIC_TAX']) {
    if (!['true', 'false'].includes(backend[field])) {
      issues.push(issue(field, 'Must be exactly true or false.'));
    }
  }
  const adminEmail = valueOf(backend, 'DEFAULT_ADMIN_EMAIL');
  if (adminEmail && (PLACEHOLDER.test(adminEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))) {
    issues.push(issue('DEFAULT_ADMIN_EMAIL', 'Leave blank or use a real staging administrator email; placeholder promotion is unsafe.'));
  }
  if (valueOf(backend, 'STRIPE_SECRET_KEY') && !/^sk_test_/.test(valueOf(backend, 'STRIPE_SECRET_KEY'))) {
    issues.push(issue('STRIPE_SECRET_KEY', 'If payment testing is enabled, use a Stripe test key.'));
  }
  if (valueOf(backend, 'STRIPE_PUBLISHABLE_KEY') && !/^pk_test_/.test(valueOf(backend, 'STRIPE_PUBLISHABLE_KEY'))) {
    issues.push(issue('STRIPE_PUBLISHABLE_KEY', 'If payment testing is enabled, use a Stripe test publishable key.'));
  }

  return {
    ok: issues.length === 0, issues, warnings,
    metadata: {
      projectRef: /^[a-z0-9]{20}$/.test(expectedRef) ? expectedRef : null,
      frontendOrigin: frontendOrigin?.origin ?? null,
      frontendPort: frontendOrigin ? Number(frontendOrigin.port || (frontendOrigin.protocol === 'https:' ? 443 : 80)) : null,
      apiOrigin: apiOrigin?.origin ?? null,
      apiPort: Number.isInteger(port) && port > 0 && port <= 65535 ? port : null,
      apiPrefix: 'api/v1',
      listingWritesEnabled: backend.MARKETPLACE_LISTING_WRITES_ENABLED === 'true',
      enquiriesEnabled: backend.MARKETPLACE_ENQUIRIES_ENABLED === 'true',
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = validateStagingConfig(loadStagingConfig());
  for (const entry of result.issues) console.error(`${entry.field}: ${entry.message}`);
  for (const entry of result.warnings) console.warn(`${entry.field}: ${entry.message}`);
  console.log(result.ok ? 'Staging configuration checks passed. Credentials and live authentication still need verification.' : 'Staging configuration checks failed. No connection or deployment was attempted.');
  process.exitCode = result.ok ? 0 : 1;
}
