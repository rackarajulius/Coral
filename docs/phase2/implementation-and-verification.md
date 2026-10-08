# Phase 2: records and structured participation

7 October 2026. Implemented locally for the Canada pilot in design, marketing and software. Staging acceptance, production deployment and cohort activation remain queued. This phase adds discovery and publishing; private enquiries, project responses and marketplace conversations follow in Phase 3. Public Broadcasts and Private Events remain in Phase 3A.

## Delivered behavior

- Services have descriptions, skills, deliverables, work samples, availability, location and quote/fixed/hourly pricing. Owners save a private draft before choosing to publish. Publishing requires both listing consent and a complete, publicly shared provider profile.
- Project briefs persist through the existing `/gigs` API. They include scope, skills, location, optional future deadline and negotiable/fixed/range budgets. An eligible personal account or current company OWNER/ADMIN can publish a brief. Company context comes from current server-side membership.
- Public directories at `/services` and `/projects` support text, category, exact normalized skill and work-location filters, with stable pagination. Detail pages expose the currently available public record. Private drafts, paused/closed/archived records, moderation removals, expired briefs and withdrawn consent do not appear in public reads.
- `/marketplace/manage` supports private draft reload/edit, explicit publish/open, pause, project close and archive. Archived records cannot reopen. Prices are entered in normal currency units and stored as bounded integer minor units; CAD/USD/EUR/GBP use two decimals, JPY zero and KWD three.
- Community posts have a separate purpose: general, question, showcase, service announcement or opportunity. Existing posts default to general. Validated foreign keys reference one canonical service, project or existing job. Commercial participation lets the author choose from all companies for which they hold a current OWNER/ADMIN seat, including after leaving another company. Company announcements require current company authority and matching attribution. A job announcement routes to the existing `/jobs?job=ID` application journey and uses the shared hiring live-status constant.
- Linked feed cards read current titles, prices and availability. After withdrawal, suspension, closure or moderation removal, the canonical card becomes unavailable and historical link-preview data is suppressed, including in reshares. The author's own post text remains; Coral does not rewrite what the member independently typed.
- Active members can report public listings. The marketplace queue in community moderation is restricted to active platform ADMIN accounts. Space moderators receive no marketplace-wide authority. Admins can inspect reported content, mark reports reviewed and remove/restore listings with an audit reason. Restoration preserves lifecycle and consent; it does not reopen a closed brief.

Public listing projections omit email, authentication data, contact data, recruiting profiles, report identities and owner-management fields. Work-sample URLs must be credential-free HTTPS links. Work evidence, prices and availability are labelled as supplied by the owner, rather than verified achievements.

## Ownership and safety contracts

Active JOB_SEEKER/FREELANCER accounts can offer services after enabling provider capability. Their job-search role is preserved. Personal project creation is also available to these accounts. Other accounts need a company they can publish for. Company mutations require a current active OWNER/ADMIN seat; a historical employer profile is insufficient.

For this release, company listing visibility also requires its original creator to remain an active company OWNER/ADMIN. Another authorized company publisher can manage a record, but publication cannot bypass that creator requirement. Transfer of ownership is not implemented. Rehearse seat departure and replacement in staging before relying on long-lived company listings.

Account/company deletion cascades to owned listings; deleting a listing clears post references and deletes its listing reports. Posts continue to render. These are schema behavior contracts, not a completed legal retention policy. Review company handover and report retention before broader rollout. The existing legacy-freelancer account-management gaps from Phase 1 remain open.

Reporting retries create one report per reporter and target. Repeating an identical reviewed report preserves its reviewed status; changing its reason/details reopens it. Removed records remain available to authorized owners/admins but cannot be edited or republished. Owners can archive them.

## API and rollout flag

| API | Purpose |
| --- | --- |
| `GET /marketplace/capabilities` | Current publishing capability, eligible companies, categories and currency precision |
| `GET /services`, `GET /gigs` | Public paginated directories |
| `GET /services/:id`, `GET /gigs/:id` | Currently visible public details |
| `GET /services/mine`, `GET /gigs/mine` | Authorized owner/company management pages |
| `GET /services/mine/:id`, `GET /gigs/mine/:id` | Private saved record for edit/reload |
| `POST /services`, `POST /gigs` | Create private draft |
| `PATCH /services/:id`, `PATCH /gigs/:id` | Authorized listing-field updates |
| `POST /services/:id/state`, `POST /gigs/:id/state` | Explicit lifecycle transition |
| `POST /services/:id/report`, `POST /gigs/:id/report` | Authenticated member report |
| `GET /marketplace/moderation/reports` | ADMIN queue, open or reviewed |
| `POST /marketplace/moderation/reports/:id/review` | Mark a report reviewed |
| `POST /marketplace/moderation/:kind/:id/remove` or `/restore` | ADMIN removal/restoration with an audit reason |

The existing API prefix applies. UI project URLs use `/projects`; the API retains `/gigs`. The old contract scaffold is unchanged.

`MARKETPLACE_LISTING_WRITES_ENABLED` is disabled by default and enabled only by the exact value `true`. It gates listing creation/edit/publication and new commercial community announcements. It does not disable hiring or general community publishing. Existing authorized reads, pause/close/archive, reporting and admin moderation remain available while the flag is off. The frontend reads this server capability, including for signed-out directory buttons. This is a global deployment flag, not a cohort allowlist.

