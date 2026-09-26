import type {
  AnswerEvaluation,
  InterviewConfig,
  Question,
  SessionReport,
  SubmittedAnswer,
} from "../types";
import { SimulatedInterviewEngine } from "./SimulatedInterviewEngine";
import { ApiInterviewEngine } from "./ApiInterviewEngine";

/**
 * Everything the interview UI knows about "the interviewer". The session store
 * and screens depend only on this interface — swapping in a real LLM backend
 * means shipping a new implementation and changing `createEngine` below.
 */
export interface InterviewEngine {
  startSession(
    config: InterviewConfig,
  ): Promise<{ sessionId: string; greeting: string; totalQuestions: number }>;
  /** Next main question, or null when the interview is complete. */
  nextQuestion(): Promise<Question | null>;
  submitAnswer(answer: SubmittedAnswer): Promise<AnswerEvaluation>;
  generateReport(): Promise<SessionReport>;
  abort(): void;
}

/**
 * Real (LLM-backed) interviewer when we have a persisted session to attach to;
 * the offline simulator otherwise, so an unauthenticated or offline user can
 * still practise rather than hitting a dead end.
 */
export function createEngine(serverSessionId?: string | null): InterviewEngine {
  return serverSessionId ? new ApiInterviewEngine(serverSessionId) : new SimulatedInterviewEngine();
}
