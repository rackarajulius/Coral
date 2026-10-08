# Phase 0 verification results

Recorded on 7 October 2026 (Africa/Kampala), using the dependencies already installed in this checkout. No dependency installation, application database connection, production migration, or external-provider operation was performed.

## Completed checks

| Check | Command and directory | Result |
| --- | --- | --- |
| Frontend TypeScript | `npm run typecheck`, repository root | Passed, exit 0. |
| Frontend production build | `npm run build`, repository root | Passed, exit 0; 11,317 modules transformed in 151.2 seconds. |
| Backend production build | `npm run build`, `backend/` | Passed, exit 0, including the final Phase 0 community moderation changes. |
| Backend test TypeScript | `npm run test:typecheck`, `backend/` | Passed, exit 0, including the final community database tests and the shared HTTP fixture compatibility correction. |
| Backend unit regression suite | `npm test -- --runInBand`, `backend/` | Passed: 13 suites, 142 tests, no snapshots; 9.248 seconds. Includes `phase0-baseline.spec.ts` and the final 18 cases in `moderated-content-boundaries.spec.ts`. |
| Community database/service integration | `npm run test:e2e -- --runInBand`, `backend/`, with explicit `TEST_DATABASE_URL` | `community.e2e-spec.ts` passed: 7 cases; 17.993 seconds. Runs real PostgreSQL and community services; does not exercise community HTTP routing or authentication. |
| Existing HTTP integration suites | `npm run test:e2e -- --runInBand --runTestsByPath test/hiring.e2e-spec.ts test/publishing-scheduling.e2e-spec.ts test/ai-scoring.e2e-spec.ts test/billing.e2e-spec.ts`, `backend/`, with explicit `TEST_DATABASE_URL` | Passed: 4 suites, 33 tests, no snapshots; 70.176 seconds. Exercises real HTTP routing, validation, guards, service logic and PostgreSQL with mocked external delivery boundaries. |

The Stripe client unit test deliberately logs a mocked provider error while asserting safe error handling. That output is not a test failure.

Across the completed integration runs, all five integration suites and 40 cases pass. The first complete run passed the seven community database cases but failed all 33 existing HTTP cases during shared fixture bootstrap, before any HTTP assertions: `ApplicationsController` had acquired an `ExternalApplicationsService` dependency that `test/support/hiring-app.ts` did not register. Importing and registering the existing real service corrected that test-fixture drift. Test TypeScript and only the four failed HTTP suites were rerun after this two-line fixture correction. Already-passed community integration and unrelated checks were not repeated.

The community database cases cover removed comments/replies, removed post access and restoration, reshare redaction, removed reply parents, ordinary reply/deletion behavior, and controlled stale-read rejection with rollback. They establish these functional boundaries against real PostgreSQL; they do not exhaustively prove every concurrent execution schedule.

## Existing build warnings

- Browserslist reports that its bundled browser data is seven months old. The baseline did not update it.
- The minified main JavaScript bundle is 5,333.51 kB (1,422.71 kB gzip), above the 500 kB warning threshold. The build succeeds; code splitting remains a separate performance task.

## Local runtime constraints

The initial attempt ran the two builds, two typechecks, and Jest concurrently. A subsequent read-only PowerShell inventory reported insufficient memory. The frontend build exited while transforming, and the backend build and Jest failed with Node `UNKNOWN` file-read errors (`errno -4094`). Both original typechecks eventually passed. Retrying the failed checks one at a time succeeded. These initial failures were environmental, not reproducible source-code failures. Future local verification should run heavy checks sequentially on this machine.

## Integration database isolation

- `backend/test/support/database.ts` requires `TEST_DATABASE_URL` and does not load the application's `.env`.
- Each suite creates a generated `coral_e2e_<uuid>` schema, creates fixture records, and drops only its owned schema. It does not reset the database or run application schedulers.
- The dedicated local workspace cluster is `backend/.postgres-test.local/data`; embedded PostgreSQL executables are already installed in its local `node_modules`.
- Before launch, `pg_ctl status` reported no server running, there was no PostgreSQL process, and `TEST_DATABASE_URL` was absent. Cluster contents and credentials were not printed.
- The initial non-destructive sandboxed start with explicit `127.0.0.1:55432` failed with `could not create restricted token: error code 87` and `could not start server: error code 3`. The approved escalated retry started the existing cluster without reset or reinitialization.
- Read-only SQL verified the `postgres` database, loopback address `127.0.0.1`, port `55432`, and data directory `C:/coral/coral/backend/.postgres-test.local/data`. A password-free local fixture connection worked; application credentials were never read or used. `host(inet_server_addr())` was used for address comparison because the inet-to-text form can include a netmask.
- Integration execution set only process-scoped `TEST_DATABASE_URL` for this verified server. The application's `DATABASE_URL` was not used. Owned fixture schemas were cleaned by their guarded teardown; the test server was stopped after verification.

After verification, the dedicated test server was stopped with `pg_ctl stop` against the same workspace data directory. A sandbox stop attempt was denied by operating-system process permissions; the approved stop succeeded and reported `server stopped`. The cluster was preserved for future isolated tests.

These checks do not establish browser interaction correctness, live identity/payment/calendar/video delivery, production migration compatibility, performance under load, or service-marketplace functionality that has not yet been implemented.
