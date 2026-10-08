# Coral Phase 1: identity and entry points

Prepared 7 October 2026. Pilot: Canada; design, marketing and software. Identity and entry points are implemented locally. Deployment and real identity-provider staging checks remain separate release gates.

## Implemented journeys

- An active `JOB_SEEKER` can opt into offering services through `/provider` while retaining the same role, recruiting profile, applications and hiring routes. This capability does not grant a company seat or recruiting-message access.
- Existing `FREELANCER` accounts have provider navigation and a working private onboarding destination. Pending legacy accounts finish their own provider flow; jobseekers finish existing candidate onboarding before provider setup.
- Provider owners save private drafts, work evidence, skills, work preferences, location, remote preference, availability and timezone. Candidate data import is optional, fills empty work fields only and does not save or consent automatically.
- `/provider/preview` displays saved work fields. `/providers` is a bounded category/name/work/skill directory; `/providers/:userId` is the consenting professional's signed-out public profile. Search supports partial, case-insensitive skills and treats SQL wildcard characters literally.
- Community post/detail and comment names link to eligible public provider profiles, with visible candidate profiles as authenticated fallbacks. Company attribution remains on company posts; company names link to an available non-private company page.
- Community positioning connects the three audiences. Find professionals, Find work and Offer services use available journeys. Service enquiries, project briefs and general client conversations remain subsequent phases.

## Visibility and authority

Provider capability and public visibility are separate booleans. Merely visiting setup creates no record or consent. Public access requires both booleans, an active personal account, an approved category, a headline of at least three characters, an introduction of at least 30 characters, a nonblank skill and a safe portfolio or GitHub work link. A LinkedIn link alone is not work evidence. An unavailable professional may keep a public portfolio; availability remains self-reported.

The public database projection and serializer exclude email, phone, resume, recruiting details, account status/identity credentials and historical rating/earnings/project counters. Those legacy counters remain owner-only and labelled `legacy_self_declared`; users cannot edit them through provider setup or onboarding. Work links allow HTTP/HTTPS and reject embedded credentials. Public profiles are independent of private recruiting-profile consent; the provider form explains exactly which identity/work fields become public.

Invalid edits cannot leave an incomplete published profile behind. Turning off offering services withdraws public consent. The independent Make saved profile private action can withdraw access without saving invalid unfinished form edits. Directory projection rechecks consent/status after its bounded ID lookup. Public UI hides cached data on a failed refresh; copies already viewed or captured by others cannot be revoked.

Provider reads, mutations, imports and pending-provider onboarding bind to the initiating account and suppress callbacks after an account switch. Server ownership comes from authentication, never a submitted user ID. Role selection and onboarding recheck eligibility under the same user-row lock used by provider writes, preventing stale pending-account role changes after activation.

Company post editing/deletion and Tide maintenance require a current active OWNER or ADMIN seat for that record's exact company. Historical authorship, membership in a different company and platform administrator status alone do not grant company publishing authority. Original post author/Tide host attribution survives seat changes. Separate platform moderation remains available through its existing routes. The identity badge describes active company membership; it does not verify employment, skills or project outcomes.

## API and migration

| Endpoint | Access and behavior |
| --- | --- |
| `GET /api/v1/freelancers/me/profile` | Active personal owner; null for missing draft; no implicit creation |
| `PATCH /api/v1/freelancers/me/profile` | Active personal owner; allowlisted draft/publication fields and explicit consent |
| `GET /api/v1/freelancers` | Public, filtered safe fields; category, q, cursor and limit (maximum 24) |
| `GET /api/v1/freelancers/:userId` | Public consent/readiness gate; unavailable profiles return 404 |

The additive [provider migration](../../backend/prisma/migrations/20261007120000_provider_profiles/migration.sql) adds capability, consent, category, work preferences and the public-directory index. Existing freelancer profile records receive capability only when their user's role is `FREELANCER`; every old record remains private until explicit public consent. User roles, legacy counters and hiring records are preserved. Future records default to both booleans false.

Deploy the additive migration and compatible backend before this frontend. The rehearsal applies this actual migration to representative synthetic legacy rows in an owned disposable schema. It does not validate every historical migration or a production snapshot. Do not drop the new columns as an operational rollback; revert the dependent frontend/backend deployment together and retain data. For a profile, owner consent withdrawal disables new public reads. A global marketplace release switch remains future work.

## Verification

| Check | Executed result |
| --- | --- |
| Backend build | `npm run build` passed |
| Backend test types | `npm run test:typecheck` passed |
| Backend unit regression | 18 suites / 289 cases passed |
| Backend integration regression | 7 suites / 75 cases passed, including 34 provider/company cases and the actual provider migration rehearsal |
| Provider integration after final URL validation change | 34 cases passed again |
| Frontend types | `npm run typecheck` passed after fixing the SVG tooltip markup |
| Frontend production build | `npm run build` passed; existing large-bundle warning remains (main entry 5.38 MB, 1.43 MB gzip) |
| Phase 1 tracked-file whitespace check | Scoped `git diff --check` passed using the repository's normal line-ending configuration |

PostgreSQL tests used only process-scoped `TEST_DATABASE_URL`, a verified loopback test cluster at port 55432 and randomly named owned schemas. They did not load the application's database URL, deploy a production migration or use real identity/payment/video credentials. Teardown left zero fixture schemas and the dedicated test server was stopped. Backend external identity/delivery boundaries remain fixture implementations, while production provider controllers, validation, guards and services execute against PostgreSQL.

Browser checks ran the real React application with an ignored, loopback-only synthetic API/session harness. Directory and public/saved profile layouts were inspected at 1366px desktop and 375px mobile; navigation and category results were checked at 1024px. No horizontal overflow was observed in the checked mobile/tablet views. Executed flows: skill/category filtering, empty results and clear filters, directory failure/retry, public work links and disclosure text, private draft save/reload, explicit publication, independent withdrawal with an invalid unsaved link, saved preview excluding unsaved edits, anonymous withdrawn-profile denial, legacy pending-freelancer completion into a private setup form, signed-out provider sign-in modal and mobile menu destinations.

These browser checks establish fixture-backed rendering and interaction only. Live Supabase/OAuth login return, exhaustive in-flight account-switch schedules, email/media delivery, realistic query performance and deployed behavior still require staging evidence. Preview startup and authenticated navigation occasionally timed out while the development app loaded; reload recovered and the checked interactions then completed. Temporary tabs and viewport overrides were removed, and the preview processes were stopped.

## Release gates and next phase

- Exercise real candidate/provider/employer login, onboarding destinations, account switching, public consent, withdrawal and company-seat changes in staging on desktop/mobile. Confirm signed-out public exposure with synthetic accounts before inviting the cohort.
- Rehearse deployment history on representative staging data; measure public-directory queries with realistic profile volume and existing indexes. SQL search currently uses literal `ILIKE` and array scans; no ranking or production latency claim is made.
- Verify the existing account-closure path removes provider profiles for a provider-enabled jobseeker, and define a supported closure/personal-name-photo management path for legacy freelancers before wider onboarding. No new personal identity editor is included in this phase.
- Keep Phase 0 moderation-scope, event-access and billing/measurement gates visible. Existing frontend bundle size is a separate performance issue.
- Phase 2 adds canonical service listings and persisted project briefs. Private enquiries follow in Phase 3. Public Broadcasts and Private Events remain planned in the separately gated Phase 3A; no streaming service has been enabled here.
