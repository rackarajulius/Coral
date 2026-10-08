**Phase 0 — Domain and measurement contracts**

Prepared 7 October 2026. These are implementation contracts for later phases, not shipped APIs or database migrations. Pilot scope confirmed by the user: Canada; design, marketing and software professionals.

**Identity, intent and categories**

Keep authenticated identity, account role, member intent and company authority separate. Existing `JOB_SEEKER`, `EMPLOYER`, `FREELANCER` and `ADMIN` roles retain their current meaning. Add offering-services capability/preferences alongside a person's employment preferences; do not replace their account or profile history. Company context must be resolved from active membership and the capability required for the operation.

Initial category keys are `design`, `marketing` and `software`. Store stable keys, display human-readable names, and normalize skills for filtering while preserving the member's original labels. Category selection narrows discovery; it does not grant permissions or certify expertise. CAD is the initial pilot price-entry default; retain existing currencies and require explicit currency for each priced record.

**Canonical records and ownership**

| Record | Minimum contract | Authority and lifecycle |
| --- | --- | --- |
| Service listing | ID, owner user, optional company context, category, skills, title, description, deliverables, work evidence, availability, remote/location, optional pricing, timestamps | Draft → published → paused/archived. Only an authorized owner/company publisher edits it. Publication requires complete fields and eligible public visibility. Moderation removal overrides publication. |
| Project brief | Persisted gig ID, individual/company owner, category, scope, skills, budget mode/currency, deadline, remote/location, timestamps | Draft → open → paused/closed → archived. Explicit republishing may reopen an eligible brief; archived/removed records never reopen through an old response. Closure rejects new submissions atomically. |
| Job | Existing job ID, live status and company scope | Reuse job lifecycle, seat permissions, application records and existing matching/boost rules. No second application table. |
| Project response | Brief ID, provider user, private response, optional relevant work references, submission/update time, status | Submitted → shortlisted/declined/withdrawn. The owner can shortlist/decline; the respondent can withdraw. A reply does not imply contract acceptance or project completion. |
| Service enquiry | Service ID, requester, provider, optional requester company context, private request, status, timestamps | Pending → accepted/declined/withdrawn. Only authorized participants read it; self-enquiries are rejected. Recipient acceptance/reply grants contextual conversation access. |
| Marketplace thread | Contextual enquiry/response reference, explicit participants, consent state, messages/read state | Keep separate from the recruiting employer–candidate pair identity. Only admitted participants can read/send; block/revocation stops further contact. |
| Community announcement | Post purpose plus validated canonical job/service/project/Tide reference | The canonical record governs actions and visibility. A post cannot make a private/draft/closed record public or actionable. Existing media `PostType` and existing posts remain compatible. |

Community purposes: general discussion, question, showcase, service announcement and opportunity. All legacy posts default to general discussion. Preserve pseudonymous/anonymous attribution where it is currently allowed; do not turn an anonymous byline into an identity link.

Money is recorded with an explicit pricing mode (`fixed`, `hourly` or `quote`), currency and integer minor-unit amounts where applicable. Interpret minor units using that currency's exponent, not an assumption that every currency has two decimals. Budget ranges require minimum ≤ maximum. Quote/negotiable modes may omit an amount. Display provider-entered prices as offers, not platform-validated transaction receipts.

Draft, paused, removed and expired records have defined read behavior; no action is authorized merely because a cached card still exists. Mutations recheck canonical state inside their database transaction. Account suspension, closure and company membership removal must be reflected in access and discovery, including linked posts.

**Enquiry consent and retry contract**

1. An authenticated eligible member submits a bounded private request tied to a visible, open canonical listing.
2. The server resolves recipient and company context; the browser cannot claim to represent another company or pick an arbitrary recipient for a listing.
3. A scoped idempotency key or equivalent durable uniqueness constraint returns the existing submission on retry. Reusing a key for different content is a conflict. Define an explicit follow-up/reopen policy rather than create repeated pending enquiries to the same listing/provider.
4. Commit the response/enquiry and its notification-delivery record atomically. Notification failure never erases the request.
5. The recipient may accept, reply, decline or block. A reply may accept the request, but unrelated members and arbitrary company seats do not gain access.
6. Preserve existing recruiting application/outreach consent rules. A new service enquiry is not a route around those rules.
7. Withdrawn, blocked and removed records reject stale actions. Rate-limit submission and attachments by authenticated actor and context.

