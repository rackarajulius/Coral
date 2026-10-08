**Coral community marketplace development plan**

Prepared 7 October 2026. Status: Phase 0 local baseline complete; Phase 1 identity and entry points, Phase 2 records and structured participation, and Phase 3 discovery/private marketplace conversations implemented locally. Staging acceptance and rollout remain queued. Phase 3A and later phases remain queued. Scope includes Public Broadcasts and Private Events through Live Tides.

The user confirmed Canada as the pilot market and design, marketing and software as the initial categories. The [Phase 0 handoff](phase0/release-readiness.md) records the original technical baseline and open staging gates. The [Phase 1 handoff](phase1/implementation-and-verification.md) records provider opt-in without role conversion, consent-based public profiles, professional discovery, community links, current company-seat authority and migration verification. The [Phase 2 handoff](phase2/implementation-and-verification.md) records services, project briefs, linked participation, scoped marketplace moderation and local checks. The [Phase 3 handoff](phase3/implementation-and-verification.md) records private enquiries/responses, the participant inbox, discovery filters, structural events, durable notifications and local verification. Staging acceptance and production migration compatibility remain open.

**Objective**

Make Coral a professional community where companies discover talent, people find employment and project work, and professionals connect with clients. The first release must complete three journeys:

1. Company → community/profile → live job → application → existing hiring workflow.
2. Client → service listing → work evidence → enquiry → accepted conversation.
3. Professional → project brief → private response → client conversation → reported outcome.

Live Tides adds a connected event journey: company/professional → event announcement → public viewing or authorized private participation → relevant job, service or company action.

Success means useful exchanges and returning participants. Traffic, post volume and impressions support those outcomes but do not establish them.

**Planning assumptions and boundaries**

- Start with a small Canadian company cohort and professionals in design, marketing and software. The user confirmed this pilot scope during Phase 0; refine specific customer profiles within these categories during recruitment.
- Preserve existing hiring, account permissions, profile visibility and subscription workflows. Introduce service-provider capabilities without forcing a jobseeker to surrender job-search access.
- The first marketplace release supports discovery, enquiries and introductions. Contract management, escrow, payouts and marketplace commissions are later work.
- Live Tides will support both Public Broadcasts and Private Events. Start with a managed streaming integration and an embedded player; multi-camera participation and a custom broadcasting platform are later work. The marketplace and live-event releases have separate feature flags and acceptance gates.
- Estimates below assume two developers with part-time design, QA and founder-led recruitment. Re-estimate after Phase 0. Infrastructure readiness, existing regressions and cohort recruitment can change the schedule.
- This plan is based on repository inspection and the documented local Phase 0 checks. Deployed behavior, production readiness and customer adoption need separate evidence.
- The working tree contains substantial ongoing changes. Phase 0 leaves those changes in place and limits its product patch to community post/comment visibility. Coordinate affected-file ownership before each later implementation batch.

**Current foundation and gaps**

| Area | Present in the repository | Development needed |
| --- | --- | --- |
| Community | Posts, company publishing, comments, Spaces, search, reporting and moderation | Commercial post purposes, links to canonical jobs/services/projects, broader discovery and scoped moderation |
| Identity | Candidate/company visibility; provider capability/setup and public consent; professional directory; community profile links and membership labels | Real-identity staging verification; broader legacy account-management support |
| Hiring | Jobs, applications, candidate management, outreach, interviews and offers | Connect community discovery to these existing workflows |
| Services/projects | Persisted service listings/project briefs, directories, filters, details, owner lifecycle controls and private responses/enquiries | Real pilot exchanges and reported outcomes |
| Messaging | Employer–candidate recruiting conversations; separate participant-authorized marketplace requests/inbox, current company authority and consent controls | Staging validation, shared team handover policy and pilot operations |
| Events | Tides, announcements, external join links, RSVP, capacity, cancellation and reminders | Public in-feed broadcasts, protected private playback, actual live-state tracking, moderated Q&A, optional replay and viewing/sponsorship attribution |
| Revenue | Company subscriptions, entitlements and matching-based job boosts | Community/event sponsorship orders, review, fulfilment and reporting |
| Measurement | Profile/job view and application-intent events; recommendation statistics; durable structural marketplace views/submissions/replies and ADMIN aggregate counts | Outcome reporting, retention cohorts and cross-product measurement reconciliation |

