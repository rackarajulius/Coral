# Loavable Backend API

NestJS backend for the Loavable Job Platform with Supabase authentication.

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma 7
- **Authentication**: Supabase Auth (OAuth 2.0)
- **Language**: TypeScript

## Project Structure

```
backend/
  prisma/
    schema.prisma      # Database schema (no url field in Prisma 7)
    triggers.sql       # Database triggers for Supabase
  prisma.config.ts     # Prisma 7 configuration file
  src/
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      guards/
        jwt-auth.guard.ts
        roles.guard.ts
    common/
      decorators/
        public.decorator.ts
        roles.decorator.ts
        current-user.decorator.ts
      types/
        user.types.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    supabase/
      supabase.module.ts
      supabase.service.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
    app.module.ts
    main.ts
  .env
  .env.example
  package.json
  tsconfig.json
  nest-cli.json
```

## Prisma 7 Configuration

Prisma 7 moved connection configuration out of `schema.prisma`. The setup now requires:

1. **`prisma.config.ts`** - Configuration file for migrations
2. **Adapter pattern** - Pass database connection to `PrismaClient` constructor

### Schema (No URL)

```prisma
datasource db {
  provider = "postgresql"
  // No url field in Prisma 7
}
```

### Config File (prisma.config.ts)

```typescript
import { defineConfig } from 'prisma/config';
import { env } from 'process';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    development: {
      url: env.DATABASE_URL!,
    },
  },
});
```

### Client Initialization with Adapter

```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string from Supabase
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_JWT_SECRET` - Supabase JWT secret

### 3. Set Up Database

Generate Prisma client:

```bash
npm run prisma:generate
```

Run migrations (when you have database access):

```bash
npm run prisma:migrate
```

### 4. Run Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3001/api/v1`

## Authentication

### OAuth Flow

1. Frontend initiates OAuth login via Supabase client
2. User authenticates with provider (Google, LinkedIn, GitHub)
3. Provider redirects to Supabase callback
4. Supabase creates/updates user and redirects to frontend
5. Frontend receives tokens and stores them
6. API requests include Bearer token in Authorization header
7. Backend validates token with Supabase and attaches user to request

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/auth/verify` | Health check | Public |
| GET | `/auth/me` | Get current user | Required |
| POST | `/auth/role` | Update user role | Required |
| POST | `/auth/onboarding` | Complete onboarding | Required |
| POST | `/auth/deactivate` | Deactivate account | Required |
| GET | `/users/:id` | Get public profile | Public |
| GET | `/users/me/profile` | Get full profile | Required |
| PATCH | `/users/me` | Update profile | Required |

### Guards & Decorators

#### @Public()
Mark a route as public (no authentication required):

```typescript
@Public()
@Get('health')
getHealth() {
  return { status: 'ok' };
}
```

#### @Roles()
Specify required roles for a route:

```typescript
@Roles(UserRole.ADMIN)
@Get('admin/users')
getUsers() {
  return this.usersService.findAll();
}
```

#### @CurrentUser()
Extract the current user from the request:

```typescript
@Get('me')
getCurrentUser(@CurrentUser() user: User) {
  return user;
}

// Get specific property
@Get('my-id')
getMyId(@CurrentUser('id') userId: string) {
  return { id: userId };
}
```

## Database Schema

### User Roles

- `JOB_SEEKER` - Candidates looking for jobs
- `EMPLOYER` - Recruiters and hiring managers
- `FREELANCER` - Gig workers
- `ADMIN` - Platform administrators

### User Status

- `ACTIVE` - Active user
- `INACTIVE` - Deactivated account
- `SUSPENDED` - Suspended account
- `PENDING_ONBOARDING` - New user, needs to complete profile

### Profile Types

Each role has a dedicated profile table:
- `job_seeker_profiles` - Work experience, education, skills
- `employer_profiles` - Company information
- `freelancer_profiles` - Skills, hourly rate, portfolio

## Development

### Scripts

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio

# Testing
npm run test
npm run test:cov
npm run test:e2e
```

### Adding New Modules

```bash
npx nest g module feature-name
npx nest g controller feature-name
npx nest g service feature-name
```

## Deployment

1. Set production environment variables
2. Run database migrations
3. Build the application: `npm run build`
4. Start with: `npm run start:prod`

## License

ISC