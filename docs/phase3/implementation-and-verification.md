# Phase 3 — Discovery and private marketplace conversations

Prepared 7 October 2026. Local implementation for the Canada pilot, initially design, marketing and software. Staging acceptance and production rollout remain open.

## Delivered behavior

- Service details support a private enquiry; project briefs support a private response with up to five labelled HTTPS work samples. Login returns to the originating listing.
- `/marketplace/inbox` separates incoming requests and sent requests. A recipient can accept, decline or reply; a first reply accepts the request atomically. The requester can reply after acceptance and can withdraw. Both participants can block or report.
- Community listing cards carry their originating post into the detail page and request. Directory cards carry a directory source. Server validation checks community references, commercial purpose and current author/company authority.
- Services and projects support country and city filters, using trimmed, case-insensitive exact values. Services additionally filter availability. Existing category, normalized skills, work mode and literal-text filtering remain in use; there is no relevance-ranking claim.
- Durable structural events record listing views, submissions, acceptance, first recipient replies, messages and terminal actions. A platform ADMIN sees aggregate counts and participant-submitted report details in community moderation. Private proposals, work samples and message bodies are excluded from those projections.

Existing job application and recruiting conversation flows remain the employment journey. Marketplace conversations use separate tables and endpoints.

## Consent and participant contract

Each request has two named participants: its requester and the listing's original creator. Selected company context must be backed by that participant's current active OWNER/ADMIN seat. Another company seat, recruiter, Space moderator or platform administrator does not inherit access to the proposal or thread. Company handover and shared team inboxes are outside this release.

An active account can enquire personally. A requester cannot contact their own listing or a listing belonging to a company where they have any active seat. New service contact requires a currently public, published service and eligible provider profile; unavailable services reject contact. New project responses require a public open brief before its deadline.

Pending acceptance and a first reply recheck the canonical listing, participants, current company seats and pair-wide blocks. A closed/withdrawn listing rejects new contact. An already accepted conversation remains readable and can continue after ordinary listing closure. Moderation removal, an inactive participant, lost company permission or a block stops further messaging. The authorized remaining participant can retain readable history; the participant whose own company permission was revoked loses access to that company-context thread.

Declined, withdrawn and blocked requests cannot reopen or send new messages. A block applies between the two members across marketplace listings; it does not change recruiting messaging. A new contact to the same listing is prevented by per-requester/per-listing uniqueness, including after a terminal decision. There is no unblock or automatic re-contact flow in this release.

Requests and messages use actor-scoped UUID idempotency keys and hashes of meaningful submitted fields. Identical retries return the original result; reusing a key with different content returns a conflict. Writes use database transactions and ordered locks. Limits are ten new requests per hour and sixty messages per ten minutes per actor. Private bodies and samples do not enter the compact inbox list response.

## Persistence, events and notifications

`20261007160000_phase3_marketplace` adds request, message, block, request-report, event and notification-delivery tables. It preserves Phase 2 records and installs foreign keys, uniqueness, indexes and CHECK constraints. The migration is additive; deploy it after the provider-profile and Phase 2 migrations.

The request/message, event and delivery record commit together. A minute scheduler drains due deliveries in batches of fifty. It locks each delivery and the current participant/seat rows, rechecks authority and blocks, and uses a stable notification ID. Notification insertion and delivered status commit together. Failures retain the pending delivery with bounded exponential backoff and a generic error code. Notification text says only that the private marketplace inbox has an update. There is no email, push or external provider delivery in this phase.

Events contain restricted internal identifiers and empty structural properties; they are not anonymous. Listing views deduplicate durably by listing, declared browser-session UUID and server 30-minute window. These are recorded views, not verified unique people, visible advertising impressions or billable inventory. Sessions and organic entry sources are client-declared; community references are validated. First recipient reply measures a response, not a hire, contract or completed project. Jobs/applications and Tide registrations keep their existing records; this phase does not claim a unified cross-product attribution system.

Telemetry is pruned after ninety days, while events with pending deliveries remain for recovery. Deleted users/company records clear event actor/company references. Requests, messages, blocks, reports and deliveries follow the saved foreign-key cascade behavior on participant/company/listing deletion. This is an implemented storage policy, not completed legal retention approval. Review account closure, company handover and operational retention before a broader release.

Reports disclose that the participant's supplied reason/details are shared with platform administrators. Administrators can review that submitted material without receiving private thread access. Review alone does not resolve or sanction the reported member; operational response and evidence collection require the pilot moderation procedure.

## API and rollout

The existing API prefix applies.

| Endpoint | Behavior |
| --- | --- |
| `GET /marketplace/requests/capabilities?kind=service\|project&listingId=UUID` | Optional-auth current contact eligibility and an accessible existing request |
| `POST /marketplace/requests` | Private enquiry/response with canonical target, optional current company context, body, samples, source and idempotency key |
| `GET /marketplace/requests?box=incoming\|outgoing&page=1&limit=20` | Participant-only compact paginated inbox |
| `GET /marketplace/requests/:id` | Authorized private request detail and current actions |
| `POST /marketplace/requests/:id/state` | Accept, decline, withdraw or block |
| `GET/POST /marketplace/requests/:id/messages` | Paginated participant history / idempotent permitted message |
| `POST /marketplace/requests/:id/read` | Participant read marker |
| `POST /marketplace/requests/:id/report` | Participant-supplied safety report |
| `POST /marketplace/events/listing-view` | Validated structural listing view |
| `GET /marketplace/metrics?days=30` | Active platform ADMIN aggregate counts, 1–90 days |
| `GET /marketplace/moderation/request-reports` | Active platform ADMIN submitted report queue |
| `POST /marketplace/moderation/request-reports/:id/review` | Idempotent review marker |

