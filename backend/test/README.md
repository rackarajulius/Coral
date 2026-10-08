# Backend regression tests

From `backend/`:

```sh
npm ci
npm run prisma:generate
npm test -- --runInBand
npm run test:typecheck
```

The HTTP and database integration suites need PostgreSQL and an explicit `TEST_DATABASE_URL`.
Use a dedicated test database and a **session connection**, not a transaction
pooler. The database user must be able to create and drop schemas.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/coral_test'
npm run test:e2e
```

On Linux/macOS, use `TEST_DATABASE_URL='postgresql://...' npm run test:e2e`.
Missing configuration fails the suite; it does not silently skip tests.

Each suite generates a unique `coral_e2e_<uuid>` schema from the current Prisma
schema, creates its own users and companies, and drops only that schema at
teardown (including test failures). It does not reset databases, use existing
application rows, or run background schedulers. A forcibly killed process can
leave its test schema behind. The suites normally check the current data model,
not the production migration history. `provider-migration.e2e-spec.ts` additionally
rehearses the actual Phase 1 additive migration on synthetic legacy rows inside
its owned schema. It does not rehearse all historical migrations or production data.

The hiring suite starts a real Nest HTTP server on an ephemeral localhost port.
It uses the production controllers, authentication/role/seat guards, validation,
application, job publishing, interview and offer services, company scoping, notification persistence, and
PostgreSQL transactions. External identity verification is replaced with fixture
tokens; Slack delivery is stubbed. Email delivery and Google, Microsoft and Zoom
network boundaries are mocked; the real calendar routing service runs against
fixture credentials. Storage and unrelated ATS/AI routes are outside its scope.

Coverage includes application submission and duplication, application-to-shortlist
linking, screening/interview **stage changes**, offer draft privacy, offer sending,
acceptance/decline, expiry/withdrawal restrictions, company isolation, and read-only
seat restrictions. It also checks that conflicting offer responses cannot both
commit or reopen a withdrawn application. Sourced cards are fixtures.

The publishing/scheduling suite creates jobs through HTTP, publishes and pauses
them, applies as a candidate, and checks verification, company and seat restrictions
(including publishing through edits and duplication). It exercises invitation
acceptance, invalid/expired time rejection, competing responses, self-service
booking contention, calendar routing, booked duration in provider calls and ICS,
manual links, disconnected calendars, provider failure, teammate cancellation,
provider switching, and cancellation during calendar creation. Cancelled bookings
close their availability slot; employers publish a new slot to offer that time again.

The AI scoring suite runs the real screening and AI response-validation services
with controlled model responses. It checks valid score persistence, employer-only
scorecard visibility, unscored/retryable failures, answer counts, live consent and
assigned questions, concurrent completion, decline during scoring, and unscored
video review. Unit tests reject invalid numeric scores, inconsistent recommendations,
misaligned question results and missing/duplicate/invented match IDs. They also
check that spoken-language and untrusted-input instructions reach the model boundary.

The billing suite uses signed HTTP webhook payloads with the real signature verifier,
subscription handler and database. Stripe REST responses are mocked. Coverage includes
owner-only payment access, concurrent customer binding, checkout without paid access,
exact raw-body verification, expired/forged signatures, processed-event replay,
delayed subscription snapshots, retry after provider failure, replacement-subscription
protection and invoice events leaving access unchanged. Subscription updates fetch
current Stripe state while holding a company-scoped database lock. No schema migration
is required. This does not establish exactly-once processing of all payment side effects
or simultaneous invoice deliveries; those paths still need separate coverage.

The community suite invokes the production post/comment services against an isolated
PostgreSQL schema. It covers removed-parent denial, nested discussion filtering,
removed-source reshare redaction, explicit restoration, stale-read rejection and
counter rollback, plus normal reply creation and thread deletion. It does not start
the community HTTP controllers, exercise auth guards, or prove every concurrent
moderation/deletion schedule. Identity/media/notification delivery remain outside
this suite; the fixtures use an author discussing their own content.

These suites do not test live calendar/email delivery, model accuracy or fairness,
browser UI, Supabase login, live Stripe checkout, or production load. Live provider acceptance
still needs connected test accounts. No schema migration is required for the
scheduling changes; booked duration comes from the linked availability slot.

`.github/workflows/backend-tests.yml` runs typechecking, unit tests and this suite
against a disposable PostgreSQL service for backend pushes and pull requests.
