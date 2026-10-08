import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStagingConfig, validateStagingConfig } from './check-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COMMANDS = new Set(['build', 'api', 'web', 'db-status', 'migrate']);
const OS_FIELDS = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP',
  'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'HOME',
  'LANG', 'LC_ALL', 'NO_COLOR', 'FORCE_COLOR', 'CI', 'NUMBER_OF_PROCESSORS',
]);

// Never inherit DATABASE_URL, VITE_*, provider credentials or NODE_OPTIONS.
export function childEnvironment(stagingEnv, inherited = process.env) {
  const env = Object.fromEntries(Object.entries(inherited)
    .filter(([key]) => OS_FIELDS.has(key.toUpperCase())));
  return { ...env, ...stagingEnv, NODE_ENV: 'production' };
}

export function frontendFingerprint(frontendEnv) {
  const entries = Object.entries(frontendEnv).sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

export function requireCleanRuntime(directory) {
  if (['.env', '.env.local'].some((name) => existsSync(resolve(directory, name)))) {
    throw new Error('The staging runtime directory contains an application env file. Remove that file before starting staging.');
  }
}

/** All commands use installed CLIs directly, including on Windows. */
export function createStagingPlan(command, config, result, rootDir = ROOT) {
  if (!COMMANDS.has(command)) throw new Error('Use build, api, web, db-status or migrate.');
  if (!result.ok) throw new Error('Staging configuration must pass before any command runs.');
  const { metadata } = result;
  for (const origin of [metadata.frontendOrigin, metadata.apiOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
      throw new Error('This local staging starter requires http://127.0.0.1 origins. Hosted staging needs its own host configuration.');
    }
  }
  if (config.backendEnv.HOST !== '127.0.0.1') throw new Error('Local staging requires HOST=127.0.0.1.');
  if (metadata.frontendPort === metadata.apiPort) throw new Error('Frontend and API staging ports must differ.');
  const paths = {
    runtime: resolve(rootDir, '.staging.local/api-runtime'),
    manifest: resolve(rootDir, '.staging.local/build.json'),
    backendEntry: resolve(rootDir, 'backend/.staging.local/dist/main.js'),
    frontend: resolve(rootDir, '.staging.local/frontend'),
  };
  const frontendEnv = childEnvironment(config.frontendEnv);
  const backendEnv = childEnvironment(config.backendEnv);
  const compileEnv = childEnvironment({});
  const vite = resolve(rootDir, 'node_modules/vite/bin/vite.js');
  const prisma = resolve(rootDir, 'backend/node_modules/prisma/build/index.js');
  const prismaConfig = resolve(rootDir, 'scripts/staging/prisma.config.ts');
  const viteConfig = resolve(rootDir, 'scripts/staging/vite.config.ts');
  const tsc = resolve(rootDir, 'backend/node_modules/typescript/bin/tsc');
  const step = (label, args, env, cwd = rootDir) => ({ label, args, env, cwd });
  let steps;
  if (command === 'build') {
    steps = [
      step('Generate the matching Prisma client', [prisma, 'generate', '--config', prismaConfig], backendEnv),
      step('Compile the staging API', [tsc, '--project', resolve(rootDir, 'scripts/staging/tsconfig.backend.json')], compileEnv),
      step('Build the staging website', [vite, 'build', '--config', viteConfig, '--mode', 'staging'], frontendEnv),
    ];
  } else if (command === 'api') {
    steps = [step('Start the staging API and scheduled jobs', [paths.backendEntry], backendEnv, paths.runtime)];
  } else if (command === 'web') {
    steps = [step('Serve the staging production website', [vite, 'preview', '--config', viteConfig, '--mode', 'staging',
      '--host', '127.0.0.1', '--port', String(metadata.frontendPort), '--strictPort'], frontendEnv)];
  } else {
    steps = [step(command === 'migrate' ? 'Apply staging database migrations' : 'Inspect staging migration status',
      [prisma, 'migrate', command === 'migrate' ? 'deploy' : 'status', '--config', prismaConfig], backendEnv)];
  }
  return { command, paths, steps, frontendFingerprint: frontendFingerprint(config.frontendEnv) };
}

function requireBuild(plan) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(plan.paths.manifest, 'utf8')); } catch {
    throw new Error('Run npm run staging:build successfully before starting staging.');
  }
  if (manifest.frontendFingerprint !== plan.frontendFingerprint) {
    throw new Error('Staging browser configuration changed. Run npm run staging:build again.');
  }
  if (!existsSync(plan.paths.backendEntry) || !existsSync(resolve(plan.paths.frontend, 'index.html'))) {
    throw new Error('A staging build artifact is missing. Run npm run staging:build again.');
  }
}

async function runStep(step) {
  console.log(step.label);
  const child = spawn(process.execPath, step.args, { cwd: step.cwd, env: step.env, stdio: 'inherit', shell: false });
  const stop = (signal) => { child.kill(signal); };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  try {
    await new Promise((done, reject) => {
      child.once('error', () => reject(new Error('Unable to launch the installed staging command. Check local dependencies.')));
      child.once('exit', (code, signal) => code === 0 ? done() : reject(new Error(signal
        ? 'The staging command was stopped.' : `The staging command exited with code ${code}.`)));
    });
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
  }
}

export async function main(args = process.argv.slice(2)) {
  const [command, ...options] = args;
  if (!COMMANDS.has(command) || options.some((option) => !['--dry-run', '--apply'].includes(option))) {
    throw new Error('Usage: node scripts/staging/run.mjs <build|api|web|db-status|migrate> [--dry-run] [--apply]');
  }
  const config = loadStagingConfig();
  const result = validateStagingConfig(config);
  for (const entry of result.issues) console.error(`${entry.field}: ${entry.message}`);
  for (const entry of result.warnings) console.warn(`${entry.field}: ${entry.message}`);
  const plan = createStagingPlan(command, config, result);
  if (options.includes('--dry-run')) {
    for (const step of plan.steps) console.log(`Ready: ${step.label}`);
    console.log('Dry run complete. No build, connection, server or database change was attempted.');
    return;
  }
  if (command === 'migrate' && !options.includes('--apply')) {
    throw new Error('Migration changes the declared staging database. After reviewing staging:check and staging:db-status, run npm run staging:migrate -- --apply.');
  }
  if (command === 'api' || command === 'web') requireBuild(plan);
  if (command === 'api') {
    mkdirSync(plan.paths.runtime, { recursive: true });
    requireCleanRuntime(plan.paths.runtime);
  }
  if (command === 'build') {
    mkdirSync(dirname(plan.paths.manifest), { recursive: true });
    // Invalidate any previous successful build before starting compilation.
    writeFileSync(plan.paths.manifest, JSON.stringify({ building: true }) + '\n');
  }
  for (const step of plan.steps) await runStep(step);
  if (command === 'build') {
    writeFileSync(plan.paths.manifest, JSON.stringify({
      builtAt: new Date().toISOString(), frontendFingerprint: plan.frontendFingerprint,
    }, null, 2) + '\n');
    console.log('Staging build ready. Use separate terminals for staging:api and staging:web.');
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