Important implementation observations:

- Candidate onboarding still completes `JOB_SEEKER` accounts. Phase 1 adds provider capability to active jobseekers and a separate destination for legacy `FREELANCER` accounts.
- Candidate public-profile reads remain authenticated and privacy-gated, now admitting freelancer readers. Phase 1 signed-out previews use a separate, explicitly consented provider projection.
- Recruiting messaging excludes `FREELANCER`, and normal initiation requires an application to the company's job. Keep those safeguards; service enquiries need their own access rules.
- Phase 2 replaces the gigs scaffold with persisted project briefs and introduces service listings. Contracts remain scaffolds; private marketplace enquiries and responses follow in Phase 3.
- Phase 1 removes historical rating/project/earnings counters from self-service updates and public previews; existing counters remain owner-only and labelled self-declared.
- Community identity verification means active company membership, not verified skills or business quality.
- Community post/Space search remains. Phase 1 adds professional discovery and visibility-aware links from community authors to their work profiles.
- Existing job boosts already provide timed, relevant distribution and promoted labels. Extend that system for community entry points rather than build a competing job-promotion lifecycle.
- Space moderator authority currently reaches the global report queue. Define local moderator versus platform administrator scope before expanding commercial controls.
- Current Tides display an external join link to eligible registered attendees near the scheduled start; they have no broadcast player or confirmed stream state. Existing employer–candidate calls are peer-to-peer and do not provide audience broadcast delivery. Public playback must be separate from those private join links.

**Delivery sequence**

| Phase | Indicative effort or elapsed time | Deliverable | Release gate |
| --- | --- | --- | --- |
| 0. Baseline and contracts | 3–5 working days | Verified foundations, permission matrix and agreed scope | Critical existing journeys and migration approach are understood |
| 1. Identity and entry points | 1–2 weeks | Member intent, public evidence, provider setup and navigation | Every intended account can reach its authorized next step |
| 2. Listings and structured participation | 2–3 weeks | Persisted services/project briefs and linked community posts | Listing lifecycle and owner permissions pass staging checks |
| 3. Discovery and conversion | 2 weeks | Search, private responses, enquiry inbox and connected actions | All three objective journeys work end to end |
| 3A. Live Tides | 2–4 additional weeks; can overlap only with available capacity | Public Broadcasts, Private Events, embedded playback and host controls | Live state, private access, moderation and recovery pass staging checks |
| 4. Pilot and improvement | 2–4 elapsed weeks | Real cohort, measured marketplace outcomes and live-event trials as ready | Useful responses and repeat participation justify promotion; live-event delivery is demonstrated before live sponsorship |
| 5. Commercial pilot and self-service | 2–3 weeks after the gate | Fixed sponsorship packages with verified fulfilment | Payment, delivery, reporting and stopping conditions reconcile |

Some design, instrumentation and cohort recruitment can run alongside development. Dependencies still govern release: account capabilities → listing ownership → enquiries → outcome measurement → paid distribution. Live Tides has a second dependency chain: event access rules → streaming integration → authorized playback and confirmed state → event pilot → live-event sponsorship. Phase 3A assumes provider selection/access is ready and excludes custom streaming infrastructure. Its effort extends the schedule where the same developers are needed; the core marketplace pilot can proceed while Live Tides completes its own gate. Pilot time includes observation, not only engineering effort.

**Phase 0 — Establish the baseline**

