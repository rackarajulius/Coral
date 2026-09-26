import { describe, expect, it } from "vitest";
import type { Question } from "../../types";
import { INITIAL_SCORES, analyzeAnswer, overallScore, smoothScores } from "../scoring";
import { pickFollowUp } from "../followUps";

const q: Question = {
  id: "q1",
  text: "Tell me about a challenging project.",
  competency: "structure",
  keywords: ["architecture", "performance", "designed", "optimized"],
  expectedSec: 120,
};

const STRONG_ANSWER =
  "When I was at my previous company, we had a serious performance problem in our reporting service. " +
  "My task was to bring page load under two seconds without adding infrastructure cost. " +
  "So I profiled the hot paths, designed a caching layer, and optimized the worst queries, " +
  "because the trade-off between memory and latency clearly favored caching in our case. " +
  "As a result, we reduced p95 latency by 70% and cut database load by 40%, " +
  "which led to the architecture being adopted by two other teams.";

const WEAK_ANSWER = "Um, I guess I like worked on some stuff, you know, maybe some projects.";

describe("analyzeAnswer", () => {
  it("rewards a structured, keyword-rich, quantified answer", () => {
    const a = analyzeAnswer(STRONG_ANSWER, 110, q);
    expect(a.starBuckets).toBe(4);
    expect(a.hasNumbers).toBe(true);
    expect(a.keywordRatio).toBeGreaterThanOrEqual(0.75);
    expect(a.raw.structure).toBeGreaterThan(80);
    expect(a.raw.confidence).toBeGreaterThan(60);
    expect(a.raw.technicalDepth).toBeGreaterThan(70);
    expect(overallScore(a.raw)).toBeGreaterThan(70);
  });

  it("punishes a short, filler-heavy, hedging answer", () => {
    const a = analyzeAnswer(WEAK_ANSWER, 8, q);
    expect(a.fillerCount).toBeGreaterThanOrEqual(3);
    expect(a.hedgeCount).toBeGreaterThanOrEqual(2);
    expect(a.raw.communication).toBeLessThan(45);
    expect(a.raw.confidence).toBeLessThan(35);
    expect(overallScore(a.raw)).toBeLessThan(45);
  });

  it("handles an empty transcript without NaN", () => {
    const a = analyzeAnswer("", 0, q);
    expect(a.wordCount).toBe(0);
    Object.values(a.raw).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(5);
    });
  });

  it("keeps all scores within 5–98", () => {
    for (const text of [STRONG_ANSWER, WEAK_ANSWER, "word ".repeat(500)]) {
      const a = analyzeAnswer(text, 60, q);
      Object.values(a.raw).forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(98);
      });
    }
  });
});

describe("smoothScores", () => {
  it("moves 40% of the way toward the raw score and reports deltas", () => {
    const raw = { ...INITIAL_SCORES, communication: 100 };
    const { scores, delta } = smoothScores(INITIAL_SCORES, raw);
    expect(scores.communication).toBe(70); // 50*0.6 + 100*0.4
    expect(delta.communication).toBe(20);
    expect(delta.confidence).toBeUndefined();
  });
});

describe("pickFollowUp", () => {
  it("probes a too-short answer", () => {
    const a = analyzeAnswer("I did a project once.", 6, q);
    const fu = pickFollowUp(a, q, ["What was the impact?"], () => 0.99);
    expect(fu).not.toBeNull();
    expect(fu!.isFollowUp).toBe(true);
    expect(fu!.parentId).toBe(q.id);
  });

  it("never follows up on a follow-up", () => {
    const a = analyzeAnswer("Short.", 3, q);
    const fu = pickFollowUp(a, { ...q, isFollowUp: true }, ["probe"], () => 0);
    expect(fu).toBeNull();
  });

  it("skips the coin-flip probe when the answer is strong and the roll is high", () => {
    const a = analyzeAnswer(STRONG_ANSWER, 110, q);
    const fu = pickFollowUp(a, q, ["probe A", "probe B"], () => 0.9);
    expect(fu).toBeNull();
  });
});
