# Phase 0: permissions and access baseline

Prepared 7 October 2026 for the [community marketplace roadmap](../community-marketplace-development-plan.md). This document records repository behavior and implementation defaults for Phases 1–3A. The removed-content boundary received the Phase 0 fix described below; other target policies remain proposals to implement and verify. Deployment evidence is tracked separately.

## Evidence boundary

The controllers, guards, services and Prisma schema referenced below were inspected in the current working tree. No authenticated staging walkthrough, database migration, live-provider playback or account deletion was performed for this document. Existing test files are not proof that the deployed configuration behaves the same way. The Phase 0 baseline checklist must retain separate results for code review, automated checks and staging evidence.

All protected actions use the server's authenticated user ID. Client-supplied owner, company, participant or permission claims never grant authority. Authentication, platform role, company membership, personal provider capability, record ownership and consent are separate checks.

## Current versus target matrix

`Personal member` below means an active JOB_SEEKER or FREELANCER. A provider is a personal member with service offering enabled; it is not a new company seat. `Company seat` means a current active membership with the required capability. Existing EMPLOYER accounts with no admitted company membership retain their current sole-operator recruiting behavior.

| Action | Verified current code | Target policy / next implementation |
| --- | --- | --- |
| Read community posts and Spaces | Public routes permit signed-out reads. Post listings exclude removed posts. Space membership is a feed preference and participation record, not a privacy boundary. | Preserve public community discovery. Every direct read, search, linked card and comment read must apply removal and canonical entity visibility. Add no private Space assumptions. |
| Create a personal post, comment, Space or Tide | Authentication required; no specific platform role on these controllers. JWT guard rejects SUSPENDED/BANNED, but PENDING_ONBOARDING is not denied globally. A live Space is required for posts; membership is not required. | New marketplace publishing and enquiries require ACTIVE onboarding. Retain existing public participation until an explicit community policy change. Use a server-side active-account check for new actions rather than change the global guard and break setup flows. |
| Edit/delete a personal post or comment | Author or platform ADMIN. | Preserve owner control; reject removed/private parent content where appropriate. Platform moderation retains an audit trail instead of silently rewriting private/commercial records. |
| Publish a company post or Tide | Active company OWNER/ADMIN, derived on the server. No membership means no company voice, even for an EMPLOYER. | Preserve this rule. Canonical company listing references must belong to that company. Recheck company membership on each company mutation, not only creation. |
| Edit company posts/Tides after seat removal | Post edits check author ID or platform ADMIN. Tide edits accept the original host before checking current membership; other company OWNER/ADMIN seats can edit Tides. | Remove historical-author bypass for actions taken in the company's name. Current authorized seats keep control of company records after a colleague leaves. Preserve attribution; do not transfer ownership to a former seat's personal account. |
| Read a candidate's professional profile | Signed-in JOB_SEEKER/EMPLOYER/ADMIN only. Owner/admin, discoverable + profileVisible, or applicant-company relationship permits reading. Discovery redacts email. | Allow intended provider readers through the same visibility rules. Introduce a separate opt-in signed-out professional preview with an explicit public-field serializer; do not make the recruiting profile anonymous by removing its guards. |
| Read a company page | Public, except `visibility === private`, which returns 404. | Preserve private-page denial in discovery, bylines and linked actions. Keep public company page ID distinct from Company ID. |
| Read a freelancer profile | Public endpoint; service returns the full freelancer record with selected user identity. No profile visibility or target-user status gate is present. | Add explicit provider discovery/public-preview settings and serializer before exposing this API through marketplace navigation. Hidden/unavailable profiles return 404; owner reads use the protected owner endpoint. |
| Edit a freelancer profile | FREELANCER/ADMIN can edit their own profile; DTO accepts rating, completedProjects and totalEarnings. | Eligible personal members can enable a provider capability without changing their existing role. Self-edit permits descriptions, skills, work evidence and availability. Ratings/earnings/completion statistics require a separate trusted source; historical values are self-declared and excluded from verified metrics. |
| Publish a service listing | No completed canonical listing flow. | ACTIVE personal member + enabled provider capability; server assigns personal owner. Company service listings require company OWNER/ADMIN authority and explicit company ownership. No trust or company rights arise from enabling services. |
| Publish employment/project opportunities | Existing jobs follow hiring authority; gigs are scaffolds. | Employment remains an existing Job + existing applications. Personal project briefs require ACTIVE owner; company briefs require current company publishing authority. Drafts are visible only to authorized owners; public cards reference canonical published records. |
| Apply for employment | Existing application/hiring system. | Preserve current candidate eligibility and consent. Provider opt-in must not remove a JOB_SEEKER's hiring access or create a second application system. Broader legacy FREELANCER employment access is a separate compatibility change, not an implicit effect of this plan. |
| Start recruiting chat | EMPLOYER/ADMIN role and messaging:write for employer seats. Candidate must have applied to the caller company's job. FREELANCER excluded. | Preserve applicant consent and recruiting routes. Community interaction or service opt-in never supplies recruiting consent. Validate any supplied job context against the company and candidate relationship. |
| Read/reply in recruiting chat | Candidate participant or the employer side resolved through company context. Read routes do not require messaging:write; employer send/upload do. ADMIN has no blanket service-level participant bypass. | Keep existing recruiting behavior and prove seat-status boundaries. Marketplace participant grants never open recruiting conversations or application attachments. |
| Send service enquiry / project response | No completed private marketplace flow. | ACTIVE account may submit to an available published listing, subject to eligibility/block rules. No self-enquiry. Persist one request on retry. Initial request reaches a private requests inbox; recipient acceptance or reply opens the conversation. Decline/block prevents continued contact. |
| Read marketplace requests and messages | No completed flow. | Explicit personal participants or designated, currently authorized representatives of the owning company. Company membership alone grants no access to every personal enquiry. Use distinct marketplace records/participants and consent states. No automatic platform ADMIN reading of private content; any moderation access must be purpose-scoped and audited. |
| Report content | Any signed-in member can report another member's post/comment. | Preserve reporting; extend to services, projects and enquiries. A report confers no access to private content. Report detail is accessible only to the authorized review scope. |
| Moderate community | Any Space moderator or platform ADMIN can access the global report queue and remove/restore any post/comment. | Space moderators can act only on content in their Space. Platform ADMIN handles global/Space-less reports. Event moderation is explicitly delegated per Tide and cannot expose stream publishing credentials or marketplace messages. |
| Watch a Public Broadcast | No embedded stream implementation. Existing Tide metadata is public; joinUrl is RSVP/time gated. | Public canonical event + visible announcement permits viewing without RSVP, including late viewers. Signed-out viewing may use only the public playback endpoint. Chat/Q&A submission requires an ACTIVE account; host may disable discussion. |
| Participate in a Private Event | No invitations, approval or protected player. GOING RSVP currently releases an external join link near start. | Active approved registration or accepted invitation grants playback/discussion; host and authorized event operator access is explicit. Enforce access server-side and at the delivery provider. GOING alone is not approval for new private events. Public teaser contains no protected media or participant details. |
| Access event replay | No replay implementation. | Optional host choice with recording notice. Public replay requires explicit public availability; private replay retains grant checks. Cancelled/withdrawn/revoked access expires within the documented provider authorization window. |
| Purchase/operate promotions | Existing billing/company capabilities and job boosts; no full community/Tide sponsorship flow. | Billing authority determines purchase. Publishing authority determines eligible content. Payment never grants private-event access, verified identity or moderator authority. Historical campaign reporting remains company-scoped after seat changes. |
| Close account | Self-service closure only for JOB_SEEKER with exact CLOSE confirmation. Billing/storage/auth/database cleanup is coordinated; user relations cascade, including hosted Tides. | Provider opt-in leaves this route available. Before adding records, define listing closure, private-message retention, file deletion, grant revocation and analytics anonymization. Do not expose FREELANCER/company closure by simply broadening this role guard. Company-hosted records need an ownership/lifecycle design before expanding closure. |

