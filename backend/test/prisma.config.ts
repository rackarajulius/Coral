import { defineConfig } from 'prisma/config';

// Separate from the application's CLI config: no implicit .env loading.
export default defineConfig({
  schema: '../prisma/schema.prisma',
  datasource: { url: process.env.TEST_DATABASE_URL! },
});
