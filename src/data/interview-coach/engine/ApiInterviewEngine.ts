import * as api from "@/lib/api/interviewCoach";
import type {
  AnswerEvaluation, AnswerRecord, InterviewConfig, Question, SessionReport, SubmittedAnswer,
} from "../types";
import type { InterviewEngine } from "./InterviewEngine";

/** The API commits each evaluation before the candidate sees the next question. */
export class ApiInterviewEngine implements InterviewEngine {
  private sessionId: string;
  private questions: Question[] = [];
  private index = 0;
  private aborted = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async startSession(_config: InterviewConfig) {
    const { greeting, questions, totalQuestions } = await api.planSession(this.sessionId);
    this.questions = questions;
    return { sessionId: this.sessionId, greeting, totalQuestions };
  }

  /** Restore follow-ups and the next unanswered question from persisted answers. */
  restore(answers: AnswerRecord[]) {
    for (const answer of answers) {
      const followUp = answer.evaluation.followUp;
      if (!followUp) continue;
      const parentIndex = this.questions.findIndex((q) => q.id === answer.questionId);
      if (parentIndex >= 0 && !this.questions.some((q) => q.id === followUp.id)) {
        this.questions.splice(parentIndex + 1, 0, followUp);
      }
    }
    this.index = answers.length;
  }

  async nextQuestion(): Promise<Question | null> {
    if (this.aborted || this.index >= this.questions.length) return null;
    return this.questions[this.index++];
  }

  async submitAnswer(answer: SubmittedAnswer): Promise<AnswerEvaluation> {
    const question = this.questions[this.index - 1];
    if (!question || question.id !== answer.questionId) {
      throw new Error(`Unknown question: ${answer.questionId}`);
    }
    const evaluation = await api.evaluateAnswer(this.sessionId, {
      questionId: question.id,
      answer: answer.transcript,
      durationSec: answer.durationSec,
      typed: answer.typed,
    });
    if (evaluation.followUp && !this.questions.some((q) => q.id === evaluation.followUp?.id)) {
      this.questions.splice(this.index, 0, evaluation.followUp);
    }
    return evaluation;
  }

  generateReport(): Promise<SessionReport> {
    return api.buildReport(this.sessionId);
  }

  abort() {
    this.aborted = true;
  }
}