- Walk through login, candidate/company onboarding, public visibility, job publication/application, recruiting conversations, Space membership/reporting and Tide registration in staging.
- Record current test failures separately from new work. Review actual billing-enforcement configuration without exposing credentials.
- Define a permission matrix for visitors, jobseekers, providers, company seats, Space moderators and platform administrators. Company authority always comes from server-side membership/capabilities.
- Agree category taxonomy, pricing modes/currencies, listing status transitions, enquiry consent, retention rules and reporting definitions.
- Define public versus registered/invited event access, approval/capacity and late-registration policies, recording/replay permissions, and moderator authority. Evaluate the managed streaming integration for in-feed playback, protected private streams/recordings, trusted lifecycle events, accessibility, usage limits and operational costs before committing to the Live Tides estimate.
- Define event contracts now: actor/session, entity, timestamp, entry source and optional promotion reference. Keep private enquiry content out of analytics payloads.
- Plan additive migrations, compatibility for existing posts/accounts, deployment order and feature flags. Rehearse migrations against representative staging data.

Acceptance: the team can demonstrate the existing baseline, name its unresolved failures, and explain who may publish, contact, view, moderate and purchase. Marketplace features can be disabled without disrupting hiring.

**Phase 1 — Complete identity and entry points**

- Add intent/preferences: find employment, find project work, offer services, or hire. These are capabilities/preferences, not substitutes for company permissions.
- Complete provider setup using existing personal identity and profile data; let an eligible jobseeker also offer services. Add freelancer-specific navigation and onboarding where required.
- Show work evidence, skills, availability and preferences subject to profile visibility. Link community bylines to the correct public profile; preserve company bylines and pseudonymous attribution where applicable. Make role/access checks work for intended readers; signed-out previews require an explicit, consent-respecting design.
- Make trust labels describe the check actually performed. Do not display editable ratings/earnings as verified achievements; classify existing values as self-declared until supported by evidence.
- Prepare shared positioning and entry actions: Find talent, Find work, Offer a service. Expose each action only when its underlying journey is available.

Acceptance: profile edits persist; privacy settings govern public exposure; company publishing requires the correct seat; existing candidate/employer accounts keep their workflows; each completed onboarding has a working destination.

**Phase 2 — Build the marketplace records**

- Implement service listings: owner, category, description, deliverables, work samples, availability, location/remote mode and optional pricing mode, amount and currency.
- Implement project briefs through the existing gigs module: authorized owner, scope, required skills, budget mode/currency, deadline, location/remote mode and draft/open/closed states. Reconcile the scaffold DTOs before implementing their persistence.
- Reuse existing `Job` records and application APIs for employment. A community job announcement references a real, authorized job; it does not create a parallel application system.
- Add participation purposes: general discussion, question, showcase, service announcement and opportunity. Keep purpose separate from the existing text/image/video/poll media formats; migrate old posts to general discussion.
- Canonical listings own lifecycle and permissions. Posts reference them, as Tide announcements already reference a Tide. Editing or closing a listing updates the linked card/actions everywhere.
- Provide draft, publish, edit, pause/close, report and owner-management views. Define how account closure, media deletion and moderation affect linked records.

Acceptance: listings survive reloads, paginate and filter correctly; people cannot edit another owner's records; drafts/private content never appear in public search; closed/removed opportunities reject new responses; older posts continue to render.

**Phase 3 — Connect discovery to conversations**

- Extend community discovery to services, projects, people and companies using permission-aware database queries. Reuse working post/Space search; the generic search scaffold is not an implementation dependency.
- Add category, skills, availability and remote/location filters where supported by real data. Start with clear filtering and stable ordering. Any suggestions should explain their relevance.
- Add Apply, Respond to project, Request a proposal, View work and Register actions, with login returning the member to the original context.
- Persist service enquiries and project responses with context, participants, status and timestamps. Prevent self-enquiries and duplicate submissions on retries. Keep proposals private to authorized participants.
- Introduce marketplace-specific threads/participants and adapt reusable inbox UI. Preserve recruiting conversations and their consent gates. A request enters the recipient's requests inbox; accepting or replying opens the conversation, with decline/block/report controls.
- Persist the business response before notification delivery. Retry failed notifications from a durable delivery record without creating a second response or message.
- Record listing views, enquiry/response creation, recipient replies, applications and registrations as distinct events. Capture source attribution; counters must not rely only on in-memory deduplication.