## Company seat baseline and marketplace defaults

Current authority comes from [capabilities.ts](../../backend/src/company/capabilities.ts) and [CompanyCapabilityGuard](../../backend/src/company/company-capability.guard.ts). `ADMIN` below is a company seat, separate from the platform UserRole.ADMIN.

| Company seat | Jobs write | Recruiting messages write | Company page write | Billing manage | Company post / Tide host | Proposed company listings / marketplace operations |
| --- | --- | --- | --- | --- | --- | --- |
| OWNER | Yes | Yes | Yes | Yes | Yes | Yes |
| ADMIN | Yes | Yes | Yes | No | Yes | Yes; purchase still requires billing authority |
| RECRUITER | Yes | Yes | No | No | No | No by default |
| HIRING_MANAGER | No | Yes | No | No | No | No by default |
| INTERVIEWER | No | No | No | No | No | No by default |
| VIEWER | No | No | No | No | No | No by default |

Use dedicated marketplace publishing/messaging capabilities when company delegation is introduced; do not infer them from `messaging:write`, which currently means recruiting. Initially OWNER/ADMIN may manage company marketplace listings and assigned company enquiries. Any later recruiter delegation must change both API enforcement and the UI permission description.

Compatibility details:

- CompanyContextService includes records authored by ACTIVE, SUSPENDED and REMOVED colleagues when building company scope. That preserves company work; it does not authorize those colleagues to act. PENDING membership is excluded.
- Existing sole-operator fallback permits own recruiting records when no admitted membership exists. Keep it for old hiring APIs. It does not fabricate a verified Company ID or permit company-branded posts/Tides. PENDING membership currently behaves as no admitted membership for this lookup.
- CompanyCapabilityGuard deliberately passes non-EMPLOYER users on shared routes. It is not sufficient protection for a new company-owned marketplace endpoint. Require the intended actor type, current membership/capability and matching record company together.
- Company identity's verified label means active membership, not business quality, skill assessment or a paid verification.
- The current INTERVIEWER seat has company-wide interview access; there is no per-interview assignment model. Marketplace work must not claim it has narrowed that existing scope.

