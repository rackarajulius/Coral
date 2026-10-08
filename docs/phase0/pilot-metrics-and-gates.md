# Coral pilot measurement and commercial gates

Prepared 7 October 2026. Metric dictionary: `coral-pilot-v1`. These are proposed operating defaults for the Canadian design, marketing and software cohort. They define later implementation and evidence collection; no pilot outcomes, audience size or revenue are claimed.

## Measurement rules

Use canonical entity/request IDs, explicit timestamps and fixed cohort windows. Count company participation by Company ID across its seats. Label synthetic/internal activity, duplicate submissions and confirmed spam as exclusions; keep an exclusion count. Unanswered, declined and unsuccessful requests remain visible.

| Metric | Version 1 definition |
| --- | --- |
| Activated professional | Eligible personal member completes their profile/work evidence and performs a qualifying substantive action. Enabling services is required only for service providers. |
| Participating business | Cohort company publishes a listing, responds to a request or hosts a Tide. Login/page views alone do not qualify. |
| Relevant response | Recipient assesses a canonical enquiry/project response as relevant to the published need. Persist assessor, timestamp, assessment version and reason code. An operator may record recipient feedback with provenance; this gives no blanket access to private proposals. Report relevant, assessed-not-relevant and unassessed counts separately. |
| Enquiry-to-reply | Distinct eligible enquiries with a first recipient reply within seven days / all submitted eligible enquiries with seven days of observation. Acceptance is a separate consent milestone. |
| Response-to-conversation | Distinct eligible project responses with a first recipient reply within seven days / all submitted eligible responses with seven days of observation. Acceptance/shortlisting without a reply is reported separately. |
| First relevant response | Elapsed time from publication to first recipient-assessed relevant response. Report the median among answered listings alongside mature listing count and unanswered count. |
| Repeat business participation | Company performs a second substantive action in a later pilot week: publish another listing, respond to another request or host another Tide. |
| Returning professional | Activated professional performs another substantive action in a later week: publish useful work/discussion, submit a request/application, reply in a contextual conversation or participate in a Tide. Freeze exact action types before cohort start. |
| Registration | Unique admitted users/current GOING registrations reported separately from state transitions. Withdrawal/re-registration cannot inflate unique registrants. |
| Live viewing | Report playback starts, active watch time and engaged viewers separately. Proposed engagement: at least 30 accumulated seconds of active playback per Tide. Anonymous sessions are sessions; cross-device people are not established by this identifier. RSVP is not attendance. |
| Promotion attribution | Credit a conversion to the latest eligible recorded click within seven days, using one campaign per conversion. Preserve organic/unattributed activity. Freeze rules per campaign/dictionary version; association does not prove causation. |
| Promotion impression | Proposed Coral rule: at least 50% of card visible for at least one second; deduplicate placement/session within 30 minutes. Implement and validate durable counting before charging/reporting delivery. This is a proposed product rule. |

The future listing-view collector must also specify its qualified visibility and deduplication window before reporting unique views. Consent and exposure telemetry do not replace durable business records. Sponsors receive authorized aggregates; participant identity and private content remain protected.

Relevant-response assessments require a durable record associated with the request and its version. Analytics carries the assessment category/provenance, not proposal text or private reasons. Capture first recipient reply once per request milestone. Define cohort timezone (initial default: UTC for stored week boundaries), start/end and category membership before collection; report timestamps clearly for operators.

## Proposed gate for an operator-managed paid pilot

Review these operating targets before recruiting the cohort. They are hypotheses for a small pilot, not forecasts or validated market benchmarks. A broad self-service advertising release needs additional evidence.

| Gate | Proposed threshold | Evidence |
| --- | --- | --- |
| Observation window | Four weeks after hard release checks pass | Fixed start/end; weekly snapshots; seven-day request cohorts mature before assessment |
| Cohort activity | At least 5 participating businesses and 30 activated professionals | Distinct canonical company/member IDs and qualifying actions |
| Usable supply | At least 10 distinct listings with seven days of public availability, including at least 2 per initial category | Service/project/job records and publication periods; show early closures separately |
| Useful response | At least 6 mature listings receive an assessed relevant response, spanning at least 3 businesses | Canonical request plus recipient assessment; job relevance may use an explicit employer assessment |
| Journey proof | At least 1 non-test progression in each core journey | Job application to employer action; service enquiry to recipient reply; project response to conversation |
| Repeat demand | At least 3 businesses perform a second substantive action in a later week | Company/action/week evidence |
| Commercial interest | At least 2 businesses express willingness to buy a specified package at its disclosed price | Recorded consented interview or written intent; no charge or revenue is inferred |
| Hard release gate | Zero unresolved critical access/data-loss defects; recovery and reporting demonstrated | Scoped moderation, notification retries, durable measurements, entitlement checks and reconciliation evidence |

Define the proposed sponsorship package, deliverables, price and currency before the commercial-interest interview. Phase 5 implements fulfilment/payment; recording interest does not activate a charge. Complimentary pilot allocations remain separate from paid revenue.

If operational targets are missed, extend observation or revise the flow and measure again with a new dictionary version where definitions change. Engineering defects require resolution before paid release. Public Broadcast and Private Event sponsorship additionally require the independent Phase 3A delivery/access gate and successful real-host trials.