Acceptance: each objective journey works on desktop and mobile; a refresh/retry creates one response; declined/blocked requests cannot bypass consent; unauthorized users cannot read threads or proposals; notification failure does not lose the enquiry; every conversion links to its originating listing.

**Phase 3A — Public Broadcasts and Private Events through Live Tides**

| Event experience | Typical uses | Discovery and viewing rules |
| --- | --- | --- |
| Public Broadcast | Product launches, recruitment presentations, professional demonstrations and company introductions | Show the live player in the community announcement and Tide page. No RSVP is required to watch, including after the broadcast starts. Respect community visibility; signed-out viewing is allowed where the public-access policy permits it. |
| Private Event | Registered workshops, invitation-only sessions, private demonstrations and focused networking | Only authorized registrants/invitees may access playback and discussion. Hosts choose registration/approval or invitation rules. A public teaser is optional and must not expose private media, attendee details or discussion. |

Both experiences support company or professional hosts according to existing publishing authority. Keep audience access separate from `TideMode` (online/in-person/hybrid) and delivery method (external link/embedded broadcast); a hybrid event can also have a protected online audience.

Build the following:

- Extend canonical Tides with audience policy, listing visibility, delivery method, stream/session reference, actual start/end state, optional replay reference and recording preference. Store invitations, approval and access grants explicitly for Private Events. Preserve existing external-link events.
- Integrate managed video delivery. Keep host publishing credentials server-side and separate from viewer playback authorization. Do not embed the existing private meeting `joinUrl` in public feed payloads.
- Add an embedded player to the feed announcement and full Tide page, with host identity, event title, schedule, LIVE status and a watch-page action. Private cards show a registration/access action until authorization succeeds. Use explicit playback controls and avoid starting multiple audible players while scrolling.
- Use trusted, verified provider events and reconciliation to track Scheduled, Live, Interrupted, Ended and Cancelled states. Track replay readiness separately. A scheduled start time alone never produces a LIVE badge. Handle duplicate/out-of-order events, reconnection, stream failure and cancellation across feed and event page.
- Add host controls for event setup, streaming instructions, status preview, ending/cancelling, recording choice and Q&A moderation. Company-host actions retain server-side seat checks; scoped moderators can manage discussion without gaining publishing credentials.
- Enforce Private Event access on the server for playback, discussion and replay. Use the provider's protected delivery mechanism with expiring authorization; hiding an iframe or URL in the UI is insufficient. Define and test the revocation window for withdrawn/rejected invitations and removed participants.
- Reconcile event access with current RSVP behavior, which rejects new registration after the start. Permit public viewing throughout the broadcast; Private Events follow an explicit host-selected late-registration policy. Apply approval and capacity consistently under concurrent registration, and define physical versus online capacity for hybrid events.
- Provide moderated questions/comments, report/block/remove controls and a live-event stop action. Start with text interaction and one-to-many video; joining the stage with cameras is a separate feature.
- Support optional recording/replay with a clear recording notice. Hosts choose replay availability; private replays keep their access rules. Provide waiting, reconnecting, ended, cancelled and replay-unavailable states on mobile and desktop.
- Link authorized event actions to View jobs, Request a proposal or Visit company. Promotion never grants access to a Private Event or changes its eligibility rules.
- Capture watch starts, measured watch duration, unique viewers and peak concurrent viewers when supported by real telemetry. Keep registrations, actual viewing and Q&A participation distinct; avoid reporting RSVP counts as live viewers. Keep private participant details out of sponsor reports unless explicitly permitted.

Acceptance: one Public Broadcast can be discovered and watched in-feed after its start without registration; one Private Event rejects unauthorized playback, discussion and replay through both Coral and the delivery boundary; duplicate provider events do not create duplicate sessions or notifications; revocation/cancellation stops access within the documented window; a disconnected stream stops appearing healthy/LIVE; moderators can handle Q&A without host credentials; old external-link Tides still work; mobile playback, keyboard controls and mute/fullscreen behavior are verified. Recording access remains correct after the event ends.

