import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerRecord, InterviewConfig, Question } from "../../types";
import * as api from "@/lib/api/interviewCoach";
import { ApiInterviewEngine } from "../ApiInterviewEngine";

vi.mock("@/lib/api/interviewCoach", () => ({
  planSession: vi.fn(),
  evaluateAnswer: vi.fn(),
  buildReport: vi.fn(),
}));

const planSession = vi.mocked(api.planSession);
const evaluateAnswer = vi.mocked(api.evaluateAnswer);

const question = (id: string, isFollowUp = false): Question => ({
  id,
  text: `Question ${id}`,
  competency: "structure",
  keywords: [],
  expectedSec: 120,
  ...(isFollowUp ? { isFollowUp: true } : {}),
});

const evaluation = (followUp?: Question) => ({
  scores: { communication: 0, confidence: 0, technicalDepth: 0, problemSolving: 0, structure: 0 },
  delta: {},
  fillerCount: 0,
  wordCount: 0,
  ...(followUp ? { followUp } : {}),
});

const answered = (q: Question, followUp?: Question): AnswerRecord => ({
  questionId: q.id,
  transcript: "An answer.",
  durationSec: 60,
  question: q,
  evaluation: evaluation(followUp),
  askedAt: new Date().toISOString(),
});

const config = { role: "Engineer" } as InterviewConfig;

/** Ask for the next question and immediately answer it. */
async function turn(engine: ApiInterviewEngine) {
  const q = await engine.nextQuestion();
  if (!q) return null;
  await engine.submitAnswer({ questionId: q.id, transcript: "An answer.", durationSec: 60 });
  return q;
}

describe("ApiInterviewEngine question sequencing", () => {
  beforeEach(() => {
    planSession.mockReset();
    evaluateAnswer.mockReset();
    planSession.mockResolvedValue({
      greeting: "Hello",
      questions: [question("q1"), question("q2"), question("q3")],
      totalQuestions: 3,
    });
    evaluateAnswer.mockResolvedValue(evaluation());
  });

  it("walks the planned questions in order", async () => {
    const engine = new ApiInterviewEngine("session");
    await engine.startSession(config);
    const asked: string[] = [];
    for (let i = 0; i < 4; i++) {
      const q = await turn(engine);
      if (q) asked.push(q.id);
    }
    expect(asked).toEqual(["q1", "q2", "q3"]);
    expect(await engine.nextQuestion()).toBeNull();
  });

  it("asks a follow-up straight after the answer that earned it", async () => {
    const engine = new ApiInterviewEngine("session");
    await engine.startSession(config);
    evaluateAnswer.mockResolvedValueOnce(evaluation(question("q1-fu", true)));
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const q = await turn(engine);
      if (q) asked.push(q.id);
    }
    expect(asked).toEqual(["q1", "q1-fu", "q2", "q3"]);
  });

  it("asks a follow-up to a follow-up without losing its place", async () => {
    const engine = new ApiInterviewEngine("session");
    await engine.startSession(config);
    evaluateAnswer
      .mockResolvedValueOnce(evaluation(question("q1-fu", true)))
      .mockResolvedValueOnce(evaluation(question("q1-fu-fu", true)));
    const asked: string[] = [];
    for (let i = 0; i < 6; i++) {
      const q = await turn(engine);
      if (q) asked.push(q.id);
    }
    expect(asked).toEqual(["q1", "q1-fu", "q1-fu-fu", "q2", "q3"]);
  });

  it("submits the answer against the question the API was told about", async () => {
    const engine = new ApiInterviewEngine("session");
    await engine.startSession(config);
    evaluateAnswer.mockResolvedValueOnce(evaluation(question("q1-fu", true)));
    await turn(engine);
    await turn(engine);
    expect(evaluateAnswer.mock.calls.map((c) => (c[1] as { questionId: string }).questionId))
      .toEqual(["q1", "q1-fu"]);
  });

  it("rejects an answer to a question that was never the current one", async () => {
    const engine = new ApiInterviewEngine("session");
    await engine.startSession(config);
    await engine.nextQuestion();
    await expect(engine.submitAnswer({ questionId: "q3", transcript: "x", durationSec: 1 }))
      .rejects.toThrow("Unknown question: q3");
    expect(evaluateAnswer).not.toHaveBeenCalled();
  });

  describe("resuming a session from persisted answers", () => {
    it("continues at the follow-up that was earned but not yet answered", async () => {
      const engine = new ApiInterviewEngine("session");
      await engine.startSession(config);
      const followUp = question("q1-fu", true);
      engine.restore([answered(question("q1"), followUp)]);
      expect((await engine.nextQuestion())?.id).toBe("q1-fu");
      await engine.submitAnswer({ questionId: "q1-fu", transcript: "x", durationSec: 1 });
      expect((await engine.nextQuestion())?.id).toBe("q2");
    });

    it("continues past a follow-up that was already answered", async () => {
      const engine = new ApiInterviewEngine("session");
      await engine.startSession(config);
      const followUp = question("q1-fu", true);
      engine.restore([answered(question("q1"), followUp), answered(followUp)]);
      expect((await engine.nextQuestion())?.id).toBe("q2");
    });

    it("rebuilds a chain of follow-ups in the order they were asked", async () => {
      const engine = new ApiInterviewEngine("session");
      await engine.startSession(config);
      const first = question("q1-fu", true);
      const second = question("q1-fu-fu", true);
      engine.restore([answered(question("q1"), first), answered(first, second)]);
      expect((await engine.nextQuestion())?.id).toBe("q1-fu-fu");
      await engine.submitAnswer({ questionId: "q1-fu-fu", transcript: "x", durationSec: 1 });
      expect((await engine.nextQuestion())?.id).toBe("q2");
    });

    it("resumes mid-run after plain answers", async () => {
      const engine = new ApiInterviewEngine("session");
      await engine.startSession(config);
      engine.restore([answered(question("q1")), answered(question("q2"))]);
      expect((await engine.nextQuestion())?.id).toBe("q3");
    });
  });

  it("stops handing out questions once aborted", async () => {
    const engine = new ApiInterviewEngine("session");
    await engine.startSession(config);
    engine.abort();
    expect(await engine.nextQuestion()).toBeNull();
  });
});
