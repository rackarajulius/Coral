import { ServiceUnavailableException } from '@nestjs/common';
import type { ScreenEvaluation } from './ai.service';

function invalid(): never {
  throw new ServiceUnavailableException('AI scoring returned an invalid assessment. Please retry.');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function score(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) return invalid();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return invalid();
  return value.trim();
}

function notes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 4) return invalid();
  return value.map(text);
}

/** Whitespace-insensitive, so a reflowed echo of the same text still matches. */
function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Reject missing or invented assessments instead of turning model failures into low scores. */
export function validateScreenEvaluation(value: unknown, questions: string[]): ScreenEvaluation {
  const raw = object(value);
  const overallScore = score(raw.overallScore);
  // The score decides the recommendation, and the model's own label is never
  // read. Disagreeing with it at a boundary is not a reason to throw away an
  // otherwise complete scorecard, so the derived value simply replaces it.
  const recommendation = overallScore >= 85 ? 'strong_yes' : overallScore >= 70 ? 'yes' : overallScore >= 50 ? 'maybe' : 'no';
  if (!questions.length || !Array.isArray(raw.perAnswer) || raw.perAnswer.length !== questions.length) return invalid();
  const perAnswer = raw.perAnswer.map((value, i) => {
    const entry = object(value);
    // Compared only to prove answer i belongs to question i. The echoed text is
    // discarded either way, so a model that rewraps it has still lined up.
    if (compact(text(entry.question)) !== compact(questions[i])) return invalid();
    return { question: questions[i], score: score(entry.score), note: text(entry.note) };
  });
  return { overallScore, recommendation, summary: text(raw.summary),
    strengths: notes(raw.strengths), concerns: notes(raw.concerns), perAnswer };
}

/**
 * At most one result per requested ID, in request order.
 *
 * Unusable entries are dropped rather than failing the batch: one bad row used
 * to discard up to 40 good scores, and every caller already falls back per ID
 * for anything missing, so the cost is one heuristic score instead of all of
 * them. Nothing usable at all still means the model failed.
 */
export function validateMatchScores(value: unknown, ids: string[]) {
  const raw = object(value);
  if (!Array.isArray(raw.scores)) return invalid();
  const results = new Map<string, { id: string; score: number; reason: string }>();
  for (const value of raw.scores) {
    try {
      const entry = object(value);
      const id = text(entry.id);
      // An unrequested ID is invented, and a repeat would overwrite a real score.
      if (!ids.includes(id) || results.has(id)) continue;
      results.set(id, { id, score: score(entry.score), reason: text(entry.reason) });
    } catch { /* one unusable entry is not an unusable batch */ }
  }
  if (!results.size) return invalid();
  return ids.flatMap((id) => {
    const result = results.get(id);
    return result ? [result] : [];
  });
}
