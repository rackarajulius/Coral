import type { LiveScores, Question } from "../types";

// Pure answer-analysis heuristics. Deterministic on purpose — unit-testable and
// stable across renders. A future LLM engine replaces this file wholesale.

export const INITIAL_SCORES: LiveScores = {
  communication: 50,
  confidence: 50,
  technicalDepth: 50,
  problemSolving: 50,
  structure: 50,
};

const FILLER_RE = /\b(um+|uh+|erm+|like|you know|basically|actually|sort of|kind of|i mean)\b/gi;
const HEDGE_RE = /\b(maybe|i guess|i think|probably|perhaps|not sure|i suppose|hopefully)\b/gi;
const DECISIVE_RE = /\b(i (led|built|designed|decided|drove|owned|created|shipped|launched|implemented|delivered))\b/gi;
const CONNECTOR_RE = /\b(because|so that|therefore|trade-?offs?|instead of|which meant|as a result|in order to|the reason)\b/gi;
const NUMERIC_RE = /\b\d+(\.\d+)?\s*(%|percent|x|ms|s|k|m|users?|requests?|dollars?|days?|weeks?|months?)?\b/gi;

const STAR_CUES: RegExp[] = [
  /\b(when i|at my (previous|last|current)|we had|the situation|our team was|last (year|quarter)|there was a)\b/i, // Situation
  /\b(my (task|job|goal|responsibility) was|i (needed|had) to|the goal was|i was asked to|we needed to)\b/i, // Task
  /\b(so i|i (built|led|created|designed|organized|decided|implemented|proposed|started|wrote|set up)|first,? i|then i)\b/i, // Action
  /\b(as a result|which (led to|resulted in|improved|reduced|increased)|the (outcome|result|impact) was|in the end|we (shipped|launched|achieved)|ultimately)\b/i, // Result
];

const clamp = (n: number, lo = 5, hi = 98) => Math.max(lo, Math.min(hi, Math.round(n)));
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

export interface AnswerAnalysis {
  raw: LiveScores;
  wordCount: number;
  fillerCount: number;
  hedgeCount: number;
  keywordRatio: number;
  /** How many STAR buckets (0–4) the answer touched. */
  starBuckets: number;
  hasNumbers: boolean;
}

export function analyzeAnswer(
  transcript: string,
  durationSec: number,
  question: Question,
): AnswerAnalysis {
  const text = transcript.trim();
  const words = text ? text.split(/\s+/).length : 0;

  const fillerCount = count(text, FILLER_RE);
  const hedgeCount = count(text, HEDGE_RE);
  const decisive = count(text, DECISIVE_RE);
  const connectors = count(text, CONNECTOR_RE);
  const hasNumbers = count(text, NUMERIC_RE) > 0;

  const lower = text.toLowerCase();
  const hits = question.keywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const keywordRatio = question.keywords.length ? hits / question.keywords.length : 0;

  const starBuckets = STAR_CUES.filter((re) => re.test(text)).length;

  // Communication: length sweet spot (80–220 words) plus pacing vs expectation.
  let communication: number;
  if (words < 15) communication = 18;
  else if (words < 40) communication = 42;
  else if (words <= 240) communication = 82;
  else if (words <= 380) communication = 66;
  else communication = 52;
  const pacing = question.expectedSec > 0 ? durationSec / question.expectedSec : 1;
  if (pacing > 1.8 || (pacing < 0.3 && words >= 15)) communication -= 10;
  communication -= Math.min(12, fillerCount * 2);

  // Confidence: fillers and hedging erode it; decisive ownership language builds it.
  const fillerRate = words > 0 ? fillerCount / words : 0;
  let confidence = 74 - fillerRate * 320 - hedgeCount * 4 + Math.min(16, decisive * 6);
  if (words < 15) confidence = Math.min(confidence, 30);

  // Structure: STAR coverage, with numbers standing in for a measurable Result.
  let structure = 22 + starBuckets * 17;
  if (hasNumbers) structure += 8;
  if (words < 25) structure = Math.min(structure, 30);

  // Technical depth: keyword coverage plus concrete numbers.
  let technicalDepth = 28 + keywordRatio * 52 + (hasNumbers ? 12 : 0);
  if (words >= 60 && keywordRatio >= 0.5) technicalDepth += 6;

  // Problem solving: causal reasoning and structured thinking.
  const problemSolving = 26 + Math.min(30, connectors * 8) + structure * 0.28 + keywordRatio * 14;

  return {
    raw: {
      communication: clamp(communication),
      confidence: clamp(confidence),
      technicalDepth: clamp(technicalDepth),
      problemSolving: clamp(problemSolving),
      structure: clamp(structure),
    },
    wordCount: words,
    fillerCount,
    hedgeCount,
    keywordRatio,
    starBuckets,
    hasNumbers,
  };
}

/** Exponential smoothing so one bad answer doesn't crater the live bars. */
export function smoothScores(
  prev: LiveScores,
  raw: LiveScores,
): { scores: LiveScores; delta: Partial<LiveScores> } {
  const scores = { ...prev };
  const delta: Partial<LiveScores> = {};
  (Object.keys(prev) as (keyof LiveScores)[]).forEach((k) => {
    const next = Math.round(prev[k] * 0.6 + raw[k] * 0.4);
    if (next !== prev[k]) delta[k] = next - prev[k];
    scores[k] = next;
  });
  return { scores, delta };
}

export function overallScore(scores: LiveScores): number {
  const vals = Object.values(scores);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