**Live Tides access and lifecycle contract**

Keep audience policy, listing visibility, delivery method and `TideMode` independent:

| Dimension | Values / rule |
| --- | --- |
| Physical format | Existing online, in-person or hybrid format |
| Delivery | Existing external join link or managed embedded broadcast |
| Audience | Public broadcast; private registered event; private invited event |
| Listing visibility | Discoverable public metadata or restricted invitation metadata; public teaser is an explicit option |
| Admission | Public requires no RSVP to watch. Private requires an authenticated, active, approved access grant; capacity and invitation rules apply. |
| Late joining | Public viewers may watch after start. Private hosts explicitly allow or disallow late registration; an existing valid admission may join while live. |
| Recording | Explicit host preference with participant notice; replay availability and access are separate from live state |

Scheduled → live → ended is driven by verified stream events and reconciled provider state. Interrupted and cancelled are explicit states. The scheduled start is not evidence of a live feed; replay readiness is not evidence that the event is still live. Out-of-order/replayed provider events must not resurrect an ended/cancelled session.

Publishing credentials stay server-side. Viewer authorization never includes publishing rights. Protected playback, Q&A and private replay require canonical admission checks and a provider protection mechanism; hiding a player in the frontend is insufficient. Define a short token lifetime and test the documented access-revocation window. Public metadata/teasers and existing post comments must not leak private event discussion or attendee data.

Existing external-link Tides retain their current behavior until migrated through an explicit compatible change. Baseline gaps include join URLs remaining available after the event's end and capacity transactions that do not establish concurrency safety. Record those gaps and fix/test them before treating external-link admission as the private live-event access layer.

**Event envelope — version 1**

The collector and persistent schema will be implemented in later phases. Existing employer analytics remains a separate producer; map compatible events during integration rather than count the same conversion twice.

| Field | Contract |
| --- | --- |
| `eventId` | Unique durable event identity; retries preserve it |
| `schemaVersion` | `1`; unknown versions fail validation rather than silently reinterpret payloads |
| `type` | Allowlisted name from the catalogue below |
| `occurredAt` / `receivedAt` | UTC event and server receipt instants; constrain client clock skew |
| `entityType` / `entityId` | Valid canonical target; authorization/lifecycle is resolved server-side |
| `actorId` | Server-resolved authenticated actor where needed; never trusted from browser payloads |
| `sessionId` | Bounded pseudonymous session identifier for exposures; no raw IP or contact details |
| `companyId` | Server-resolved eligible company context; not a client-provided analytics owner |
| `source` | Organic, sponsored or direct; server-validated promotion reference where present |
| `promotionId` | Optional eligible campaign/boost reference; analytics attribution does not grant access |
| `contextId` | Optional validated post, Space, enquiry/thread or stream-session reference |
| `properties` | Event-specific allowlist only; reject unknown/private fields rather than accept arbitrary JSON |

The example below illustrates a server-generated business event; it is not an endpoint that accepts a browser-supplied actor/company identity:

```json
{
  "eventId": "8c8e0634-6ad0-4d4b-b338-a8e98b9c27d0",
  "schemaVersion": 1,
  "type": "service_enquiry_submitted",
  "occurredAt": "2026-10-07T09:00:00Z",
  "entityType": "service_listing",
  "entityId": "c1104ee0-2026-4b7c-9652-96fd4bfe3d10",
  "actorId": "ac59c2f3-8348-4418-b32d-230814065fd8",
  "source": "organic",
  "properties": {}
}
```

**Event catalogue and evidence**

