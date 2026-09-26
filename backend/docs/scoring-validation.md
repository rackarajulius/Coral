# Screening scorer — validation status

What we have measured about `AiService.evaluateScreen`, the model that produces
the 0–100 score and `strong_yes | yes | maybe | no` recommendation shown on the
job screening board.

**Status: not validated.** Reliability has been measured and one defect fixed.
Calibration has a known, measured defect with an unverified fix. No bias audit
and no validity study exist.

Run the harness with `npm run audit:stability` (see
`scripts/audit-score-stability.ts`). It uses real completed screens when the
database has any, and synthetic fixtures otherwise.

---

## The three questions, and where each stands

| | Question | Status |
|---|---|---|
| **Reliability** | Does it agree with itself? | Measured; defect fixed |
| **Calibration** | Does the number mean what it says? | Measured; **defect open** |
| **Validity** | Does it predict anything real? | **Not started** |

A bias audit (adverse impact across protected groups) is a fourth question and
also **not started**. It requires demographic data we do not collect. NYC Local
Law 144 requires an independent audit before this may be used on candidates in
NYC.

---

## Reliability — measured, fixed

**2026-08-09, 5 synthetic fixtures × 5 runs, Gemini, temperature 0.3:**

| fixture | mean | SD | range | rec flips |
|---|---|---|---|---|
| strong-detailed | 92.2 | 0.7 | 91–93 | 0/5 |
| mixed-uneven | 50.5 | 1.7 | 48–52 | 1/4 |
| **borderline-generic** | **73.8** | **9.9** | **58–89** | **2/5** |
| weak-short | 9.3 | 1.9 | 7–12 | 0/4 |

Mean SD 3.55 · worst SD 9.87 · widest spread **31 points** · recommendation
disagreement 16.7%.

The scorer was stable at the extremes and unstable exactly in the middle, which
is where ranking decisions are actually made. The borderline transcript swung
58 → 89 across runs: the difference between "maybe" and "strong yes", decided by
which sample the candidate happened to get.

**Fix:** scoring now calls the model at `temperature: 0` (generative calls keep
0.3). Re-measured on the worst fixture: **SD 0.0, range 86–86, 0 flips** (n=3,
two runs lost to rate limiting).

Applying a rubric has no use for sampling variance, so this costs nothing.

## Calibration — measured defect, fix UNVERIFIED

Removing the noise surfaced a worse problem. At temperature 0 the
`borderline-generic` fixture — written to be fluent, well-structured and
entirely content-free — settles at **86 / "strong yes"**.

For comparison, `strong-detailed` (specific situations, real numbers, an owned
mistake) scores 92. **Six points** separate "said nothing eloquently" from
"gave concrete evidence throughout".

That is the classic LLM-judge failure: it scores *eloquence*, not *evidence*.
In hiring it is worse than noise, because it systematically advantages
candidates practised at sounding professional over candidates with real
experience who describe it plainly — which correlates with class, schooling,
and first language.

**Attempted fix (2026-08-09, not yet verified):** the prompt now instructs the
model to score evidence over eloquence, to cap fluent-but-unspecific answers at
45, and to reserve 85+ for answers carrying concrete situations, decisions and
consequences.

**This has not been measured.** The Gemini quota was exhausted before a re-run
completed. Until the numbers below are filled in, treat the calibration defect
as open.

One data point landed before the quota ran out again: `strong-detailed` moved
**92.2 → 87.0**, still `strong_yes`. Consistent with a stricter bar for 85+,
but it says nothing about the defect — `borderline-generic` is the test, and it
has not been re-scored even once.

```
TODO re-run when the daily quota resets (cheapest useful check, 5 calls):
  RUNS=1 SOURCE=fixtures npm run audit:stability
Then for variance:
  RUNS=3 SOURCE=fixtures npm run audit:stability

Fix works if: borderline-generic drops well below strong-detailed (target under
50), weak-short stays low, strong-detailed stays high.
```

Runnable from the repo root or from `backend/`.

## Transcription penalty — NOT measured

`evaluateScreen` takes `medium: 'spoken'` and instructs the model to ignore
filler words, false starts, missing punctuation and ASR garbling, so live
interviews are not marked down for how they were transcribed. This matters
because speech recognition accuracy varies by accent.

The `strong-spoken-disfluent` fixture exists to measure it: it is
`strong-detailed`'s substance rendered as raw ASR output. The harness reports
the gap between them.

**All five runs were lost to rate limiting.** The protection is written but
unverified. A large gap would mean spoken candidates are penalised for their
transcription.

## Validity — not started

Nothing links these scores to any hiring outcome. There is no evidence the
score predicts interview performance, offer rates, or job performance, and it
should not be described to employers as if it does.

The board copy states this: *"Scores rank answers to the same questions — they
are not a hiring decision."* That line is load-bearing and should not be
removed.

## Bias audit — collection built, no data yet

Collection landed 2026-08-09. The analysis cannot run until candidates have
actually self-reported, and it **cannot be reconstructed retroactively** for
interviews conducted before then.

**Collection** — `DemographicSelfReport`, its own table (`src/fairness/`):

- Voluntary, from the job-seeker Settings → Privacy tab.
- Its own table, not columns on `JobSeekerProfile`: profile reads happen all
  over the candidate- and employer-facing code, and this must never ride along
  with one.
- No code outside `src/fairness/` references the model. Verify with:
  `grep -rn "demographicSelfReport" backend/src --include=*.ts | grep -v fairness/`
  — that must stay empty.
- Never in an AI prompt, never in an employer response.
- The only individual read is keyed on the caller's own id. There is no
  endpoint that returns anyone else's, including for admins.
- Candidates can change or delete it at any time; deleting the account
  cascades.

**Analysis** — `GET /admin/fairness/adverse-impact` (admin only):

- Advance rate (recommendation of `yes` or `strong_yes`) and mean score per
  group, plus the **four-fifths impact ratio** against the best-performing
  group. Below 0.8 is the conventional adverse-impact threshold.
- Groups under `MIN_GROUP_SIZE` (10) are **suppressed**, not shown — with
  fewer, a rate identifies individuals.
- Ratios are only *flagged* for groups over `RELIABLE_GROUP_SIZE` (30). A 0.6
  ratio on 11 people is noise, and reporting it as a finding devalues real ones.
- `prefer_not_to_say` is excluded from comparison: it is a declined answer, not
  a group.
- Reports `coverage` — what fraction of scored screens have a self-report to
  join to. Low coverage makes the whole analysis unrepresentative, so it is
  stated rather than hidden.

**Still missing:** an *independent* audit. NYC LL144 requires the auditor to be
independent of the tool's developer, so this internal report supports the work
but does not satisfy the law on its own.

---

## What this means for the product today

- Scores are reproducible run-to-run (fixed).
- Scores currently **over-reward fluent, unspecific answers** (open).
- The board ordering is only as trustworthy as the calibration, so the
  human-reviews-the-scorecard rule is doing real work, not covering a formality.
- Nothing here supports an automated reject, and none should be added.
