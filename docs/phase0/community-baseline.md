# Community and Tides baseline

Audit date: 7 October 2026. Scope: existing community services and controller routes, before marketplace listings, enquiry conversations, public broadcasts, or protected streaming are implemented.

## Automated evidence

`backend/test/modules/community/phase0-baseline.spec.ts` exercises actual `PostsService`, `SpacesService`, `ModerationService`, and `TidesService` methods with narrow mocked collaborators. No external accounts, database, authentication provider, storage, or streaming service are used.

The suite protects these existing boundaries:

| Area | Existing behavior exercised |
| --- | --- |
| Company publishing | Company identity is derived from company context; only owners/admins can publish as the company. Recruiting and viewer roles are denied. Missing authority does not silently publish as the individual. |
| Post mutation | An ordinary member cannot edit or delete another author's post. |
| Space lifecycle | Archived Spaces reject membership and ordinary postability checks. |
| Space banner | Moderator membership is checked for the particular Space. |
| Tide viewing | Anonymous viewers, non-attendees, interested attendees, early attendees, and cancelled events receive no meeting link. A GOING attendee receives the link at the one-hour opening boundary. Detail and listing use these same rules. |
| Calendar | The calendar download links to the Tide page and excludes the stored meeting URL. |
| Tide management | Original hosts and same-company owners/admins can edit; recruiters, other-company owners, and unrelated users cannot edit/cancel. Recruiters cannot create in the company's name. |
| RSVP | Full events reject new GOING reservations; repeating GOING remains possible; INTERESTED does not require a place. Capacity cannot shrink below attendance. Late/cancelled RSVP and cancelled-event edits are rejected. Repeated cancellation is idempotent. |
| Moderation | Ordinary members cannot read the reports queue or dismiss reports. Platform admins can read it. One characterization explicitly records the current global authority of any Space moderator. |

Run the focused suite from `backend` with:

```powershell
node node_modules/jest/bin/jest.js --runInBand test/modules/community/phase0-baseline.spec.ts
```

These tests establish service-level decisions with controlled inputs. They do not prove HTTP guard behavior, real database constraints, concurrent capacity safety, scheduler delivery, user interface journeys, or production streaming access.

## Gaps and release gates

| Gap | Evidence in current code | Required follow-up |
| --- | --- | --- |
| Global Space moderator authority | `ModerationService.assertModerator` accepts moderator membership in any Space. `listReports` filters only by report status; removal/restoration/dismissal share the same global check. The characterization test is labelled as a gap with a TODO. | Scope decisions and report visibility to the target's Space; define handling for legacy posts without a Space and preserve platform admin oversight. |
| Expired meeting link remains available | `TidesService.shapeMany` checks only whether start is within an hour, GOING status, and cancellation. It does not check `endsAt` or an elapsed-event cutoff. | Define the join lifecycle, revoke expired access, and cover an end boundary. Streaming must have its own protected playback lifecycle. |
| Capacity concurrency not established | `TidesService.rsvp` performs count and upsert inside a transaction without explicit isolation, locking, or atomic reservation logic. `update` counts attendance before its capacity write. | Add a real PostgreSQL concurrency test and a reservation strategy that prevents overbooking and conflicting capacity changes. Passing mock tests is insufficient. |
| Tide announcement bypasses ordinary Space checks | `TidesService.create` writes `tx.post` for `dto.spaceId` directly, while `PostsService.create` calls `SpacesService.assertPostable`. | Apply the same valid/active Space policy to Tide announcements and verify atomic failure. |
| Moderator can leave their Space | `SpacesService.leave` deletes the caller's membership without checking whether they are its last moderator. | Define moderator transfer/retirement behavior before offering broader community administration. |
| Mutations of company posts use original author authority | `PostsService.update` and `delete` permit only the original author or platform ADMIN; company owner/admin authority is used for publishing, not post maintenance. | Decide company ownership rules explicitly; do not imply that every company admin can maintain every company post today. |
| Public broadcast/private event distinction absent | Current DTO/schema modes describe ONLINE, IN_PERSON, and HYBRID. Public metadata and attendee-gated meeting URLs are not a protected streaming or invitation model. | Phase 3A must add visibility/admission, verified live state, public viewing, protected playback, host controls, moderation, and replay policy. |

These are recorded implementation gates, not newly implemented features or claims of production readiness. Marketplace identity and enquiry permission work is covered by the wider Phase 0 plan.

## Removed-content baseline fix

Phase 0 also adds [moderated-content-boundaries.spec.ts](../../backend/test/modules/community/moderated-content-boundaries.spec.ts) and [community.e2e-spec.ts](../../backend/test/community.e2e-spec.ts). Ordinary post detail and comment endpoints reject removed posts; nested comments/replies exclude removed records; feed/detail and create-reshare responses redact removed originals. Comment/reply creation rechecks the post and reply target under database locks. Comment deletion acquires the post lock first to keep lock order consistent with creation and hard post deletion.

The database suite verifies filtering, restoration, counter rollback after controlled stale reads, and normal reply/thread deletion. This is service/database coverage; it does not exercise community HTTP guards or establish every concurrent schedule. Global Space moderator scope remains a separate open gate. See [verification results](baseline-test-results.md) for executed commands and outcomes.