| Event | Producer / deduplication boundary | What it proves |
| --- | --- | --- |
| `listing_view` | Authorized browser/server view; one target per qualified session/window | A view, not interest or a lead |
| `service_enquiry_submitted` | Server after durable enquiry commit; unique enquiry/business event | A submitted request, not qualification |
| `project_response_submitted` | Server after response commit; unique response/business event | A private response exists |
| `marketplace_request_accepted` | Server on first admitted transition; unique request/version | Recipient consent to conversation |
| `marketplace_recipient_replied` | Server on first recipient reply; unique request/thread milestone | A two-sided exchange, not a contract |
| `marketplace_response_assessed` | Authorized recipient assessment; unique request/assessment version; restricted provenance and reason code | A recorded relevance assessment, not independently verified skill or completion |
| `application_submitted` | Existing application commit/adapter; unique application ID | Application submission, not an interview or hire |
| `tide_registration_confirmed` | Server on a successful new GOING/admission transition; unique registration transition | Registration, not attendance |
| `broadcast_playback_started` | Authorized player after actual playback; stream-session and viewer-session identity | Playback began, not total watch duration |
| `broadcast_watch_interval` | Bounded active-playback interval; durable unique interval key | Observed viewing duration; pauses/stalls excluded |
| `broadcast_question_submitted` | Server after authorized question commit; unique question ID | Participation; body is excluded from analytics |
| `promotion_impression` | Qualified visible placement; one placement/viewer/window | Exposure under the declared rule, not a sale |
| `promotion_clicked` | Valid rendered placement; one interaction identity | Click with validated attribution |
| `outcome_reported` | Authenticated participant action; entity/report/version | A participant report, not independently verified completion |

Browsing can remain available if best-effort exposure capture fails. Business transitions must have durable records and retryable event emission so failures do not lose conversions. Existing in-memory analytics deduplication is not adequate for billing or cross-instance uniqueness.

Define unique-viewer and concurrent-viewer counts separately. Store bounded active watch intervals; concurrent viewers require active presence/heartbeat expiry, not lifetime play counts. Do not infer attendance from RSVP, a hire from an application, verified ratings from editable profile statistics, or paid revenue from complimentary allocations.

**Reporting, attribution and retention defaults**

Use the versioned [pilot metric dictionary and proposed gates](pilot-metrics-and-gates.md). Qualifying activity, mature request denominators, relevant-response assessment and exposure rules require explicit implementations; the document alone does not collect events.

- Report raw counts and denominators for the small pilot: enquiry-to-reply, response-to-conversation, application progression, registration-to-viewing, repeat company participation and returning members by category.
- A relevant response is a recipient/authorized operator's explicit assessment, with the assessor and timestamp; do not classify every submission as qualified.
- Proposed initial promotion attribution window: seven days from a recorded eligible click to the first canonical conversion, with direct and organic activity retained. Treat attribution as association, not proof of causation. Freeze the window/definition per campaign report version.
- Proposed raw telemetry retention is 90 days; aggregate cohort metrics retain no private text/contact data. Confirm operational retention before pilot release and integrate account closure/consent withdrawals with existing deletion paths. Business records follow their defined lifecycle rather than an analytics TTL.
- Analytics may use internal actor IDs under restricted access; they are not anonymous data merely because email is omitted. Sponsors receive scoped aggregate reports, not private enquiry text, raw attendee identities or contact exports by default.

**Migration and rollout contract**

Add new tables/nullable references first. Backfill old post purposes as general discussion; preserve current role values, price currencies, recruiting conversations and external-link Tides. Validate new fields and canonical ownership before enabling writes. Deploy backward-compatible reads before the frontend uses the new records. Rehearse additive migrations and rollback/feature-disable behavior in a dedicated staging copy; tests generated from the final schema do not prove migration correctness.

Planned independent server gates: marketplace listing writes, marketplace enquiries, live public broadcasts, live private events and paid community promotions. Missing/unrecognized flag values mean disabled. Frontend visibility follows server capability/config responses, not a browser flag that can authorize a mutation. Disabling a creation flag preserves authorized reads/history; emergency live-event or promotion shutdown also disables active playback/delivery through the appropriate protected boundary.

These flags and routes are not implemented in Phase 0. Their absent state must not be presented as a live marketplace or broadcast capability.

**Next-phase acceptance inputs**

Phase 1 uses the permission matrix, confirmed pilot taxonomy and privacy/trust gaps. Phase 2 implements canonical listing state and migrations. Phase 3 implements enquiries and durable conversions. Phase 3A requires a tested protected streaming integration and access/replay proof. Commercial release requires durable delivery counts, explicit billing enforcement and payment reconciliation.