## Consent, visibility and Live Tides implementation rules

Use separate visibility decisions for personal identity, professional evidence, hiring data, service listings, event discovery and playback. Public participation can reveal a byline without granting access to the author's hidden professional profile. Search must filter in its database query; fetching everything and hiding cards in the UI is insufficient.

Marketplace requests must record initiator, recipient/owning company, canonical listing, status, timestamps and idempotency key. An enquiry to a service grants consent only for that enquiry. A private project proposal is visible to its author and authorized recipient representatives; it is not a community comment. In the first release there is no free-form unsolicited social messaging.

For Live Tides, keep `TideMode` (ONLINE/IN_PERSON/HYBRID), discovery visibility, audience policy and delivery method independent:

| Contract | Implementation default |
| --- | --- |
| Old external-link Tide | Preserve current public metadata, existing GOING RSVP and near-start link rules. No migration makes old meeting links publicly playable. |
| Public Broadcast | Public metadata and approved public player; RSVP is optional interest/reminder data. Playback continues accepting viewers after start. Do not apply private capacity limits to public viewer counts. |
| Private Event | Registration requires an explicit approval policy or invitation. Store pending/approved/rejected/revoked grants independently of INTERESTED/GOING. Default registration closes at start; host can explicitly enable late registration subject to approval/capacity. |
| Private teaser | Host explicitly chooses public teaser or hidden event. Teaser serializer omits stream credentials, playback grants, attendee identities and private discussion. Calendar export/search/feed/detail apply the same discovery rule. |
| Host/producer | Personal owner for personal event; current company OWNER/ADMIN for company event. Store producer grant explicitly if delegating operational access. Publishing secrets stay server-side. Revoked company membership must also revoke producer authority. |
| Moderator | Host or explicitly assigned event moderator can review/remove Q&A. A Space moderator does not automatically control every event announced in that Space. No playback credentials or company billing permission follows from moderation. |
| State | Verified provider events and reconciliation establish LIVE/interrupted/ended. Schedule establishes upcoming intent only. Cancellation/stop denies new playback authorizations and terminates delivery where supported. |
| Private playback/replay | Protected provider asset and short-lived viewer authorization from a fully authenticated endpoint. Recheck grants when minting/refreshing tokens. Specify maximum revocation delay before release and measure it in staging. Frontend hidden URLs are insufficient. |
| Recording | Host opts in; viewers receive a recording notice. Replay availability is explicit. Private event recording cannot become public through a feed card, copied URL or sponsorship. |

The public JWT path permits anonymous fallback for invalid tokens and skips the second-factor assertion used by protected routes. Therefore private playback, grant-management and producer-token endpoints must be protected routes, not personalized `@Public()` endpoints.

## Migration and compatibility decisions

