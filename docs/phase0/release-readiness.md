# Coral Phase 0: baseline and next-phase handoff

Prepared 7 October 2026. Local technical baseline and contracts are complete: frontend/backend builds and typechecks, 142 unit tests and 40 integration cases pass. Staging acceptance and migration rehearsal remain open. Later phases are queued.

## Confirmed pilot

- Market: Canada.
- Categories: design, marketing and software.
- Core journeys: companies find talent; talent finds employment/project work; professionals find clients.
- Live Tides: Public Broadcasts and Private Events, delivered through the separately gated Phase 3A.
- Initial marketplace: discovery, enquiries and introductions. Payments to providers, escrow and commissions need separate development scope.

## Deliverables

| Artifact | Purpose | Current status |
| --- | --- | --- |
| [Development roadmap](../community-marketplace-development-plan.md) | Sequential phases, dependencies and acceptance criteria | Updated with the confirmed pilot |
| [Permissions and access](permissions-and-access.md) | Current versus intended account, company, content, enquiry and event authority | Code baseline recorded; target policies specified |
| [Domain and event contracts](domain-and-event-contracts.md) | Listing/request lifecycles, contextual conversations, analytics and Live Tides access | Implementation defaults documented; schema/API work belongs to later phases |
| [Pilot metrics and gates](pilot-metrics-and-gates.md) | Versioned definitions, observation windows and proposed commercial thresholds | Defaults documented; results will be collected in Phase 4 |
| [Community baseline](community-baseline.md) | Existing community/event behavior and concrete gaps | Focused regression coverage added |
| [Verification results](baseline-test-results.md) | Executed checks, warnings and evidence limits | Passed: 13 unit suites / 142 cases, 4 HTTP integration suites / 33 cases and 7 community database/service cases |

## Product change in this batch

Removed posts previously remained available through their direct API and comment routes. The patch rejects those reads and new comments, filters removed nested discussion, and redacts removed originals embedded in reshares. Retained records remain available to the existing moderation review path.

Comment creation locks and rechecks the live post; replies also lock and recheck their target inside that transaction. Failed checks roll back the counter. Comment deletion uses post-first locking, consistent with creation and hard post cascades. Reshare creation also applies the shared response redaction.

Verification includes isolated PostgreSQL service tests and controlled stale-read cases. Community HTTP access, exhaustive concurrent schedules and deployed behavior still need separate evidence. No new marketplace listing, provider capability, broadcast player, payment flow or schema migration ships in this batch.

The existing HTTP test harness also needed its current `ExternalApplicationsService` registered so the four existing suites could bootstrap. This fixture-only compatibility fix changes no application behavior. All suites cleaned their owned test schemas; the verified local test cluster was stopped after verification.

## Gates and ownership

| Gate | Required evidence | Timing / owner |
| --- | --- | --- |
| Existing journeys | Synthetic candidate and employer complete login/onboarding, job application, hiring conversation, community post and RSVP in staging; record observed results | Before enabling the next phase; developer + QA |
| Migration compatibility | Rehearse the actual additive migrations on representative synthetic/staging data; old rows/clients and rollback/disable path remain usable | With each schema change; developer |
| Provider identity and trust | Provider opt-in preserves employment access; public visibility respected; editable counters never presented as verified | Phase 1; developer + product |
| Company control | Current authorized seats manage company-owned records; departed/suspended seats lose authority | Phases 1–2; developer |
| Moderator scope | Local Space moderators cannot inspect or act on another Space's reports/content | Before expanding the pilot; developer + community operator |
| Marketplace consent | Private requests/attachments isolate participants and companies; retries persist one response; notification recovery is durable | Phase 3; developer + QA |
| Account closure | Provider-enabled account cleanup, company ownership and media/grant revocation verified using synthetic accounts | Before new relations release; developer |
| Live Tides delivery | Choose/test managed integration; public no-RSVP/late viewing; private revoked/copied-link denial and protected replay; actual stream lifecycle/recovery | Before Phase 3A release; developer + event operator |
| Existing event gaps | Expired join links, RSVP capacity contention, active Space validation and last-moderator handling receive explicit policies/tests | Before expanding event/community administration; developer |
| Commercial readiness | Durable measurements and billing enforcement reconcile; audience/outcomes and operational pilot thresholds are reviewed | Before Phase 5; product + developer |

Roles above identify responsibilities, not people already assigned. A named moderation operator and live-event operator are needed before the corresponding pilot.

## Deployment and configuration limits

The local billing-enforcement setting is unset in this checkout; production enforcement has not been inspected. Analytics currently has in-memory deduplication and an unstable fallback identifier salt when no explicit salt is configured. These are unsuitable as proof of billable delivery. Durable event capture, configured identifiers and entitlement checks are gates for paid distribution.

Marketplace and Live Tides flags are specified as future server controls; they are not implemented in Phase 0. The current moderation patch needs no schema migration. Schema-created integration databases verify the current model, while migration rehearsal verifies the deployment history.

## Next development batch

Phase 1 starts with provider capability/onboarding, visibility-aware work evidence and navigation, and safe trust fields. An existing jobseeker must be able to offer services while retaining hiring access. Keep company seat authority separate from member intent. Add the corresponding access tests as the feature is implemented.

Use this handoff and the local test results for the Phase 1 design. Keep the staging gates above visible during implementation; Phase 1 and Live Tides release require their own acceptance evidence.
