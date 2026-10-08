import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import appConfig from '../../vite.config';

const root = resolve(import.meta.dirname, '../..');

export default defineConfig((environment) => {
  const base = typeof appConfig === 'function' ? appConfig(environment) : appConfig;
  return {
    ...base,
    root,
    // Only the launcher's validated browser settings enter this bundle.
    envDir: false,
    build: { outDir: resolve(root, '.staging.local/frontend'), emptyOutDir: true },
    preview: {
      host: '127.0.0.1', strictPort: true,
      headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' },
    },
  };
});
