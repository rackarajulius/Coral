import * as api from "@/lib/api/interviewCoach";
import type {
  AnswerEvaluation,
  AnswerRecord,
  CompetencyId,
  InterviewConfig,
  LiveScores,
  Question,
  SessionReport,
  SubmittedAnswer,
} from "../types";
import type { InterviewEngine } from "./InterviewEngine";
import { buildReport } from "./reportBuilder";
import { INITIAL_SCORES, analyzeAnswer, smoothScores } from "./scoring";

/**
 * Server-backed interviewer. Questions, per-answer scoring and the final report
 * all come from the LLM via `/interview-coach/sessions/:id/*`.
 *
 * Local `analyzeAnswer` is still used, but ONLY for the metrics that are
 * genuinely measurable client-side and wanted instantly (filler count, word
 * count). The competency scores shown to the user are the AI's, never the
 * regex heuristics — if the AI call fails we surface the error rather than
 * substituting a heuristic score dressed up as an evaluation.
 */
export class ApiInterviewEngine implements InterviewEngine {
  private config!: InterviewConfig;
  private sessionId = "";
  private questions: Question[] = [];
  private index = 0;
  private answers: AnswerRecord[] = [];
  private scores: LiveScores = { ...INITIAL_SCORES };
  private followUpsUsed = 0;
  private maxFollowUps = 0;
  private aborted = false;

  /** The session row must already exist — the store creates it before starting. */
  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async startSession(config: InterviewConfig) {
    this.config = config;
    const { greeting, questions, totalQuestions } = await api.planSession(this.sessionId);
    this.questions = questions;
    this.maxFollowUps = Math.ceil(Math.max(totalQuestions, 1) / 3);
    return { sessionId: this.sessionId, greeting, totalQuestions };
  }

  async nextQuestion(): Promise<Question | null> {
    if (this.aborted || this.index >= this.questions.length) return null;
    return this.questions[this.index++];
  }

  async submitAnswer(answer: SubmittedAnswer): Promise<AnswerEvaluation> {
    const question =
      this.questions.find((q) => q.id === answer.questionId) ?? this.questions[this.index - 1];
    if (!question) throw new Error(`Unknown question: ${answer.questionId}`);

    // Instant, locally-measurable delivery metrics (not the score).
    const analysis = analyzeAnswer(answer.transcript, answer.durationSec, question);

    const result = await api.evaluateAnswer(this.sessionId, {
      question,
      answer: answer.transcript,
      // Whole seconds — sub-second precision is meaningless for pacing.
      durationSec: Math.round(answer.durationSec),
    });

    // Smooth the AI's per-answer scores into the running totals.
    const { scores, delta } = smoothScores(this.scores, result.scores as LiveScores);
    this.scores = scores;

    let followUp: Question | undefined;
    if (result.followUp && this.followUpsUsed < this.maxFollowUps) {
      this.followUpsUsed++;
      followUp = {
        id: `fu-${question.id}-${this.followUpsUsed}`,
        text: result.followUp,
        competency: question.competency,
        keywords: question.keywords,
        expectedSec: Math.round(question.expectedSec * 0.6),
        isFollowUp: true,
        parentId: question.id,
      };
      this.questions.splice(this.index, 0, followUp);
    }

    const evaluation: AnswerEvaluation = {
      scores,
      delta,
      fillerCount: analysis.fillerCount,
      wordCount: analysis.wordCount,
      followUp,
    };

    this.answers.push({
      ...answer,
      question,
      evaluation,
      askedAt: new Date().toISOString(),
    });

    return evaluation;
  }

  async generateReport(): Promise<SessionReport> {
    // Deterministic scaffold (scores, durations, resources) from the real answers…
    const base = buildReport({
      sessionId: this.sessionId,
      config: this.config,
      answers: this.answers,
      finalScores: this.scores,
    });

    // …then let the AI write the qualitative half, grounded in the transcript.
    try {
      const ai = await api.buildReport(this.sessionId, {
        finalScores: this.scores,
        qa: this.answers.map((a) => ({
          question: a.question.text,
          competency: a.question.competency,
          answer: a.transcript,
        })),
      });

      const insightById = new Map(ai.competencyInsights.map((c) => [c.id, c.insight]));
      return {
        ...base,
        recommendation: ai.recommendation || base.recommendation,
        strengths: ai.strengths.length ? ai.strengths : base.strengths,
        weaknesses: ai.weaknesses.length ? ai.weaknesses : base.weaknesses,
        repeatedMistakes: ai.repeatedMistakes.length ? ai.repeatedMistakes : base.repeatedMistakes,
        focusAreas: ai.focusAreas.length ? ai.focusAreas : base.focusAreas,
        competencies: base.competencies.map((c) => ({
          ...c,
          insight: insightById.get(c.id as CompetencyId) || c.insight,
        })),
        sampleAnswers: ai.sampleAnswers.length
          ? ai.sampleAnswers.map((s) => ({
              questionText: s.questionText,
              original:
                this.answers.find((a) => a.question.text === s.questionText)?.transcript ?? "",
              improved: s.improved,
              improvedRanges: [],
            }))
          : base.sampleAnswers,
      };
    } catch {
      // AI debrief unavailable — return the measured scaffold rather than nothing.
      return base;
    }
  }

  abort() {
    this.aborted = true;
  }
}
