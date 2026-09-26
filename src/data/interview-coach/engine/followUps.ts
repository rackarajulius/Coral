import type { Question } from "../types";
import type { AnswerAnalysis } from "./scoring";

let uid = 0;

function followUpFrom(parent: Question, text: string): Question {
  return {
    id: `fu-${Date.now().toString(36)}-${++uid}`,
    text,
    competency: parent.competency,
    keywords: parent.keywords,
    expectedSec: Math.min(90, parent.expectedSec),
    isFollowUp: true,
    parentId: parent.id,
  };
}

/**
 * Decide whether to probe deeper after an answer. At most one follow-up per
 * main question; the engine caps the session-wide total separately.
 * `roll` is injected so tests stay deterministic.
 */
export function pickFollowUp(
  analysis: AnswerAnalysis,
  question: Question,
  probes: string[],
  roll: () => number = Math.random,
): Question | null {
  if (question.isFollowUp) return null;

  if (analysis.wordCount > 0 && analysis.wordCount < 40) {
    return followUpFrom(
      question,
      "That was quite brief — can you expand on that with a concrete example?",
    );
  }

  if (analysis.keywordRatio < 0.25 && probes.length > 0) {
    return followUpFrom(question, probes[0]);
  }

  if (probes.length > 0 && roll() < 0.3) {
    return followUpFrom(question, probes[probes.length - 1]);
  }

  return null;
}