**Phase 4 — Run the community pilot**

- Recruit a proposed starting cohort of 5–10 businesses and 30–50 relevant professionals across the chosen categories. These are operating targets, not existing users or a forecast.
- Founder/community lead supplies real briefs, helps members publish useful work evidence, and schedules relevant Tides. Engineers provide simple admin/cohort reporting and resolve observed friction.
- Extend moderation to listings/enquiries with explicit Space versus platform scope, audit history and removal/restore behavior.
- Support optional participant-reported outcomes such as interview arranged or project agreed. Label the evidence accurately; a conversation does not prove a hire, and RSVP does not prove attendance.
- Review unanswered listings, delayed responses, onboarding abandonment and mobile usability weekly. Interview both businesses and professionals about whether the exchange was useful.
- Once Phase 3A passes, trial at least one Public Broadcast and one Private Event with real hosts and permitted participants. Include a recruitment/demo broadcast and a registered or invited workshop; verify late joins, interruption, moderator actions and replay permissions before broad live-event rollout.

Track cohort counts and denominators: time to first relevant response, enquiry-to-reply, response-to-conversation, application progression, weekly returning participants, company repeat posting and unresolved reports. Observe longer retention cohorts as they mature.

For Live Tides, track registration-to-viewing, unique and concurrent viewers, watch duration, Q&A participation, access failures, playback interruption and follow-on job/service enquiries. Report counts with their measurement limits. Each live format must show reliable playback and access handling before it becomes a sponsored product.

Suggested gate for Phase 5: all three journeys have real examples; multiple businesses receive useful responses and return or express concrete repeat demand; no unresolved critical access/data-loss defects; moderation and notification recovery work; advertisers understand the actual available audience. Phase 0 records [proposed numerical gates and metric definitions](phase0/pilot-metrics-and-gates.md); review those operating targets before cohort recruitment, then report raw counts because a small pilot is not a statistically conclusive market test.

**Phase 5 — Introduce paid distribution**

- Begin with operator-managed fixed-duration job/Tide sponsorship packages. Activate against confirmed payment or an explicitly recorded complimentary pilot allocation. Keep those allocations separate from revenue.
- Reuse existing job boosts and plan allowances. Make entitlement enforcement explicit and prevent a second promotion system from spending an allowance twice.
- Add campaign/package/order records for event/community placements: owner, canonical content, approved creative, selected eligible Spaces, schedule, price/currency, payment state, review state and delivery state.
- Select approved, relevant promotions for clearly labelled slots. Provide hide/report, repeat-exposure limits, pause and a platform-wide stop control. Keep ordinary participation available.
- Define visible-impression counting and attribution windows before reporting them. Use durable deduplication; distinguish queued notifications, delivered notifications, visible placements, clicks, registrations and completed responses.
- Add self-service preview/review, checkout and scheduling after the managed pilot works. A verified payment event enables fulfilment; a checkout return URL does not.
- Cover retries and partial failures: duplicate payment events, paid-but-rejected content, cancelled/full Tides, closed jobs, moderation removal, insufficient inventory and interrupted delivery. Define refund/credit handling and retain historical results.
- Add sponsored Public Broadcast announcements and eligible Private Event invitations once Live Tides passes its own pilot. Labels and promotion placements stay visible; private video/discussion remains protected. Include broadcast outages or unavailable promised replay in package fulfilment and credit/refund rules. Paid event tickets are outside this sponsorship release.

Acceptance: payment replay grants one entitlement/order; companies cannot buy or inspect other companies' campaigns; removed/expired content stops across all placements; scheduled activation recovers after restart; failed delivery is visible to operators; reporting reconciles with business records; refunds/credits have an auditable outcome. Report registrations as registrations and later hires as attributed observations, not proof that the ad caused them.

Expand to paid service promotion only after organic service enquiries and repeat client demand support it.

