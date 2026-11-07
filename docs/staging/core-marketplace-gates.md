# Core marketplace staging gates

Started 9 October; continued 10 October 2026. This is the active checkpoint for **staging acceptance → cohort release → outcome measurement and pilot operation**. Live Tides remains separately gated. The historical Phase 1–3 handoffs describe local implementation; the [staging setup record](review-and-setup.md) contains the later hosted-database and real-account evidence.

## Release decision

**Not yet released to the cohort.** The saved listing/enquiry flags remain off. Staging uses Supabase project `gyhmergopdlqygsgjpyb` and a production build served locally; no shareable deployment has been selected. Generated QA activity is not evidence of customer demand or pilot outcomes.

## Work in this checkpoint

- Rechecked dedicated configuration and all 30 staging starter tests. Supabase Auth responded successfully; migration status confirms all 105 saved migrations are applied.
- Restricted the community report queue and every moderation decision to a moderator's current, unarchived Spaces. Active platform administrators retain global access, including reports on posts outside Spaces. Current database role/account/membership checks replace trust in a historical role; the authorization and decision run in the same transaction.
- Added scheduled-outreach authority checks before delivery. Inactive/deleted senders, removed/suspended seats, lost messaging capability and revoked employer verification cancel the queued approach. An authority lookup outage remains retryable and sends nothing. This preserves the existing administrator and legacy sole-employer rules.
- Added six HTTP/PostgreSQL moderation regression cases and thirteen scheduled-outreach authority cases. Storage deletion remains a mocked boundary in the moderation tests.
- A real staged service-publication request returned HTTP 500 after exhausting Prisma's default five-second transaction timeout. Permission-checked listing, delivery and moderation transactions now use the bounded budget already used by private marketplace messages (10-second acquisition, 30-second execution). Publication avoids repeating the same creator check; a different company publisher still requires the original owner's current authority. Regression coverage includes a six-second listing lock and a departed original publisher.
- Added a repeatable real-authentication API acceptance runner and a recovery command for interrupted fixtures. The completed run and its limits are recorded below.

## Hosted-database API acceptance, 10 October

**All 11 checks passed** in run `cd10c4a651384f14b50cb97542962b0b`, from 12:37 to 12:44 UTC. The [credential-free acceptance report](evidence/core-marketplace-api-2026-10-10.json) records the compiled backend hash, frontend build fingerprint, individual results and cleanup. This is a compiled local API using real Supabase authentication and the hosted staging database; it is not browser, deployment or cohort acceptance.

- Real password sessions covered candidate/company onboarding and provider opt-in without changing the employment role.
- Service publication, draft privacy, enquiry idempotency, recipient consent/reply and unrelated-user/colleague/admin private-thread denial passed.
- Company project responses, colleague isolation and removal of the original company participant's access passed.
- Four notification deliveries survived a forced write failure and API restart. Recovery produced exactly four notifications; a repeated worker run added none.
- Unverified job publication was denied. A run-owned verification fixture enabled the synthetic application-to-recruiting-conversation journey.
- Provider-enabled jobseeker closure removed the profile and draft service and invalidated the old sign-in session. No uploaded files were used in this closure check.
- Disabling writes/enquiries still allowed authorized history, reporting, blocking and public-preview withdrawal; new sends were denied. Aggregate metrics remained admin-only.

The runner stopped its API and removed its owned application records and all seven synthetic auth identities, including the already-closed account. Saved staging feature flags remain off. No cohort accounts were admitted or invitations sent.

## Local verification, 10 October

- Dedicated staging production build passed; the backend was rebuilt after the transaction changes. No frontend code changed in this checkpoint.
- Backend test type-check passed. The full backend unit suite passed earlier in this checkpoint (21 suites, 360 tests); the focused community/outreach authority suites were rerun after the final source changes (48 tests passed).
- Four PostgreSQL/HTTP suites passed, 36 tests total: marketplace listings, private requests, platform marketplace moderation and Space-scoped community moderation. This includes the new lock-delay and original-publisher regressions. Each suite owns and drops a separate disposable local schema.
- The disposable test database had zero remaining test schemas and zero other clients after verification; its owned server was stopped.
- The first resumed integration attempt could not connect because its local PostgreSQL server was stopped. Restarting that disposable server and rerunning the same suites produced the passing result above.
- Supabase Auth settings and Storage bucket-list health checks returned HTTP 200. These probes alone do not establish upload or private-file access acceptance.

One hosted API attempt passed the first ten checks, including notification recovery and provider closure, then a withdrawn-profile read returned HTTP 500 with `Connection terminated unexpectedly`. Its fixtures were fully cleaned. This availability incident remains part of the staging record; a later passing run does not replace deployment-level connection monitoring or realistic latency checks. Another attempt timed out during API startup before creating any identities.