`MARKETPLACE_ENQUIRIES_ENABLED` defaults to off and is enabled only by the exact value `true`. It gates new requests, acceptance and messaging. Existing authorized reads, decline, withdrawal, block and reporting remain available while it is off. `MARKETPLACE_LISTING_WRITES_ENABLED` remains the separate Phase 2 publishing control. These are deployment flags, not cohort allowlists.

Rollout order:

1. Complete the outstanding Phase 1/2 staging checks and rehearse the actual migration history on backed-up representative staging data.
2. Apply the additive Phase 3 migration, generate the matching Prisma client and deploy the backend with enquiries disabled.
3. Deploy the frontend. Verify public discovery and existing private/safety reads with the flag off.
4. Exercise separate real member/company/moderator/admin identities, session switching, revocation, mobile use, notification failure/retry and scheduler restart in staging.
5. Enable enquiries for the intended pilot environment only after acceptance. An operator can disable new contact through the flag without dropping data or interrupting hiring.

No application database migration, production flag or deployment was performed during local implementation.

## Verification evidence

Backend unit regression passed **19 suites / 304 tests**. The focused Phase 3 run passed **2 suites / 21 tests**: eighteen production-controller/service HTTP cases plus three actual-SQL migration cases. Coverage includes exact participant privacy, current company seats, self/own-company contact, concurrent submission/message/view retries, changed-key conflicts, pending/terminal consent, canonical closure/removal, account status, rate limits, pagination/read markers, community attribution, first-reply rollback, real notification-table failure/retry, blocked delivery cancellation, report/metrics privacy and directory filters.

The focused run found a concurrent listing-view deduplication race in an empty-update Prisma upsert. Event persistence now uses a native-compatible no-op update of the existing deduplication key; simultaneous HTTP requests passed the final rerun. Review also corrected notification delivery to lock and reread participant/seat authority before inserting a notification. First-reply acceptance, message, events and delivery roll back together on a forced error.

Existing marketplace API, listing moderation, linked community participation and hiring regression suites passed **35 cases**. The older Phase 2 actual-migration fixture initially failed while reconstructing its baseline because new request foreign keys referenced the listings it dropped. The fixture now removes the six empty Phase 3 tables inside its generated owned schema before reconstructing the earlier baseline; its focused rerun passed **1 case**, preserving the original data and constraint assertions. Thus **57 distinct integration cases across seven suites passed through the final focused and regression runs**, rather than a claimed final all-integration-suites run.

The Phase 3 migration rehearsal executes the saved SQL, preserves Phase 2/hiring records, and checks constraints, participant/company cascades and event actor/company `SET NULL`. Tests used only `TEST_DATABASE_URL` on the dedicated loopback PostgreSQL cluster, without application environment loading. Final inspection found zero owned fixture schemas, and that test server was stopped.

Backend production build, backend test typecheck, frontend typecheck and frontend production build passed. A frontend target check caught unsupported `String.replaceAll` in the new aggregate-count label; it now uses an ES2020-compatible expression. Existing frontend large-chunk and outdated Browserslist-data warnings remain. The main JavaScript bundle is approximately 5.48 MB before compression / 1.45 MB gzip; this phase does not establish a production performance target.

Browser checks use the real React frontend against an ignored, loopback-only synthetic session/API harness. Verified flows include service-enquiry submission into Sent, recipient first reply opening the conversation, mobile block preserving readable history while removing reply controls, report disclosure/submission feedback, project response with a private labelled HTTPS sample, and a simulated send failure preserving the draft before successful retry. The 375px inbox/response view had no horizontal overflow. A signed-out contact action opened the authentication dialog. Disabling enquiries hid the new-contact action. A forced inbox loading error showed an alert and retry control; polling recovered to the empty received-folder view after the fixture error cleared. Browser startup and some navigation/snapshot calls timed out under local load; only completed, visibly verified flows are counted. The fixture uses memory-only data and simplified identities; PostgreSQL tests supply persistence/authorization evidence, while real OAuth/session switching and company selection remain staging checks. The temporary viewport was reset, the QA tab closed and the owned preview processes stopped.

## Remaining acceptance work

- Verify real Supabase/OAuth login return and account changes while private reads or writes are pending. Local browser fixtures do not establish live authentication behavior.
- Rehearse migration compatibility, backups, account closure and original-publisher company departure against representative deployed data. Approve retention and the team handover policy.
- Test scheduler ownership/restart, forced delivery outages and backlog monitoring in the intended deployment. Watch pending counts and generic delivery failures; notifications are currently in-app only.
- Confirm keyboard/focus behavior and mobile interactions with real failures. Measure directory/query performance with realistic volume; this release uses stable filters rather than ranking.
- Run the three marketplace/employment journeys with pilot participants. Outcomes and repeat participation need real evidence; aggregate event counts do not establish adoption.
- Keep Public Broadcasts and Private Events on the separate Phase 3A gate. Streaming, protected playback, event moderation and replay are not implemented by this marketplace phase.