1. **Keep UserRole stable.** Add explicit personal provider setup/capability and intent preferences. Existing JOB_SEEKER accounts remain JOB_SEEKER; they retain applications, subscription and closure paths. Existing FREELANCER accounts retain their role and profile. Backfill their provider eligibility without making a hidden profile public or granting employer rights.
2. **Separate provider visibility from existence.** Adding a freelancer profile is not permission to publish it. Preserve existing privacy choices. Where no explicit provider-public consent exists, do not silently enable new signed-out previews. Record grandfathered legacy exposure separately for remediation rather than representing it as newly granted consent.
3. **Do not certify historical statistics.** Keep legacy self-declared values for compatibility where needed, with provenance. Reject new self-service edits to trusted counters. New verified counts start from evidenced events; do not reset or copy values into verified fields without an explicit migration.
4. **Add canonical ownership.** New service/project records explicitly identify personal versus company ownership. Maintain existing Job/application models. Post purposes default to general discussion and references are additive; old posts render without new references.
5. **Keep messaging schemas separate.** Existing employer/candidate pair keys, shared company inbox and recruiting attachment permissions remain intact. Marketplace requests/participants can share inbox presentation while using distinct API authorization and identifiers.
6. **Preserve legacy events.** Add audience/delivery/grant/session/replay contracts without reinterpreting existing GOING RSVP as a new private approval. Old Tides retain external-link behavior. The new live player never receives legacy joinUrl through public payloads.
7. **Plan closure and removals before foreign keys.** Personal listings close/unpublish on account closure; revocable grants and sessions are invalidated; private content retention/deletion is explicitly defined. Company-owned listings/events remain company-owned unless the whole company is closed. Current Tide host cascade needs a migration design for that distinction.
8. **Deploy additive schema/backend first.** Separate marketplace and Live Tides flags. Disabled features do not block login/onboarding/hiring, expose drafts or delete records. Old clients cannot set new ownership/grant/verified fields. Migration rehearsal, rollback and real-provider validation remain separate release evidence.

## Actionable gaps and release gates

| ID | Gap supported by code inspection | Required work / acceptance |
| --- | --- | --- |
| ACCESS-01 | Shared onboarding completes JOB_SEEKER; provider API uses FREELANCER role. | Phase 1: additive provider capability and destination. Demonstrate an existing jobseeker can offer services and still apply, and a legacy freelancer can complete provider setup. |
| ACCESS-02 | Public freelancer read lacks privacy/status serializer; trust counts are self-editable. | Phase 1: opt-in visibility, projected public fields, provenance and safe owner DTO. Direct hidden-profile read and search must return no protected evidence; no client request can assign verified counters. |
| ACCESS-03 | Creating a Space grants MODERATOR; any such moderator can act globally. | Before expanding the pilot: scope queue and mutation authorization by the target Space. Cross-Space and Space-less actions fail for local moderators; platform administrators retain review access. |
| ACCESS-04 | Initial baseline: direct post read lacked removedAt denial and included removed comments/replies; comment read/create checked only parent existence. | Phase 0 patch: ordinary post detail/comments reject removed parents, nested discussion excludes removed records, and reshares redact removed originals. Comment/reply creation rechecks visibility inside its transaction; comment deletion uses the same post-first lock order. Local test evidence is in the verification results. Canonical commercial/private visibility rules remain required when those records are added. |
| ACCESS-05 | Historical author/host may mutate company content without a fresh membership check. | Phase 1/2: company-owned mutations require current active company authority. Remove/suspend an author and verify company edits fail while a current OWNER/ADMIN can manage the record. |
| ACCESS-06 | Current recruiting chat requires an application but accepts optional jobId on creation without validating it against the selected consent query. Read paths rely on participant/company scope rather than company-write guard. | Preserve consent; verify context ownership and inactive-seat behavior in dedicated hiring regression coverage. Never solve marketplace messaging by removing the application requirement or broadly adding FREELANCER. |
| ACCESS-07 | Current Tides provide no event audience/grant model; RSVP after start fails. joinUrl gating checks near-start/GOING/cancellation, not approval or stream lifecycle. | Phase 3A: additive access contracts, public late viewing, host-selected private late registration, grant revocation and protected replay. Mock tests plus copied-link/revoked-token checks with the actual provider are required. |
| ACCESS-08 | Account closure is JOB_SEEKER-specific; hosted Tides cascade with User. | Before new relations release: extend closure cleanup for provider-enabled jobseekers and define company-owned event persistence plus private-content retention. Verify with a dedicated test database and synthetic storage/providers; never use a live account as a test. |
| ACCESS-09 | New requests/proposals do not yet have durable participant or consent records. | Phase 3: owner/company isolation, pending/accepted/declined/blocked transitions, retry deduplication and durable notifications. An unauthorized UUID fetch cannot reveal proposal content or attachments. |