## Repeatable staging API acceptance

Build with the dedicated staging configuration, then explicitly select that same project:

```powershell
npm run staging:check
npm run staging:build
npm run staging:verify-marketplace -- --apply --project-ref gyhmergopdlqygsgjpyb
```

The runner creates labelled synthetic Supabase identities, signs in through password authentication, and runs the compiled API on an owned loopback port. It exercises candidate/company onboarding, provider consent, service enquiries, project responses, participant privacy, company-seat revocation, hiring/application conversations, and the feature-disable path. Only its synthetic employer receives a verification fixture; existing companies are never marked verified.

Notification recovery uses a temporary database trigger that rejects notification inserts **only for that run's synthetic participants**. The runner verifies retained pending deliveries, removes the trigger, restarts its API, and invokes the normal leased job twice to check persistence and deduplication. Automatic schedules stay off in the owned API. This tests the runtime job and restart behavior, not a continuously hosted worker, timer ownership across hosts, or every crash schedule.

Each manual worker invocation must report that it acquired the lease and completed. The report retains safe delivery counts and states. Synthetic retry times are moved five minutes into the past before recovery: the hosted database was observed about six seconds ahead of the local worker, so setting a retry to database `now()` did not reliably make it immediately due for the worker. This fixture adjustment does not change production scheduling.

External email, AI and payment integrations must remain unconfigured. Passwords and tokens stay in memory. Reports, private local API logs and cleanup IDs live in ignored `.staging.local/marketplace-<run>/` directories. The runner removes its owned application/auth records and stops its API in `finally`; check the cleanup result before accepting a run. Saved staging feature flags are not changed.

If forcibly interrupted, verify and stop only that run's processes using its `owned-records.json`, then recover using the exact saved run ID:

```powershell
node scripts/staging/recover-marketplace.mjs --apply --project-ref gyhmergopdlqygsgjpyb --run <32-character-run-id>
```

Recovery checks the saved project and synthetic email ownership. It refuses while a saved process ID remains alive, rather than killing a potentially reused process. An interrupted 9 October run was recovered on 10 October (six application/auth identities removed). The subsequent publication-timeout run completed its cleanup normally. A pooled connection now replaces failed idle database connections so they do not bypass the runner's cleanup.

## Gates still required before cohort release

| Gate | Remaining evidence |
| --- | --- |
| Browser journeys | Desktop/mobile journeys with real sessions, login return, account switching during pending reads/writes, keyboard/focus, expired sessions and draft preservation on failure |
| Private storage | Real uploads and unrelated-user/copied-link denial for resumes, verification documents and message attachments |
| Migration/restore | Backup and restoration of representative populated staging records; fresh empty-database migration success is already recorded |
| Runtime operations | Continuously hosted API/worker, scheduler ownership, observed backlog/alerts, database-connection interruption handling, and operational flag disable/recovery |
| Account lifecycle | Closure with real uploaded files, supported legacy freelancer account management, and an agreed company-departure handover/retention procedure; provider profile/draft closure and revoked-seat denial passed the API checks |
| Moderation operations | Named operator, report triage, escalation and documented resolution; passing authorization tests does not staff the queue |
| Performance | Directory/query measurements at realistic pilot volume and mobile/slow-network behavior; the existing large frontend bundle warning remains |
| Deployment | Hosting/domain, reviewed source snapshot, HTTPS/auth return URLs and deliberate cohort access; current flags apply to the entire environment |

## Cohort release and measurement sequence

1. Close the release gates above and record the evidence, source/build and operator. Deploy compatible backend/schema before frontend. Enable in the intended pilot environment and verify the disable path.
2. Enrol the agreed Canadian cohort in design, marketing and software. The proposed target remains 5–10 businesses and 30–50 professionals. Do not send invitations until recipients and invitation wording are supplied and sending is authorized.
3. Add durable recipient relevance assessments and optional participant-reported outcomes tied to canonical requests. Record assessor, timestamp and definition version. Reports must distinguish unassessed, not relevant and relevant responses; participant reports do not verify a hire or contract.
4. Freeze cohort membership, start/end dates, timezone and qualifying actions. Build seven-day enquiry/reply cohorts, unanswered-listing counts, time to first relevant response, repeat company participation and returning professionals. Keep synthetic/internal activity excluded and report exclusions.
5. Review friction and moderation weekly. Observe four weeks under the [proposed pilot gates](../phase0/pilot-metrics-and-gates.md), allowing seven-day response cohorts to mature. Record real examples of all three journeys before considering paid distribution.

Outcome capture, cohort reporting, recruitment and the observation period are **not completed by this staging checkpoint**. A hosting target, pilot participant list and moderation owner have not yet been supplied in this work session.
