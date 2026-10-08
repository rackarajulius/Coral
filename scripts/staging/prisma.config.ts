import { defineConfig } from '../../backend/node_modules/prisma/config.js';
import { resolve } from 'node:path';

// CLI entry is the validated launcher, not the normal dotenv-loading config.
if (process.env.CORAL_STAGING !== 'true' || !process.env.DIRECT_URL) {
  throw new Error('Run Prisma through the staging launcher with validated staging configuration.');
}
const root = resolve(import.meta.dirname, '../..');
export default defineConfig({
  schema: resolve(root, 'backend/prisma/schema.prisma'),
  migrations: { path: resolve(root, 'backend/prisma/migrations') },
  datasource: { url: process.env.DIRECT_URL },
});