These are repository findings and implementation gates. ACCESS-04 has a focused local patch; its deployment still needs acceptance evidence. ACCESS-03 remains unresolved before expanding moderator powers or the pilot. Streaming provider selection and a documented revocation window are dependencies for Phase 3A.

## Verified source index

Paths are relative to the repository; line numbers identify the inspected definitions and can move with later edits.

| Evidence | Reference |
| --- | --- |
| Global JWT/role guards; public optional auth; protected MFA/status checks | [auth.module.ts](../../backend/src/auth/auth.module.ts), [jwt-auth.guard.ts](../../backend/src/auth/guards/jwt-auth.guard.ts), [roles.guard.ts](../../backend/src/auth/guards/roles.guard.ts) |
| Onboarding roles and completion | [auth.service.ts](../../backend/src/auth/auth.service.ts) `updateUserRole` (172), `completeOnboarding` (212); [useOnboardingForm.ts](../../src/data/onboarding/useOnboardingForm.ts) (94); [accountSide.ts](../../src/lib/accountSide.ts) |
| Company seat/context authority | [capabilities.ts](../../backend/src/company/capabilities.ts) (65), [company-capability.guard.ts](../../backend/src/company/company-capability.guard.ts) (40), [company-context.service.ts](../../backend/src/company/company-context.service.ts) (52, 62, 102) |
| Candidate visibility and contact consent | [job-seekers.controller.ts](../../backend/src/job-seekers/job-seekers.controller.ts) (64–91); [job-seekers.service.ts](../../backend/src/job-seekers/job-seekers.service.ts) `getPublicProfile` (61) |
| Company page private denial | [employers.service.ts](../../backend/src/employers/employers.service.ts) `getCompanyById` (202); [employers.controller.ts](../../backend/src/employers/employers.controller.ts) public company routes |
| Public provider API / editable trust | [freelancers.controller.ts](../../backend/src/freelancers/freelancers.controller.ts) (16, 27, 37); [freelancers.service.ts](../../backend/src/freelancers/freelancers.service.ts) (9, 38); [update-freelancer-profile.dto.ts](../../backend/src/freelancers/dto/update-freelancer-profile.dto.ts) (92, 97, 102) |
| Public post read, company voice, edit/delete | [posts.controller.ts](../../backend/src/community/posts/posts.controller.ts) (52, 74); [posts.service.ts](../../backend/src/community/posts/posts.service.ts) (34, 95, 157, 248, 296) |
| Space public routes, scoped banner, posting gate | [spaces.controller.ts](../../backend/src/community/spaces/spaces.controller.ts) (75, 87); [spaces.service.ts](../../backend/src/community/spaces/spaces.service.ts) (213, 373) |
| Global moderator queue/removal scope | [moderation.service.ts](../../backend/src/community/moderation.service.ts) (81, 119, 211) |
| Comment parent/removal checks | [comments.controller.ts](../../backend/src/community/comments/comments.controller.ts) (31); [comments.service.ts](../../backend/src/community/comments/comments.service.ts) `listByPost` (29), `create` (121) |
| Verified company identity meaning | [identity.service.ts](../../backend/src/community/identity.service.ts) (51, 124) |
| Recruiting roles, consent, company participants | [messaging.controller.ts](../../backend/src/messaging/messaging.controller.ts) (21, 38, 46); [messaging.service.ts](../../backend/src/messaging/messaging.service.ts) (198, 311, 328) |
| Tide metadata, RSVP, owner check and join gating | [tides.controller.ts](../../backend/src/community/tides/tides.controller.ts) (40, 59); [tides.service.ts](../../backend/src/community/tides/tides.service.ts) (50, 237, 406, 465); [schema.prisma](../../backend/prisma/schema.prisma) (2394, 2411, 2476) |
| Closure eligibility, provider cleanup and user deletion | [account-closure.service.ts](../../backend/src/auth/account-closure.service.ts) (43, 53, 170, 217); [schema.prisma](../../backend/prisma/schema.prisma) FreelancerProfile (1272), Tide host relation (2464) |

## Required verification for the next phase

Use synthetic accounts in a dedicated staging/test environment: visitor; pending and active jobseekers; legacy freelancer; provider-enabled jobseeker; two companies with all seat roles; suspended/removed seats; local Space moderator; platform administrator. Test direct IDs, search, nested cards, writes and attachment/playback URLs, not only visible buttons. Cover owner versus stranger, company A versus B, historical versus current authority and accepted versus withdrawn/blocked consent. Record exact outcomes in the Phase 0 baseline evidence; do not mark an integration or provider boundary verified from this document alone.