**Proposed technical work packages**

| Work package | Implementation direction | Depends on |
| --- | --- | --- |
| Identity/capabilities | Extend onboarding and provider setup; preserve existing role/seat authority | Phase 0 permission matrix |
| Canonical listings | `ServiceListing` plus persisted gigs/project briefs; indexed owner/status/category; explicit currency/pricing modes | Identity |
| Community references | Post purpose and validated references to job/service/project; preserve media formats and old posts | Listings |
| Enquiries/responses | Contextual private records and idempotent submission | Listings and permissions |
| Marketplace threads | Dedicated participant-authorized threads/messages; integrate inbox presentation | Enquiries and consent |
| Discovery | Permission-aware read queries, filtering, pagination and public-profile links | Identity and listings |
| Live Tides/access | Extend Tide audience/delivery/session/replay data; registrant/invitation grants; server-authorized viewing | Phase 0 policies and existing event ownership |
| Broadcast delivery/player | Managed integration, verified lifecycle events, reconciliation, feed/page player and host controls | Streaming integration selection and Live Tides/access |
| Live discussion/measurement | Scoped Q&A moderation, watching telemetry and optional protected replay | Authorized player and confirmed lifecycle |
| Outcome events | Durable server-side conversions, exposure events, source tags and cohort aggregates | Contract defined in Phase 0; capture in each feature |
| Sponsorship | Campaign/order/review state, placement delivery and existing job-boost integration | Pilot evidence, billing and durable measurement |

Confirm final schema and API names during design. In particular, do not attach new marketplace threads to the existing employer–candidate-only conversation schema without an explicit compatibility design.

**Verification and rollout**

- Each feature gets focused authorization and state-transition tests. Add database-backed integration coverage for ownership isolation, duplicate submissions, private visibility, closed listings and concurrent enquiry/RSVP operations.
- Reuse backend test/CI conventions. Check frontend types/build, backend build, unit tests and relevant integration suites with a dedicated test database. Exercise migrations separately; schema-created test databases do not validate migration history.
- Manually verify the three journeys on mobile/desktop, keyboard navigation, login return paths, empty/error states and refresh behavior. Verify live provider boundaries in staging separately from mocked tests.
- For Live Tides, test anonymous/public and registered/invited/private access, copied playback links, revoked grants, protected replay, concurrent registration, duplicate/out-of-order provider events, interrupted streams and cancellation. Perform real-provider staging checks with a public and a protected stream; mocked tests alone do not establish delivery-boundary privacy.
- Deploy additive backend/schema changes before dependent frontend code. Enable for operators, then the private cohort, then the wider community. Use flags to pause creation or paid delivery while retaining records.
- Observe errors, request latency, notification failures and reconciliation mismatches. Require a working rollback/disable procedure and a named operator before paid launch.
- Founder/product owns categories, pilot recruitment and commercial gates; design owns journeys and accessibility; developers own data/API/UI; QA owns release evidence; a named community operator owns moderation and delivery exceptions.

**First implementation batch**

1. Baseline existing auth/onboarding/hiring/community behavior and agree permissions/event contracts.
2. Fix provider onboarding/capability routing and self-editable trust claims.
3. Complete community-to-profile navigation with visibility-aware work evidence.
4. Implement canonical service listings and project-brief persistence behind release flags.
5. Implement private responses, marketplace enquiries and contextual inbox access.
6. Integrate discovery/actions and instrumentation, then launch the measured cohort.
7. Deliver Phase 3A as a separately gated event release, pilot both live formats, then enable their sponsorship packages after delivery is demonstrated.

**Deferred expansion**

Auction bidding, automated ad-price optimization, general social messaging, complex feed ranking, gamification, automatic skills verification, escrow/payouts, full contracts and transaction commissions remain separate proposals after the initial journeys and repeat demand are established. Multi-camera interactive rooms, audience stage participation, custom video encoding/CDN infrastructure and paid event ticketing follow the initial one-to-many Public Broadcast and Private Event release.
