import type { CompetencyId, LearningResource } from "./types";

// Static learning-resource catalog, keyed by the competency it strengthens.
// The report builder picks from the weakest competencies first.

export const LEARNING_RESOURCES: Record<CompetencyId, LearningResource[]> = {
  communication: [
    {
      title: "Answering concisely: the 90-second rule",
      kind: "article",
      url: "https://hbr.org/2021/07/how-to-speak-more-concisely",
      competency: "communication",
      durationMin: 8,
      reason: "Your answers drifted from the question's core — this teaches tight framing.",
    },
    {
      title: "Think Fast, Talk Smart (Stanford GSB)",
      kind: "video",
      url: "https://www.youtube.com/watch?v=HAnw168huqA",
      competency: "communication",
      durationMin: 58,
      reason: "Classic techniques for speaking clearly under pressure.",
    },
  ],
  confidence: [
    {
      title: "Eliminating filler words in interviews",
      kind: "article",
      url: "https://www.themuse.com/advice/how-to-stop-saying-um",
      competency: "confidence",
      durationMin: 6,
      reason: "Filler words were detected in several answers — small pauses beat 'um'.",
    },
    {
      title: "Mock pressure drills: 2-minute answers",
      kind: "exercise",
      url: "https://interviewing.io/",
      competency: "confidence",
      durationMin: 20,
      reason: "Repeated timed reps are the fastest way to sound certain.",
    },
  ],
  technicalDepth: [
    {
      title: "Explaining technical decisions to interviewers",
      kind: "article",
      url: "https://newsletter.pragmaticengineer.com/",
      competency: "technicalDepth",
      durationMin: 12,
      reason: "Name concrete technologies, numbers, and trade-offs in every answer.",
    },
    {
      title: "System Design Primer",
      kind: "course",
      url: "https://github.com/donnemartin/system-design-primer",
      competency: "technicalDepth",
      durationMin: 180,
      reason: "Deepen the architecture vocabulary your answers were missing.",
    },
  ],
  problemSolving: [
    {
      title: "Trade-off thinking: 'because' and 'instead of'",
      kind: "article",
      url: "https://www.lennysnewsletter.com/",
      competency: "problemSolving",
      durationMin: 10,
      reason: "Strong answers explain why an approach won over the alternatives.",
    },
    {
      title: "Case-style problem walkthroughs",
      kind: "video",
      url: "https://www.youtube.com/results?search_query=case+interview+walkthrough",
      competency: "problemSolving",
      durationMin: 35,
      reason: "See how top candidates decompose ambiguous prompts step by step.",
    },
  ],
  structure: [
    {
      title: "The STAR method, properly applied",
      kind: "article",
      url: "https://www.themuse.com/advice/star-interview-method",
      competency: "structure",
      durationMin: 7,
      reason: "Several answers were missing a measurable Result — STAR fixes that.",
    },
    {
      title: "Drill: rewrite 3 answers in STAR format",
      kind: "exercise",
      url: "https://grow.google/certificates/interview-warmup/",
      competency: "structure",
      durationMin: 25,
      reason: "Practice converting your real stories into Situation→Task→Action→Result.",
    },
  ],
};