Rollout order:

1. Rehearse the existing migration history and new `20261007140000_phase2_marketplace` migration against representative staging data, after the Phase 1 provider-profile migration. Back up the target and confirm old posts, profiles, jobs and applications remain intact.
2. Apply the additive schema migration and generate the matching Prisma client; deploy backend code with listing writes disabled. The migration adds post-purpose/reference fields, listing/report tables, foreign keys, indexes and target/money constraints.
3. Deploy the dependent frontend and verify public reads and owner/admin safety controls before enabling publishing. Old clients can continue creating ordinary posts using the GENERAL default.
4. Perform real-identity staging checks below, then enable the flag for the intended pilot environment. Keep a named operator able to switch it off.
5. To stop new publishing, set the flag to false and restart/reload configuration as required by the deployment. This preserves existing data and safety controls. Do not drop listing tables or remove post columns as an operational rollback.

No application database migration or live feature flag was applied during this local implementation.

For selected commercial company participation, the existing posts API accepts `asCompany: true` plus an optional `companyId`; the announcement-options query accepts `company=true&companyId=UUID`. Both verify the exact current company seat. Omitting the ID retains legacy primary-company behavior. Ordinary company voice and existing Tide company resolution are unchanged; wider company switching for those flows is separate work.

## Verification evidence

Backend unit regression: **19 suites, 304 tests passed**. Integration checks across the 11 suites covered **102 passing cases after focused reruns and additions**. The initial broad run passed 97 cases and exposed one company job-card case: a recruiter-created live job was incorrectly subjected to marketplace creator-seat rules. The projection now uses the existing hiring visibility policy while checking the announcing actor's current company authority. The final community-link rerun passed all **16 cases**, including four new cases for explicit company selection with an older removed seat, and foreign/revoked/recruiter denials. After that fix, three existing community unit suites (**87 cases**, included in the earlier unit total) also passed. These totals combine the broad run with later focused runs, rather than claiming a final all-suites rerun.

The focused Phase 2 API, moderation and actual-SQL migration suites also passed. An intermediate community rerun exceeded its 60-second database setup hook under parallel build load; the suite now has the same explicit 240-second setup allowance as the other database suites. The final rerun completed successfully. No application behavior assertion was removed.

Database checks execute production controllers/guards/services and PostgreSQL persistence where applicable, with fixture identity and external delivery boundaries. They cover foreign-owner access, current company-seat permissions, conservative drafts, publication readiness, consent withdrawal, suspended owners, public filtering/counts, literal search, exact normalized skills, bounded minor-unit money, lifecycle transitions, report retries, ADMIN scope, removal/restore and linked-card suppression.

The migration rehearsal executes the saved migration SQL in an owned test schema and preserves pre-migration users, profiles, jobs, applications and posts. It separately exercises foreign-key deletion and CHECK constraints; schema-generated tests alone would not prove those constraints were installed. Tests used only `TEST_DATABASE_URL` against the dedicated loopback PostgreSQL cluster on port 55432, without loading the application's database URL. Final cleanup found zero fixture schemas and stopped that test server.

Backend build and backend test typecheck passed. Frontend typecheck and the final production build passed, with existing large-chunk and outdated Browserslist-data warnings. The main JavaScript bundle is about 5.44 MB before compression (1.45 MB gzip). Bundle optimization remains a separate performance task.

Browser checks use the real React application with an ignored, loopback-only synthetic API/session harness. Executed checks include service-category filtering, canonical detail/work links, private draft save/reload, explicit publication, CAD 1,200.50 rendering, and a mobile public-detail view at 375px without horizontal overflow. The report form and submitted-report feedback were also checked. Project directory mobile layout, scope entry, range-budget entry, private save, explicit opening and public detail were verified, including CAD 2,500.75–5,000.00 display. The harness uses in-memory synthetic records and simplified permissions: database tests provide persistence/authorization evidence, and these UI checks do not establish live identity or delivery behavior. Browser navigation occasionally timed out under local development/build load; only completed, visibly verified flows count as evidence. The final company selector was compiled and its backend contract tested, but was not exercised in this browser harness. The viewport override was reset, the QA tab closed and preview processes stopped.

## Staging gate and next phase

- Verify real login return, account switching during private requests, company voice and seat revocation on desktop/mobile. No actual Supabase/OAuth provider flow was exercised by the synthetic browser harness.
- Verify service creation with a private provider profile, publication after explicit consent, later provider/record withdrawal, project expiry and owner reload. Exercise community composer purposes, company job announcements and unavailable cards in the deployed application.
- Rehearse actual deployment history and realistic public-query volume. The current filtering uses SQL and normalized arrays without ranking; there is no production latency claim.
- Verify admin queue removal/restore and audit review with separate member, Space moderator and platform ADMIN identities. Existing global community moderation scope remains a Phase 0 issue; this new marketplace queue is ADMIN-only.
- Confirm operational disable/recovery, company handover, account closure and retention decisions. Validate mobile keyboard/focus behavior and real API failures, beyond the executed fixture flows.
- Complete Phase 2 staging acceptance before enabling the dependent marketplace release. Phase 3's private enquiries, project responses and participant-authorized inbox are now implemented locally; see the [Phase 3 handoff](../phase3/implementation-and-verification.md). Keep Public Broadcasts and Private Events on their separate Phase 3A release gate.
