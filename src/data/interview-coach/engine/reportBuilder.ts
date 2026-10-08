import { COMPETENCIES, competencyLabel } from "../constants";
import { LEARNING_RESOURCES } from "../resources";
import type {
  AnswerRecord,
  CompetencyId,
  CompetencyResult,
  InterviewConfig,
  LiveScores,
  Readiness,
  SessionReport,
} from "../types";
import { INITIAL_SCORES, analyzeAnswer, overallScore } from "./scoring";

const INSIGHTS: Record<CompetencyId, { high: string; mid: string; low: string }> = {
  communication: {
    high: "Clear, well-paced answers that stayed on topic.",
    mid: "Generally clear, but some answers drifted or ran long.",
    low: "Answers were often too short or unfocused to land the point.",
  },
  confidence: {
    high: "Decisive ownership language with very few fillers.",
    mid: "Solid presence, though hedging crept into some answers.",
    low: "Frequent fillers and hedging undercut otherwise good content.",
  },
  technicalDepth: {
    high: "Concrete technologies, numbers, and trade-offs throughout.",
    mid: "Good fundamentals, but specifics were thin in places.",
    low: "Answers stayed abstract — name real tools, metrics, and decisions.",
  },
  problemSolving: {
    high: "Strong causal reasoning — every choice came with a why.",
    mid: "Reasonable approaches, but alternatives were rarely weighed.",
    low: "Describe how you decide, not just what you did.",
  },
  structure: {
    high: "Textbook STAR: situation, task, action, and a measured result.",
    mid: "Stories had a shape but often skipped the measurable result.",
    low: "Answers lacked narrative structure — lead with the situation, end with the result.",
  },
};

function insightFor(id: CompetencyId, score: number): string {
  const band = score >= 75 ? "high" : score >= 55 ? "mid" : "low";
  return INSIGHTS[id][band];
}

function readinessFor(score: number): Readiness {
  if (score >= 80) return "strong";
  if (score >= 68) return "ready";
  if (score >= 55) return "getting-there";
  return "not-ready";
}

const RECOMMENDATIONS: Record<Readiness, string> = {
  strong: "You're interviewing at a strong bar — book the real thing with confidence and keep your stories fresh.",
  ready: "You're ready for real interviews. Sharpen your weakest competency below and you'll stand out.",
  "getting-there": "The foundations are there. Two or three focused practice sessions on the areas below will change your outcomes.",
  "not-ready": "Don't book the real interview yet — drill the focus areas below, then re-run this mock to measure the jump.",
};

// ─── Sample answer improvement ────────────────────────────────────────────────

// ─── Report assembly ──────────────────────────────────────────────────────────

export function buildReport(args: {
  sessionId: string;
  config: InterviewConfig;
  answers: AnswerRecord[];
  finalScores?: LiveScores;
}): SessionReport {
  const { sessionId, answers } = args;
  const finalScores =
    args.finalScores ??
    (answers.length ? answers[answers.length - 1].evaluation.scores : { ...INITIAL_SCORES });

  const overall = overallScore(finalScores);

  const ranked = COMPETENCIES.map((c) => ({ id: c.id, score: finalScores[c.id] })).sort(
    (a, b) => b.score - a.score,
  );
  const top = ranked.slice(0, 2);
  const bottom = ranked.slice(-2).reverse();

  const competencies: CompetencyResult[] = COMPETENCIES.map((c) => ({
    id: c.id,
    score: finalScores[c.id],
    insight: insightFor(c.id, finalScores[c.id]),
  }));

  // Re-run the pure analysis to aggregate cross-answer patterns.
  const analyses = answers.map((a) => analyzeAnswer(a.transcript, a.durationSec, a.question));
  const shortAnswers = analyses.filter((a) => a.wordCount > 0 && a.wordCount < 40).length;
  const fillerHeavy = analyses.filter((a) => a.fillerCount >= 3).length;
  const noResult = analyses.filter((a) => !a.hasNumbers && a.starBuckets < 4).length;
  const hedgy = analyses.filter((a) => a.hedgeCount >= 2).length;

  const repeatedMistakes: string[] = [];
  if (shortAnswers >= 2) repeatedMistakes.push(`${shortAnswers} answers were under 40 words — expand with a concrete example each time.`);
  if (fillerHeavy >= 2) repeatedMistakes.push(`Filler words ("um", "like", "you know") appeared heavily in ${fillerHeavy} answers.`);
  if (noResult >= 2) repeatedMistakes.push(`${noResult} stories ended without a measurable result — always close with the impact, ideally a number.`);
  if (hedgy >= 2) repeatedMistakes.push(`Hedging language ("maybe", "I guess") weakened ${hedgy} answers — commit to your decisions.`);

  const strengths = top.map(
    (c) => `${competencyLabel(c.id)} (${c.score}) — ${insightFor(c.id, c.score)}`,
  );
  if (analyses.filter((a) => a.hasNumbers).length >= Math.ceil(answers.length / 2)) {
    strengths.push("You backed answers with concrete numbers — interviewers remember quantified impact.");
  }

  const weaknesses = bottom.map(
    (c) => `${competencyLabel(c.id)} (${c.score}) — ${insightFor(c.id, c.score)}`,
  );

  const focusAreas = bottom.map((c) => competencyLabel(c.id));
  const resources = bottom.flatMap((c) => LEARNING_RESOURCES[c.id]);

  // Basic practice has no AI rewrite. Never invent projects, employers, or metrics.
  const sampleAnswers: SessionReport["sampleAnswers"] = [];

  const responseDurations = answers.map((a, i) => ({
    label: a.question.isFollowUp ? `Q${i + 1}*` : `Q${i + 1}`,
    sec: Math.round(a.durationSec),
    expected: a.question.expectedSec,
  }));

  const readiness = readinessFor(overall);

  return {
    id: crypto.randomUUID(),
    sessionId,
    overallScore: overall,
    readiness,
    recommendation: RECOMMENDATIONS[readiness],
    competencies,
    strengths,
    weaknesses,
    repeatedMistakes,
    focusAreas,
    resources,
    sampleAnswers,
    responseDurations,
  };
}
