# AI providers

Every AI call in `AiService` goes through one router, `complete(task, system, user, opts)`.
Provider is configuration, not something baked into each method.

## Switching provider

```bash
AI_PROVIDER=gemini        # or openai. Default: gemini
AI_FALLBACK=true          # retry on the other provider. Default: true
```

Nothing else changes — all 20 call sites follow `AI_PROVIDER`.

## Using a different model or vendor

The OpenAI path speaks the standard `/chat/completions` API, so it reaches any
compatible endpoint with two variables and no code:

```bash
AI_PROVIDER=openai
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-sonnet-4.5
OPENAI_API_KEY=sk-...
```

That covers OpenRouter, Together, Groq, Fireworks, DeepSeek, Mistral, Azure
OpenAI, vLLM, Ollama, LM Studio, and Anthropic's OpenAI-compatible layer.

Gemini keeps its own variables: `GEMINI_API_KEY`, `GEMINI_BASE_URL`,
`GEMINI_MODEL`.

## Per-task models

Scoring and prose have different requirements — scoring wants cheap and
deterministic (it already runs at `temperature: 0`), reports want a stronger
model. Each task can name its own:

| Variable | Used by |
|---|---|
| `AI_MODEL_SCORING` | `evaluateScreen`, `evaluateCoachAnswer`, `evaluateInterviewAnswer`, `scoreCandidates`, `scoreJobMatches` |
| `AI_MODEL_QUESTIONS` | `generateJobScreeningQuestions`, `generateCoachQuestions`, `generateInterviewPlan` |
| `AI_MODEL_REPORT` | `buildCoachReport`, `analyzeRoleReadiness`, `generateCoverLetter`, `tailorResume` |
| `AI_MODEL_EXTRACTION` | `parseResume`, `researchCompany` |
| `AI_MODEL_GENERAL` | everything else |

Unset falls back to the provider's `*_MODEL`, then a built-in default.

**Changing `AI_MODEL_SCORING` invalidates the calibration work.** Scores from
different models are not comparable, and the measured numbers in
`scoring-validation.md` describe one specific model. Re-run
`npm run audit:stability` after any change here.

## Fallback

When the primary fails in a way worth retrying — **429**, **408**, or any
**5xx** — and the other provider has a key, the call is retried there.

`400`, `401` and `403` do **not** fail over. Those mean our request or key is
wrong, and failing over would hide a misconfiguration behind a second bill.

Verified live on 2026-08-09: Gemini returned 429, the router retried on OpenAI,
and the surfaced error was OpenAI's own.

## Cost note

A live voice interview makes an AI call per turn per candidate. Neither
provider's free tier can carry one real screening round — both were exhausted
during development. Enable billing before running screenings for real.
