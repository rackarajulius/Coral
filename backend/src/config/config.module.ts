import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './database.config';
import elasticsearchConfig from './elasticsearch.config';
import redisConfig from './redis.config';
import supabaseConfig from './supabase.config';

/**
 * Note on FRONTEND_URL: it is where the app runs in the BROWSER, and every
 * link the backend builds starts with it — Stripe checkout and portal returns,
 * emails, team invitations, interview rooms, OAuth callbacks. In dev that is
 * http://localhost:8081 (see vite.config.ts), not the Vite default 5173, and
 * in production it is the real domain. A stale value sends people to a port
 * that isn't serving anything, which looks like a broken link rather than a
 * misconfiguration.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [databaseConfig, supabaseConfig, elasticsearchConfig, redisConfig],
    }),
  ],
})
export class AppConfigModule {}

