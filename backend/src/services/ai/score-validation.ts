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

/** Reject missing or invented assessments instead of turning model failures into low scores. */
export function validateScreenEvaluation(value: unknown, questions: string[]): ScreenEvaluation {
  const raw = object(value);
  const overallScore = score(raw.overallScore);
  const recommendation = overallScore >= 85 ? 'strong_yes' : overallScore >= 70 ? 'yes' : overallScore >= 50 ? 'maybe' : 'no';
  if (raw.recommendation !== recommendation) return invalid();
  if (!questions.length || !Array.isArray(raw.perAnswer) || raw.perAnswer.length !== questions.length) return invalid();
  const perAnswer = raw.perAnswer.map((value, i) => {
    const entry = object(value);
    if (text(entry.question) !== questions[i].trim()) return invalid();
    return { question: questions[i], score: score(entry.score), note: text(entry.note) };
  });
  return { overallScore, recommendation, summary: text(raw.summary),
    strengths: notes(raw.strengths), concerns: notes(raw.concerns), perAnswer };
}

/** Require exactly one result per requested ID, in request order. */
export function validateMatchScores(value: unknown, ids: string[]) {
  const raw = object(value);
  if (!Array.isArray(raw.scores) || raw.scores.length !== ids.length) return invalid();
  const results = new Map<string, { id: string; score: number; reason: string }>();
  for (const value of raw.scores) {
    const entry = object(value);
    const id = text(entry.id);
    if (!ids.includes(id) || results.has(id)) return invalid();
    results.set(id, { id, score: score(entry.score), reason: text(entry.reason) });
  }
  return ids.map((id) => results.get(id) ?? invalid());
}
