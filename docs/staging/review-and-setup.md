# Coral staging setup and guided review

Prepared 7 October 2026. Coral currently runs locally. This starter prepares a production-build review on this computer, using a separate Supabase staging project for database, authentication and storage. It has no public hosted URL yet. Phase 3A Public Broadcasts and Private Events remain the next development phase after this checkpoint.

Staging review means using test identities and realistic test records to check the complete journeys and failure cases before releasing them to real members. A passing build or synthetic browser demo is only part of that evidence.

## 1. Prepare the isolated project and settings

The commands use the installed frontend and backend dependencies. For a repeatable release build, align with CI's Node 22 runtime using version 22.12 or later in that line; the local checks here used Node 25.1.0. Save the runtime version and reviewed source snapshot with the acceptance results.

Use one separate Supabase project dedicated to staging. Do not copy real members, private messages or production storage into it. Its project reference, database URLs, browser publishable/anon key and server secret/service-role key must all belong to that project. Keep these values in local files; do not paste credentials into chat.

### Project creation settings checked on 8 October

The user created **Coral Staging** in the existing Free organization, in **Canada (Central)** (`ca-central-1`) for the Canada pilot. Project reference: `gyhmergopdlqygsgjpyb`. The dashboard reported **Healthy** on 8 October. The project URL and existing anon/service-role keys have been saved in the ignored staging configuration files; the keys were checked for the staging project reference and correct roles without displaying their values.

The user selected **Automatically expose new tables** off, **Enable automatic RLS** on and **Enable Data API** off. Coral's current database traffic goes through its Nest backend and Prisma PostgreSQL connection; the code audit found no application-table PostgREST queries. The migrations define no application RLS policies: private marketplace participant checks live in the backend. Automatic RLS with no policies denies browser-role row access, and disabling the Data API prevents direct REST queries. The older `backend/prisma/triggers.sql` file is outside the migration history and does not protect marketplace tables.

