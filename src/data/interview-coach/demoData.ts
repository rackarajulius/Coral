import { buildReport } from "./engine/reportBuilder";
import { analyzeAnswer, smoothScores, INITIAL_SCORES } from "./engine/scoring";
import type {
  AnswerRecord,
  HistoryEntry,
  InterviewConfig,
  LiveScores,
  Question,
} from "./types";

// Deterministic sample history so the empty state has an "explore with sample
// data" path. Four sessions over three weeks with a visible upward trend.

const DEMO_TRANSCRIPTS = [
  "Um, I worked on a project, you know, it was like a dashboard thing. I guess it went okay, maybe the users liked it.",
  "At my previous company we had a slow dashboard. I needed to make it faster, so I added caching and optimized queries. As a result load time improved by 40%.",
  "When I was at my last job, our team had a reporting service with performance problems. My task was to cut page load under two seconds. So I profiled the hot paths, designed a caching layer, and optimized the worst queries because the trade-off favored memory over latency. As a result we reduced p95 latency by 70% and two other teams adopted the architecture.",
  "There was a situation where a launch was slipping. My task was to get us back on track. So I re-scoped the milestone with the PM, led daily standups, and cut two nice-to-haves, because shipping the core flow mattered most. As a result we launched on time and the feature grew retention by 12%.",
];

function demoQuestion(i: number, text: string): Question {
  return {
    id: `demo-q-${i}`,
    text,
    competency: (["structure", "communication", "technicalDepth", "problemSolving"] as const)[i % 4],
    keywords: ["designed", "optimized", "result", "team", "trade-off"],
    expectedSec: 105,
  };
}

const DEMO_QUESTION_TEXTS = [
  "Tell me about a project you're most proud of. What was your specific contribution?",
  "Describe a time you had to deliver under a tight deadline.",
  "Walk me through the most technically challenging problem you've solved.",
  "Tell me about a time you had to make a significant trade-off. How did you decide?",
];

function makeEntry(daysAgo: number, transcriptQuality: number[], config: InterviewConfig): HistoryEntry {
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  let scores: LiveScores = { ...INITIAL_SCORES };
  const answers: AnswerRecord[] = transcriptQuality.map((quality, i) => {
    const question = demoQuestion(i, DEMO_QUESTION_TEXTS[i % DEMO_QUESTION_TEXTS.length]);
    const transcript = DEMO_TRANSCRIPTS[quality];
    const durationSec = 45 + quality * 25;
    const analysis = analyzeAnswer(transcript, durationSec, question);
    const smoothed = smoothScores(scores, analysis.raw);
    scores = smoothed.scores;
    return {
      questionId: question.id,
      transcript,
      durationSec,
      question,
      evaluation: {
        scores: smoothed.scores,
        delta: smoothed.delta,
        fillerCount: analysis.fillerCount,
        wordCount: analysis.wordCount,
      },
      askedAt: createdAt,
    };
  });

  const sessionId = crypto.randomUUID();
  const report = buildReport({ sessionId, config, answers, finalScores: scores });

  return {
    id: sessionId,
    createdAt,
    config,
    durationSec: answers.reduce((a, r) => a + r.durationSec + 60, 0),
    overallScore: report.overallScore,
    status: "completed",
    report,
    answers,
  };
}

const cfg = (over: Partial<InterviewConfig>): InterviewConfig => ({
  role: "Frontend Engineer",
  experience: "mid",
  type: "behavioral",
  difficulty: 2,
  adaptive: false,
  language: "en-US",
  speechRate: 1,
  durationMin: 20,
  questionCount: 6,
  focusSkills: ["React", "TypeScript"],
  ...over,
});

export function buildDemoHistory(): HistoryEntry[] {
  const entries = [
    makeEntry(21, [0, 0, 1, 1], cfg({ type: "hr", difficulty: 1 })),
    makeEntry(14, [1, 1, 2, 1], cfg({})),
    makeEntry(6, [1, 2, 2, 3], cfg({ type: "technical" })),
    makeEntry(1, [2, 3, 3, 3], cfg({ type: "mixed", difficulty: 3 })),
  ];

  // Fill in the improvement chain oldest → newest.
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  sorted.forEach((e, i) => {
    if (i > 0) e.improvementVsPrev = e.overallScore - sorted[i - 1].overallScore;
    if (e.report && i > 0 && sorted[i - 1].report) {
      e.report.competencies.forEach((c) => {
        const prev = sorted[i - 1].report!.competencies.find((p) => p.id === c.id);
        if (prev) c.trendVsPrev = c.score - prev.score;
      });
    }
  });

  return sorted.reverse(); // newest first
}
