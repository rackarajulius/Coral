import { difficultyLabel, interviewTypeLabel } from "../constants";
import { salutation } from "../callName";
import type {
  AnswerEvaluation,
  AnswerRecord,
  Difficulty,
  InterviewConfig,
  LiveScores,
  Question,
  SessionReport,
  SubmittedAnswer,
} from "../types";
import type { InterviewEngine } from "./InterviewEngine";
import { pickFollowUp } from "./followUps";
import { buildReport } from "./reportBuilder";
import { INITIAL_SCORES, analyzeAnswer, overallScore, smoothScores } from "./scoring";
import { buildPool } from "./questionBanks";

/** Realistic "the AI is working" latency. */
const wait = (base: number, jitter: number) =>
  new Promise<void>((res) => setTimeout(res, base + Math.random() * jitter));

interface PoolItem {
  question: Question;
  difficulty: Difficulty;
  probes: string[];
}

export class SimulatedInterviewEngine implements InterviewEngine {
  private config!: InterviewConfig;
  private pool: PoolItem[] = [];
  private asked = new Map<string, { question: Question; probes: string[] }>();
  private answers: AnswerRecord[] = [];
  private scores: LiveScores = { ...INITIAL_SCORES };
  private askedMain = 0;
  private total = 0;
  private followUpsUsed = 0;
  private maxFollowUps = 0;
  private tier: Difficulty = 2;
  private recentRawOverall: number[] = [];
  private sessionId = "";
  private aborted = false;

  async startSession(config: InterviewConfig) {
    this.config = config;
    this.pool = buildPool(config);
    this.total = Math.min(config.questionCount, this.pool.length);
    this.maxFollowUps = Math.ceil(this.total / 3);
    this.tier = config.difficulty;
    this.sessionId = crypto.randomUUID();

    await wait(1400, 900);

    const greeting =
      `${salutation(config.callName)}, I'm Nova — your basic scripted interviewer. Today we'll run a ` +
      `${difficultyLabel(config.difficulty).toLowerCase()} ${interviewTypeLabel(config.type)} ` +
      `interview for the ${config.role} role, with ${this.total} questions` +
      `${config.adaptive ? " that adapt to how you're doing" : ""}. ` +
      `Speak naturally, take a breath before answering, and press Done when you finish. Let's begin.`;

    return { sessionId: this.sessionId, greeting, totalQuestions: this.total };
  }

  async nextQuestion(): Promise<Question | null> {
    if (this.aborted || this.askedMain >= this.total || this.pool.length === 0) return null;
    await wait(900, 1200);

    // Pick the pooled question whose difficulty best matches the current tier
    // (pool order already prefers focus-skill overlap).
    let best = 0;
    let bestDist = Infinity;
    this.pool.forEach((item, i) => {
      const dist = Math.abs(item.difficulty - this.tier);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });

    const [item] = this.pool.splice(best, 1);
    this.asked.set(item.question.id, { question: item.question, probes: item.probes });
    this.askedMain++;
    return item.question;
  }

  async submitAnswer(answer: SubmittedAnswer): Promise<AnswerEvaluation> {
    await wait(1100, 1300);

    const entry = this.asked.get(answer.questionId);
    if (!entry) throw new Error(`Unknown question: ${answer.questionId}`);

    const analysis = analyzeAnswer(answer.transcript, answer.durationSec, entry.question);
    const { scores, delta } = smoothScores(this.scores, analysis.raw);
    this.scores = scores;

    // Adaptive difficulty: two strong (or weak) raw answers in a row shift the tier.
    if (this.config.adaptive) {
      this.recentRawOverall.push(overallScore(analysis.raw));
      const last2 = this.recentRawOverall.slice(-2);
      if (last2.length === 2) {
        const avg = (last2[0] + last2[1]) / 2;
        if (avg > 75) this.tier = Math.min(4, this.tier + 1) as Difficulty;
        else if (avg < 45) this.tier = Math.max(1, this.tier - 1) as Difficulty;
      }
    }

    let followUp: Question | undefined;
    if (this.followUpsUsed < this.maxFollowUps) {
      const fu = pickFollowUp(analysis, entry.question, entry.probes);
      if (fu) {
        followUp = fu;
        this.followUpsUsed++;
        this.asked.set(fu.id, { question: fu, probes: [] });
      }
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
      question: entry.question,
      evaluation,
      askedAt: new Date().toISOString(),
    });

    return evaluation;
  }

  async generateReport(): Promise<SessionReport> {
    await wait(2800, 1200);
    return buildReport({
      sessionId: this.sessionId,
      config: this.config,
      answers: this.answers,
      finalScores: this.scores,
    });
  }

  abort() {
    this.aborted = true;
  }
}