Supabase documents disabling the Data API for apps using direct database connections and confirms that this disables the generated REST endpoints. See [Securing your API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api) and [Securing your data](https://supabase.com/docs/guides/database/secure-data). Keeping Auth, Storage and broadcast Realtime working is an expected result of Coral's separate SDK/API usage, and must be verified on the actual new project. Confirm the saved Data API setting and the new tables' grants/RLS after migration before adding test content or enabling marketplace flags. Do not treat a successful migration or local configuration check as proof of direct database API privacy.

The saved Data API overview was inspected after creation: **Enable Data API was off**, with the dashboard stating that no schemas can be queried. Evidence: `.staging.local/coral-staging-data-api-disabled.jpg`. The subsequent verified-TLS database audit passed after the browser-role grant repair: all 90 application tables have RLS, the automatic-RLS trigger is active, and both browser roles have zero effective public table/column data privileges.

From `C:\coral\coral`, copy the supplied templates only if the target files do not already exist:

```powershell
if (-not (Test-Path staging/frontend.env.local)) {
  Copy-Item staging/frontend.env.example staging/frontend.env.local
}
if (-not (Test-Path staging/backend.env.local)) {
  Copy-Item staging/backend.env.example staging/backend.env.local
}
```

Fill the placeholders in those two `.local` files. They are ignored by Git. The browser file contains only public settings; database passwords and service-role keys belong in the backend file. URL-encode the database password within connection URLs. The migration connection must be direct/session mode, using port 5432 rather than the transaction pooler's 6543.

The user supplied the database password through the hidden prompt on 8 October. To update these local connection fields again, run this in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\coral\coral\scripts\staging\set-database-password.ps1 -ProjectRef gyhmergopdlqygsgjpyb -PoolerHost aws-1-ca-central-1.pooler.supabase.com
```

Enter the database password saved during project creation at the hidden prompt. Do not paste it into chat. The exact pooler hostname above was read from this project's Connect dialog. The helper checks the staging marker/project reference, encodes special characters and updates only the two database fields, using port 6543 for runtime and 5432 for migration. It does not connect or apply migrations. Before running it for another staging project, obtain that project's exact pooler hostname and reference rather than reusing these values.

The official CA certificate linked by Supabase's Database Settings page has been downloaded to `.staging.local/supabase-staging-ca.crt`. Both database URLs now use `sslmode=verify-full` and its absolute `sslrootcert` path. This provides certificate and hostname verification, following [Supabase's connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres). The password helper preserves this setting when the owned CA file exists. The initial `sslmode=require` configuration allowed encrypted migration access but did not establish server certificate verification; the subsequent catalog audit used the CA and verified TLS.

The initial addresses are:

| Component | Address |
| --- | --- |
| Website | `http://127.0.0.1:4173` |
| API | `http://127.0.0.1:3002/api/v1` |
| Auth and storage | The new staging Supabase project |
| Runtime | A continuously running local backend for scheduled jobs |

Configure the staging authentication return URLs for the actual frontend paths: the origin, `/auth/callback`, `/reset-password` and `/jobseeker/settings`. If testing Google or another external OAuth provider, its client configuration also needs the staging origin/callback settings. Email sign-in should be verified as its own journey. Match the exact `127.0.0.1` origin rather than mixing it with `localhost`.

The user saved Site URL `http://127.0.0.1:4173` and the four exact redirect URLs above. The saved form and total of four redirects were verified in the dashboard; evidence is `.staging.local/coral-staging-auth-urls-saved.jpg`. Email confirmation is enabled. Social sign-in is not configured in this staging project; `VITE_SOCIAL_AUTH_PROVIDERS=` in the dedicated frontend settings makes the sign-in screen email-only. Only list a provider after its Supabase configuration is enabled and tested. An undefined field preserves the existing provider list in development; an explicit blank hides all social options. Changing this field requires a staging rebuild and a page reload.

An email sign-in attempt reported `Login failed: Failed to fetch` on October 8. This originates from the browser's direct Supabase Auth request. A subsequent anonymous browser check from the staging origin returned HTTP 200 for Auth settings (email enabled) and marketplace capabilities at 10:22 UTC; evidence is `.staging.local/coral-staging-connection-check.jpg`. No credentials were submitted by the check. The user's next password sign-in reached Auth and returned HTTP 400 with error code `invalid_credentials`, confirming transport recovery for that attempt. That connectivity check alone did not establish account creation or login; the later human sign-in and account review are recorded below.

Start with both marketplace feature flags `false`. Leave email, AI, billing and other integrations blank until their test configuration is intentionally supplied. For admin checks, use an explicitly controlled staging account in `DEFAULT_ADMIN_EMAIL` before its first sign-in; blank disables automatic promotion. Never use a placeholder administrator email.

## 2. Check configuration, then prepare the database

```powershell
npm run staging:check
npm run staging:test
npm run staging:db-status
```

The first command checks project separation, key roles, frontend/backend agreement, database project identity, URL/CORS wiring, local binding and exact feature-flag values. It prints field names and errors without printing secrets. This is structural validation; it cannot prove that a password works or that a modern opaque key belongs to the project. The status command makes the first real connection to the declared staging database.

For the new empty staging database, apply the repository's saved migrations explicitly:

```powershell
npm run staging:migrate -- --apply
```

Then remove direct browser-role privileges from Coral's application schema:

```powershell
npm run staging:secure-db -- --project-ref gyhmergopdlqygsgjpyb
npm run staging:secure-db -- --project-ref gyhmergopdlqygsgjpyb --apply
```

The first invocation prints the plan without connecting. The applied step checks project separation, disabled marketplace flags, exact schema ownership and completed migration checksums before revoking browser-role table/sequence privileges and `postgres` public table/sequence default grants. It changes only the owned application schema; Supabase Auth/Storage schemas and platform-owner defaults are outside its scope. The live audit found broad default table grants despite the creation-form choices, making this an explicit provisioning step. Re-audit after future migrations; keep Data API disabled.

For an already populated staging database, review a backup and representative data before applying new migrations. Do not use `db push`, `migrate dev` or a reset as deployment evidence. The starter never migrates automatically when the backend starts.

Fresh-database rehearsal on 7 October passed **all 105 actual migrations**, from `20260225054928_career_one` through `20261007160000_phase3_marketplace`, using an owned disposable loopback PostgreSQL database. The database was dropped afterward and the owned test server stopped. The local diagnostics are in `backend/.staging-rehearsal.local/latest-report.json` and `latest-migrate-deploy.log`. This establishes the saved history on an empty PostgreSQL database; hosted connections, existing-data compatibility and backup restoration still need their own checks.

On 8 October, all **105 migrations were applied successfully to Coral Staging**. The verified-TLS catalog audit confirmed every saved migration checksum, all **90 application tables**, RLS on all 90, and an active automatic-RLS event trigger. Before the privilege repair, both browser roles held broad privileges on all 91 public tables including `_prisma_migrations`. The applied repair revoked those privileges and `postgres` public table/sequence defaults. The final read-only audit passed with **zero browser-role data grants** and no missing tables, incomplete migrations or checksum mismatches. Catalog evidence is in `.staging.local/database-audit.json`; the earlier result is preserved in `database-audit-before-repair.json`. Platform-owner `supabase_admin` defaults remain outside this repair, so rerun the audit after future schema changes.

## 3. Build and run the review environment

```powershell
npm run staging:build
```

This generates the matching Prisma client, compiles the backend and builds the website in production mode. It does not start servers or apply migrations. Website output is `.staging.local/frontend`; backend output is `backend/.staging.local/dist`. The build uses the dedicated staging settings and bypasses the development dotenv files.

Starter verification passed Prisma generation, the isolated backend compile and the Vite production build using synthetic settings. The browser artifact contained the fixture's public staging settings and passed checks for exclusion of injected backend secrets and development settings. No successful launch manifest was saved for that fixture. Those checks did not establish real authentication/storage behavior. The existing large-bundle warning remains (approximately 5.48 MB JavaScript / 1.45 MB gzip).

The actual staging build passed on 8 October using the new project's settings. The built browser files contained no backend secret, database password/URL or development-project reference. Auth settings and authenticated Storage bucket listing each returned HTTP 200 with Data API disabled. A separate two-client WebSocket check joined an ephemeral staging QA channel and received a harmless broadcast using the app's `changed` event; sockets were closed afterward. This confirms endpoint availability and broadcast transport, not real user sign-in, asset privacy or marketplace journey acceptance.

In two terminals, run:

```powershell
npm run staging:api
```

```powershell
npm run staging:web
```

Open `http://127.0.0.1:4173`. The API binds to loopback through `HOST=127.0.0.1`, and its runtime working directory is `.staging.local/api-runtime`, where application dotenv files are refused. Child processes receive only operating-system essentials and the dedicated settings. The frontend process receives no backend secrets. Changing browser settings requires another staging build. Stop each owned server with Ctrl+C in its terminal.

The local website uses Vite's production preview server. A shareable hosted staging site needs a real static frontend host, HTTPS origins and a continuously available backend/worker. The existing HTTP-only Lambda manifest does not supply a scheduled worker. Deployment needs a reviewed source snapshot: much of the Phase 1–3 work currently lives in uncommitted files, so publishing the current Git HEAD alone would omit it.

The local staging website and API were started on 8 October. Public API reads for services, project briefs (`/gigs`), jobs and Spaces returned HTTP 200; signed-out private marketplace requests returned HTTP 401. CORS returned the exact staging frontend origin. The service and project directories rendered their expected empty state in the production website. The backend created all seven expected buckets: `company-assets`, `profile-media` and `community-media` public; `verification-documents`, `screen-videos`, `resumes` and `message-attachments` private. No upload or signed-URL privacy journey has been accepted yet. The first human-created account passed sign-in and active-profile checks; it was subsequently signed out, and the separate company account is active as recorded below.

The user reported successful sign-in on 8 October. A fresh staging review tab rehydrated the real session, and the initial `/auth/me` response returned HTTP 200 with role `JOB_SEEKER` and status `PENDING_ONBOARDING`. Community showed the signed-in navigation. In that initial check, `/marketplace/manage` and `/marketplace/inbox` required completed account setup and linked to `/onboarding`, which opened the first profile step. No listings, proposals or private threads were created by these checks, and both marketplace flags remain off.

**Coral QA Candidate A** is now `JOB_SEEKER / ACTIVE`. The ordinary profile editor saved the synthetic software headline and Toronto, Ontario, Canada location. A fresh page reload and API GET confirmed that both persisted. The explicit administrator-provisioning fix and the ACTIVE profile hydration/save guard are built; the staging API was restarted for the administrator fix. A blank or missing `DEFAULT_ADMIN_EMAIL` now prevents automatic promotion, including during later authenticated requests, without removing existing assigned administrator roles.

The original candidate onboarding field-retention result remains unproven and needs a fresh-account retest. A regression through `AppValidationPipe`, `AuthController` and `AuthService` passed, showing that the supplied nested profile fields reach both profile upsert paths; it does not establish what the browser submitted during the original attempt. Candidate-to-company sign-out/sign-in is now exercised below; switching back, the pending-candidate guard on the current build and a separate professional identity remain pending.

The ACTIVE candidate passed the signed-in flags-off browser smoke review. `/marketplace/manage` and `/marketplace/manage?kind=project` showed publishing temporarily paused, the expected empty service/project headings, and no creation, editing or publishing controls. `/marketplace/inbox` showed Received with “No enquiries or responses yet”; `/marketplace/inbox?box=outgoing` showed Sent with “No requests sent yet”. No listings or requests were created. This establishes the authenticated empty-state baseline, not conversation lifecycle or participant privacy acceptance.

During the review, both local servers had stopped and were restarted using the validated existing staging configuration. After reload, `/auth/me` returned HTTP 200 with `JOB_SEEKER / ACTIVE`, and the marketplace requests read returned HTTP 200, recovering the inbox. This is basic server/session recovery evidence; notification delivery and controlled-outage recovery still require their own checks.

Candidate A could view `/provider` with the offering switch and public-visibility checkbox off; no save, import or toggle was performed. `/provider/preview` showed “Add your work first”, with no saved provider profile. `/employers/dashboard` redirected home with the explicit job-seeker access notice, and the incidental `/api/v1/employers/company/me` response was HTTP 403. The candidate headline/location remained intact afterward. These checks establish the viewed setup and role boundary, not provider opt-in, company-seat authority or participant privacy. The recruiting inbox rendered its empty state, but no GET response was verified before navigation; full recruiting-inbox acceptance remains pending.

Two marketplace empty-state messages need aligning with the paused feature status: the listing paragraph still invites saving a draft, and the Sent inbox paragraph invites starting a conversation. The candidate recruiting inbox also displayed employer wording, “Write to anyone who applied to one of your jobs.” Homepage category job counts are static values in `src/components/Categories.tsx`, rather than evidence of live listings in the empty staging project. These are recorded copy/data follow-ups. The user supplied a separate company-test email and completed its credential entry and sign-in; the address is not recorded here.

Candidate A was fully signed out through the ordinary UI and remains `JOB_SEEKER / ACTIVE` in the saved account/profile. The separate company account completed basic onboarding as **Coral QA Company C**, Technology, 1–10 people, Toronto, Ontario, Canada. Website and optional role labels were left blank; the public-face step was skipped. The company-details and completion requests returned HTTP 201. `/auth/me` confirmed `EMPLOYER / ACTIVE`; a fresh onboarding read returned `needsOnboarding:false`, with company details complete and public face/verification incomplete. The saved company API returned the expected name, industry, size and headquarters, with blank website, tagline, social links and extra locations. Verification remains `unverified`.

Company C's dashboard, jobs and candidate pipeline loaded, with the jobs and pipeline reads returning HTTP 200 and empty records. Team showed one active Owner seat. Its project-management view remained paused with no write controls and `/gigs/mine` returned HTTP 200. Attempting `/jobseeker/profile` redirected to the employer dashboard with an explicit employer-account notice, and Candidate A's name/headline were not displayed. No jobs, marketplace listings, requests, verification documents or candidate messages were created.

The company editor exposed inherited Acme demo content despite the clean saved company record. Source confirmed its automatic saves were browser-local only. The corrective implementation starts from blank fields, cleans unchanged legacy template drafts while retaining genuine edits, preserves existing saved branding sections, and displays the onboarding size/industry. Eight focused regressions and frontend TypeScript passed. The actual staging build was rebuilt and its API restarted. A fresh browser reload showed Coral QA Company C, Technology, 1-10 employees and Toronto, Ontario, Canada headquarters, with blank tagline/website, no extra locations/social links and profile strength 10/100. Auth and company GETs returned HTTP 200 with `EMPLOYER / ACTIVE` and the unchanged clean, unverified record; returning to Team showed one active Owner and its members GET returned HTTP 200. Evidence: `.staging.local/company-account-smoke.json` and `.staging.local/coral-staging-company-editor.jpg`. Initial restart/refresh requests included transient connection failures and 401s before recovery; this is not complete controlled-outage or expired-session acceptance.

The contact review also found missing verification checks on new outreach sends and individual AI-screen invitations. Both now use the existing employer verification boundary for non-admin employers before their services can write or deliver, including newly scheduled sends. Thirty-two focused regressions plus backend source/test TypeScript passed; the actual staging build and API restart include the repair. No live outreach or screening invitation was sent, and fresh-build HTTP denial checks remain pending. Application-authorized recruiting thread creation/replies retain their existing consent/participant rules; whether first applicant contact additionally needs verification remains a policy question. Previously queued outreach does not recheck verification or seat revocation at delivery and remains an operational release gate. Company C has not been marked verified, and no verification evidence was fabricated.

## 4. Make the test identities

Use separate browser profiles or private windows; switching a label in a mock preview is not an authentication test.

| Identity | Purpose |
| --- | --- |
| Signed-out visitor | Public discovery; sign-in return to the selected listing |
| Candidate A | Employment access plus optional provider capability |
| Professional B | Public service and private client conversation |
| Company C owner/admin | Company listing, recruiting and project response |
| Company C second seat | Verify a colleague does not inherit a private marketplace thread |
| Company D member | Cross-company denial |
| Space moderator | Own-Space scope and private-thread denial |
| Platform administrator | Reports/aggregate metrics without proposal or message access |

Use synthetic Canada records in design, marketing and software. Test active, suspended and departed-seat cases separately. Storage checks need the server-only key: confirm public profile/company/community media behaves as intended and private resumes, verification documents and message attachments cannot be opened by an unrelated account.

## 5. Walk the three journeys

First confirm public reads and existing safety/history actions with the flags off. Then set `MARKETPLACE_LISTING_WRITES_ENABLED=true` and `MARKETPLACE_ENQUIRIES_ENABLED=true` in the staging backend file and restart only the staging API.

1. **Company finds talent:** a company publishes a job, a candidate applies, and the authorized recruiting participants exchange a message. Provider opt-in must retain the candidate's employment access.
2. **Talent finds work:** a company publishes a project brief; a professional submits a private response and labelled work sample. Verify pending/accepted states, duplicate retries, deadline/closure and company-seat revocation.
3. **Professional finds customers:** a professional publishes a service; a customer enquires, the recipient replies/accepts, and both can read their inbox history. Verify decline, withdrawal, block and participant-submitted reporting.

For each journey record the test identities, build time/source snapshot, observed result and any reproduction steps. Check mobile/keyboard behavior, refresh/re-login, an expired session, a failed request with draft preservation and a second account attempting the copied private URL. A company colleague and platform administrator must not acquire private marketplace proposals or message bodies through their roles.

With scheduled jobs enabled, verify in-app notifications after contact, a stopped/restarted backend and recovery from a controlled staging delivery failure. Inspect pending delivery backlog and scheduled-job failures. Marketplace notifications currently deliver in-app only; employer outreach can also email when its integration is configured. Avoid exposing private text in report/metrics or notification previews.

Finally turn both marketplace flags off and restart the staging API. New publishing/contact should stop while permitted history and safety actions remain usable. No schema or record deletion is required to disable the feature.

## 6. Record the release decision

| Checkpoint | Current evidence / remaining action |
| --- | --- |
| Fresh migration history | Passed: 105 migrations on real Coral Staging and disposable local PostgreSQL; hosted checksums verified |
| Configuration isolation | Passed: 30 starter tests; real configuration check passed; local credential files ignored by Git |
| Starter build paths | Passed: actual staging Prisma generation, backend compile and frontend build; browser secret/development-ref scan passed |
| Real login and account switching | Candidate A sign-out and separate company sign-in passed; Company C is `EMPLOYER / ACTIVE` with completed basic onboarding; company-to-candidate route denial passed; switch-back and current-build pending-candidate guard pending |
| Candidate profile and onboarding fields | Ordinary profile editor persisted the synthetic software headline and Toronto/Ontario/Canada location, confirmed by fresh reload and API GET; original onboarding field retention needs a fresh-account retest |
| Signed-in marketplace with flags off | Passed for ACTIVE candidate: services/project management paused with no write controls; Received/Sent inbox empty states rendered; lifecycle and participant privacy still pending |
| Candidate provider and employer boundaries | Provider setup viewed with offering/public visibility off, preview had no saved profile, employer dashboard redirected and incidental company API returned 403; no provider writes performed; professional opt-in, company-seat/private lifecycle and full recruiting-inbox checks remain pending |
| Company onboarding and editor | Basic Company C fields saved, owner seat shown, jobs/pipeline reads empty and company-to-jobseeker route denied; unverified status retained; demo-default repair passed 8 regressions/TypeScript and fresh rebuilt-browser retest with saved size/industry, blank optional fields and no template locations/social links |
| New employer outreach verification | Missing outreach/individual screen checks repaired; 32 focused regressions and backend source/test TypeScript passed; rebuilt and API restarted; live HTTP denial, old queued-delivery revocation and first applicant-contact policy remain gates |
| Storage and private asset access | All seven bucket privacy settings verified; actual uploads and participant access checks pending |
| Direct database API exposure | Passed: Data API OFF in dashboard; all 90 app tables have RLS; browser data grants revoked; catalog audit passed |
| Broadcast Realtime transport | Passed: two staging clients joined and exchanged a harmless signal with Data API OFF; app lifecycle/reconnection checks remain |
| Three journeys with real identities | Pending staging review |
| Notification restart/outage recovery | Local integration coverage exists; deployment-runtime check pending |
| Existing-data migration and restore | Pending representative staging records/backup |
| Moderation scope and operations | Cross-Space moderator scope remains a broader-pilot gate; name an operator |
| Closure, company handover and retention | Review saved deletion behavior and approve operational policy |
| Performance | Measure realistic data/slow connection; existing frontend bundle warning remains |
| Shareable staging URL | Pending hosting choice and reviewed release snapshot |

Coral QA Company C is now signed in as an active employer and remains unverified; Candidate A remains active but signed out. Both marketplace flags remain off. The basic company checkpoint and rebuilt editor retest passed, and the restarted API includes the contact-boundary repair. Fresh candidate onboarding, professional opt-in, verified hiring, participant/private-file denial and the remaining operational checks are still pending; two successful sign-ins do not establish full staging acceptance.

Do not mark an unchecked row as accepted based on a mock preview. Agree who reviews moderation, account closure, original-publisher company departure and retention before expanding the pilot. Keep marketplace flags off for a release that has not passed its acceptance checks.

After these checks, Phase 3A can add Public Broadcasts and Private Events. Its own release gate must verify actual live-stream lifecycle, private access/revocation, copied-link denial, event moderation and protected replay; the current marketplace checks do not establish those features.
