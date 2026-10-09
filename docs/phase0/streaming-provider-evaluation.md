# Streaming provider evaluation for Live Tides

Prepared 9 October 2026, against the Phase 0 requirement to evaluate a managed
streaming integration "for in-feed playback, protected private streams/
recordings, trusted lifecycle events, accessibility, usage limits and
operational costs before committing to the Live Tides estimate."

Candidates: Mux Video, Cloudflare Stream, Amazon IVS Low-Latency Streaming.
Prices and capabilities were read from vendor documentation on 9 October 2026
and will drift; re-check before signing anything.

## The finding that reframes the choice

Phase 3A wants four things from one provider: a host who can go live, an
embedded player, optional protected replay, and viewer telemetry. **No
candidate gives all four through a single ingest path.** The split is not
about price.

- Browser-based go-live (no encoder software) is available from Cloudflare via
  WHIP, and from Amazon IVS via its Web Broadcast SDK.
- **Cloudflare's WebRTC path cannot record and reports no viewer counts.**
  Its own documentation states WHIP and WHEP "must be used together", that
  "recording and live HLS playback are not yet supported", and that there are
  no broadcast metrics or live viewer counts. Replay and viewer measurement
  are both explicit Phase 3A requirements, so that path fails the gate
  regardless of how convenient the ingest is.
- Mux has the richest lifecycle events and full recording, but **no WebRTC
  ingest at all** — RTMP/RTMPS/SRT only. A host needs OBS or similar.

So the real decision is: *do pilot hosts broadcast from a browser tab, or from
an encoder we give them instructions for?* The plan already leans toward the
latter — Phase 3A lists "streaming instructions" among the host controls.

## Against the Phase 0 criteria

| Criterion | Mux | Cloudflare Stream | Amazon IVS |
| --- | --- | --- | --- |
| Browser go-live | **No.** RTMP/SRT only; host needs an encoder | Yes, via WHIP — but see recording | Yes, Web Broadcast SDK (v1.37.0, Jul 2026) |
| Embedded player | Mux Player | Stream player / HLS | IVS player |
| Protected live playback | Signed JWT playback tokens with expiry | Signed URLs, incl. WebRTC since Apr 2025 | Private channels, signed JWT playback tokens |
| **Explicit revocation** | Short expiry + refuse re-issue | Short expiry + refuse re-issue | **`StartViewerSessionRevocation`** — a real revoke call |
| Protected recordings | Yes, same signed-token model | Yes on RTMP path; **not on WebRTC** | Yes, recorded to your S3 |
| Lifecycle events | **5:** connected, recording, active, disconnected, idle | **3:** `live_input.connected`, `.disconnected`, `.errored` | EventBridge: Stream State Change, Stream Health Change, Recording State Change, Limit Breach |
| Webhook authenticity | HMAC `Mux-Signature`, documented | Notifications use a shared-secret `cf-webhook-auth` header; the live-webhook page documents no signature | IAM/EventBridge — no public endpoint to forge |
| Duplicate/ordering | **Documented**: duplicates possible, 24h retry, 5s timeout | Not documented | EventBridge at-least-once |
| Ingest/encoding cost | $0.03125 / min live | **Free** — "ingress and encoding are always free" | $0.20/hr basic … $2.00/hr standard |
| Delivery cost | $0.001 / min after **100,000 free min/month** | $0.001 / min ($1 per 1,000) | ~$0.036/hr SD, $0.072/hr HD (North America, first tier) |
| Storage | $0.003 / min / month | $0.005 / min / month ($5 per 1,000, prepaid) | Your S3 |
| Floor / credit | No platform fee, no minimum, **$20/mo usage credit** | No stated minimum; storage prepaid in blocks | AWS free tier; $200 credits for new accounts |

### Why the lifecycle column decides it

Phase 3A's hardest requirement is not the player, it is this:

> *"A scheduled start time alone never produces a LIVE badge."*

That needs provider events good enough to drive Scheduled → Live →
Interrupted → Ended, and to survive duplicates and reordering. Mux's five
events map onto those states almost one to one — `active` means genuinely
playable, `disconnected` is an interruption, `idle` means the reconnect window
elapsed and it is over. Cloudflare's three cannot distinguish "the encoder
connected" from "viewers can actually watch", which is exactly the distinction
a LIVE badge is making.

Mux also *documents* that duplicates happen and ordering is not guaranteed.
The plan already requires handling both; a provider that states the hazard is
easier to build correctly against than one that is silent about it.

