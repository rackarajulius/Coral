import { randomUUID } from 'crypto';
import type { CoachReportResult, CoachScores as AiCoachScores } from '../services/ai/ai.service';

export type CoachScores = AiCoachScores;
export const COACH_SCORE_KEYS = [
  'communication', 'confidence', 'technicalDepth', 'problemSolving', 'structure',
] as const;
type Competency = typeof COACH_SCORE_KEYS[number];

export interface CoachQuestion {
  id: string;
  text: string;
  competency: string;
  keywords: string[];
  expectedSec: number;
  isFollowUp?: boolean;
  parentId?: string;
}

export interface CoachAnswer {
  questionId: string;
  transcript: string;
  durationSec: number;
  typed: boolean;
  question: CoachQuestion;
  evaluation: {
    scores: CoachScores;
    delta: Partial<CoachScores>;
    fillerCount: number;
    wordCount: number;
    followUp?: CoachQuestion;
  };
  askedAt: string;
}

const labels: Record<Competency, string> = {
  communication: 'Communication', confidence: 'Confidence', technicalDepth: 'Technical depth',
  problemSolving: 'Problem solving', structure: 'Structure',
};

const resources: Record<Competency, { title: string; kind: 'article' | 'video' | 'course'; url: string; durationMin: number; reason: string }> = {
  communication: { title: 'Answering concisely: the 90-second rule', kind: 'article', url: 'https://hbr.org/2021/07/how-to-speak-more-concisely', durationMin: 8, reason: 'Practise keeping answers focused.' },
  confidence: { title: 'Think Fast, Talk Smart (Stanford GSB)', kind: 'video', url: 'https://www.youtube.com/watch?v=HAnw168huqA', durationMin: 58, reason: 'Practise speaking clearly under pressure.' },
  technicalDepth: { title: 'System Design Primer', kind: 'course', url: 'https://github.com/donnemartin/system-design-primer', durationMin: 180, reason: 'Strengthen technical explanations and trade-offs.' },
  problemSolving: { title: 'Case-style problem walkthroughs', kind: 'video', url: 'https://www.youtube.com/results?search_query=case+interview+walkthrough', durationMin: 35, reason: 'Practise breaking down ambiguous problems.' },
  structure: { title: 'The STAR method, properly applied', kind: 'article', url: 'https://www.themuse.com/advice/star-interview-method', durationMin: 7, reason: 'Structure examples around the situation, action, and result.' },
};

/** All scored and quoted content comes from persisted answers and the AI result. */
export function buildCoachSessionReport(
  sessionId: string,
  _config: Record<string, unknown>,
  answers: CoachAnswer[],
  scores: CoachScores,
  ai: CoachReportResult,
) {
  const overallScore = Math.round(COACH_SCORE_KEYS.reduce((total, key) => total + scores[key], 0) / COACH_SCORE_KEYS.length);
  const readiness = overallScore >= 80 ? 'strong' : overallScore >= 68 ? 'ready' : overallScore >= 55 ? 'getting-there' : 'not-ready';
  const ranking = [...COACH_SCORE_KEYS].sort((a, b) => scores[b] - scores[a]);
  const weakest = ranking.slice(-2).reverse();
  const insights = new Map(ai.competencyInsights.map((item) => [item.id, item.insight]));

  return {
    id: randomUUID(), sessionId, overallScore, readiness,
    recommendation: ai.recommendation || `Focus your next practice on ${weakest.map((key) => labels[key]).join(' and ')}.`,
    competencies: COACH_SCORE_KEYS.map((id) => ({
      id, score: scores[id], insight: insights.get(id) || `${labels[id]} scored ${scores[id]} out of 100.`,
    })),
    strengths: ai.strengths.length ? ai.strengths : ranking.slice(0, 2).map((key) => `${labels[key]}: ${scores[key]}/100`),
    weaknesses: ai.weaknesses.length ? ai.weaknesses : weakest.map((key) => `${labels[key]}: ${scores[key]}/100`),
    repeatedMistakes: ai.repeatedMistakes,
    focusAreas: ai.focusAreas.length ? ai.focusAreas : weakest.map((key) => labels[key]),
    resources: weakest.map((competency) => ({ ...resources[competency], competency })),
    sampleAnswers: ai.sampleAnswers.flatMap((sample) => {
      const original = answers.find((answer) => answer.question.text === sample.questionText)?.transcript;
      return original == null ? [] : [{ questionText: sample.questionText, original, improved: sample.improved, improvedRanges: [] as [number, number][] }];
    }),
    responseDurations: answers.map((answer, index) => ({
      label: `Q${index + 1}${answer.question.isFollowUp ? '*' : ''}`,
      sec: Math.round(answer.durationSec), expected: answer.question.expectedSec,
    })),
  };
}