## Cost at pilot scale is not a differentiator

One 60-minute broadcast, 50 viewers averaging 40 minutes (2,000 delivery
minutes ≈ 33 viewer-hours):

| | Ingest | Delivery | Total |
| --- | --- | --- | --- |
| Mux | $1.88 | $0 (inside 100k free) | **≈ $1.88** |
| Cloudflare | $0 | $2.00 | **≈ $2.00** |
| IVS (Advanced SD) | $0.50 | $1.20 | **≈ $1.70** |

Within rounding of each other, and all trivial against a 5–10 business pilot.
Storage for replay adds $0.003–$0.005 per minute per month in each case.
**Choose on lifecycle fidelity and access control, not price.** At scale the
shape differs — Mux charges per minute live regardless of audience, Cloudflare
charges only for what is watched — but that is a Phase 5 concern.

## Recommendation

**Mux**, with hosts broadcasting from an encoder.

1. Its lifecycle events are the closest match to the state machine Phase 3A
   has to build, and that state machine is the risky part.
2. Signed JWT playback tokens cover Private Event playback *and* protected
   replay through one mechanism.
3. HMAC-signed webhooks, with duplicate and retry behaviour documented rather
   than discovered.
4. No floor and a $20 monthly credit means the pilot costs roughly nothing.
5. It matches the plan as written, which already anticipates giving hosts
   "streaming instructions".

**If browser go-live turns out to be non-negotiable for the cohort, choose
Amazon IVS, not Cloudflare.** IVS is the only candidate that does browser
ingest *and* recording *and* viewer metrics, and its
`StartViewerSessionRevocation` is the only explicit answer to Phase 3A's
requirement to "define and test the revocation window for withdrawn/rejected
invitations". The cost is AWS plumbing: EventBridge has to reach our API, which
is a hop the other two do not need.

**Do not pick Cloudflare for Live Tides** on the WebRTC path. Convenient
ingest, but it cannot record and cannot count viewers, and both are gate
items. Its RTMP path is viable but then it is Mux's trade-off with thinner
events and weaker webhook authentication.

## What this does to the estimate

The 2–4 week estimate assumed a provider with trustworthy lifecycle events.
Mux satisfies that, so the estimate stands for the Mux path.

Choosing IVS adds EventBridge delivery plumbing and AWS credential handling;
treat it as the upper end of the range. Choosing Cloudflare WebRTC would mean
dropping replay and viewer telemetry from Phase 3A's scope, which changes the
acceptance gate rather than the estimate — that is a product decision, not an
engineering one.

## Decide before building

1. **Encoder or browser?** This is the whole decision. Ask two pilot hosts
   whether they would install OBS for a recruitment presentation.
2. **Data residency.** Not verified here. A Canadian pilot handling attendee
   data may have requirements none of these three were checked against.
3. **Concurrent viewer ceilings.** Cloudflare advertises unlimited WebRTC
   viewers; Mux and IVS ceilings were not confirmed and are unlikely to bind
   at pilot scale.
4. **Player accessibility.** Phase 0 names accessibility as a criterion. None
   of the three was audited for keyboard operation, caption rendering or
   screen-reader behaviour; the acceptance gate requires verifying keyboard
   controls and mute/fullscreen, so budget that test regardless of choice.
5. **Cloudflare WebRTC billing starts 15 October 2026** — six days from this
   note. Irrelevant if we do not pick it, but it means any earlier free
   prototyping on that path stops being free.

## Sources

- [Mux live streaming pricing](https://www.mux.com/pricing/video)
- [Mux webhook events](https://www.mux.com/docs/core/listen-for-webhooks)
- [Mux live streaming FAQs — ingest protocols](https://www.mux.com/docs/guides/live-streaming-faqs)
- [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/)
- [Cloudflare Stream live webhooks](https://developers.cloudflare.com/stream/stream-live/webhooks/)
- [Cloudflare Stream WebRTC](https://developers.cloudflare.com/stream/webrtc-beta/)
- [Cloudflare notifications webhook payload/secret](https://developers.cloudflare.com/notifications/reference/webhook-payload-schema)
- [Amazon IVS private channels](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/private-channels.html)
- [Amazon IVS EventBridge events](https://docs.aws.amazon.com/ivs/latest/userguide/eventbridge.html)
- [Amazon IVS pricing](https://aws.amazon.com/ivs/pricing/)
