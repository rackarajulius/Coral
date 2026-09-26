import type {
  CompetencyId,
  Difficulty,
  InterviewConfig,
  InterviewType,
  Question,
} from "../types";

export interface QuestionTemplate {
  /** `{role}` is interpolated with the configured target role. */
  text: string;
  competency: CompetencyId;
  keywords: string[];
  expectedSec: number;
  minDifficulty: Difficulty;
  /** Scripted competency probes used when an answer is thin. */
  probes: string[];
}

const t = (
  text: string,
  competency: CompetencyId,
  keywords: string[],
  expectedSec: number,
  minDifficulty: Difficulty,
  probes: string[],
): QuestionTemplate => ({ text, competency, keywords, expectedSec, minDifficulty, probes });

export const QUESTION_BANKS: Record<Exclude<InterviewType, "mixed">, QuestionTemplate[]> = {
  hr: [
    t("Walk me through your background and what led you to pursue the {role} path.", "communication", ["experience", "team", "project", "learned"], 90, 1, ["What part of that journey best prepared you for this role?"]),
    t("Why are you interested in this {role} position, and what are you looking for in your next team?", "communication", ["growth", "impact", "team", "culture"], 75, 1, ["What specifically about the team environment matters most to you?"]),
    t("What do you consider your greatest professional strength, and how has it shown up in your work?", "confidence", ["strength", "example", "result", "feedback"], 75, 1, ["Can you give me one concrete example of that strength in action?"]),
    t("Tell me about a weakness you've been actively working on. What progress have you made?", "confidence", ["improve", "feedback", "learned", "progress"], 75, 1, ["What did you change in your day-to-day to address it?"]),
    t("Where do you see yourself in three years, and how does this role fit into that plan?", "communication", ["goal", "grow", "lead", "learn"], 60, 1, ["What skills do you need to build to get there?"]),
    t("Tell me about a time you had to adapt to a significant change at work.", "structure", ["change", "adapted", "result", "team"], 90, 2, ["What was the hardest part of that transition for you personally?"]),
    t("What kind of manager and feedback style helps you do your best work?", "communication", ["feedback", "autonomy", "communication", "trust"], 60, 2, ["Tell me about a time feedback meaningfully changed your work."]),
    t("Why are you leaving your current position, and what would make this move successful?", "confidence", ["growth", "challenge", "opportunity", "impact"], 75, 2, ["What would need to be true in six months for you to call it a success?"]),
  ],
  behavioral: [
    t("Tell me about a project you're most proud of as a {role}. What was your specific contribution?", "structure", ["situation", "led", "built", "result", "impact"], 120, 1, ["What measurable impact did the project have?"]),
    t("Describe a time you disagreed with a teammate or your manager. How did you handle it?", "communication", ["disagreed", "listened", "compromise", "resolved"], 105, 1, ["What would you do differently if it happened again?"]),
    t("Tell me about a time you failed or missed a deadline. What happened and what did you learn?", "confidence", ["failed", "mistake", "learned", "changed"], 105, 1, ["How did you communicate the failure to stakeholders?"]),
    t("Give me an example of a time you had to deliver under significant pressure or a tight deadline.", "structure", ["deadline", "prioritized", "delivered", "result"], 105, 1, ["How did you decide what to cut?"]),
    t("Tell me about a time you received difficult feedback. How did you respond?", "confidence", ["feedback", "accepted", "improved", "changed"], 90, 2, ["What did you do in the following weeks to act on it?"]),
    t("Describe a situation where you had to influence people without formal authority.", "communication", ["influenced", "stakeholders", "convinced", "aligned"], 105, 2, ["What resistance did you hit, and how did you overcome it?"]),
    t("Tell me about the most ambiguous problem you've been handed as a {role}. How did you make progress?", "problemSolving", ["ambiguous", "scoped", "prioritized", "iterated"], 120, 3, ["How did you know you were working on the right thing?"]),
    t("Describe a time you went above and beyond what was asked of you. Why did you do it?", "structure", ["initiative", "noticed", "delivered", "impact"], 90, 2, ["What was the outcome, in numbers if you can?"]),
    t("Tell me about a time you had to make an unpopular decision. How did you bring people along?", "confidence", ["decision", "explained", "trade-off", "outcome"], 105, 3, ["Who pushed back the hardest, and what changed their mind?"]),
  ],
  technical: [
    t("Walk me through the most technically challenging problem you've solved as a {role}.", "technicalDepth", ["architecture", "performance", "debugged", "optimized", "designed"], 150, 1, ["What alternatives did you consider, and why did you reject them?"]),
    t("How do you approach debugging a production issue you've never seen before?", "problemSolving", ["logs", "reproduce", "hypothesis", "isolate", "monitoring"], 120, 1, ["Tell me about a real incident where you used that approach."]),
    t("Tell me about a time you had to make a significant technical trade-off. How did you decide?", "problemSolving", ["trade-off", "performance", "cost", "maintainability", "decided"], 120, 2, ["What data did you use to make that call?"]),
    t("How do you ensure the quality of your work before it ships? Walk me through your process.", "technicalDepth", ["testing", "review", "automation", "monitoring", "ci"], 105, 1, ["What's a bug that still got through, and what did you change afterward?"]),
    t("Describe a piece of technical debt you identified and paid down. Was it worth it?", "technicalDepth", ["refactor", "legacy", "migration", "risk", "incremental"], 120, 2, ["How did you justify the investment to non-engineers?"]),
    t("Explain a complex technical concept from your work as if I were a non-technical stakeholder.", "communication", ["simple", "analogy", "example", "why"], 90, 2, ["Now go one level deeper — what nuance did that simplification hide?"]),
    t("Tell me about a time you improved the performance of a system. How did you measure success?", "technicalDepth", ["profiling", "latency", "throughput", "benchmark", "metrics"], 135, 3, ["What was the before/after in concrete numbers?"]),
    t("How do you evaluate and adopt a new technology or tool for your team?", "problemSolving", ["evaluate", "prototype", "criteria", "risk", "adoption"], 105, 3, ["Tell me about a technology bet you got wrong."]),
  ],
  "system-design": [
    t("Design a URL shortener at a global scale. Walk me through your approach out loud.", "technicalDepth", ["hashing", "database", "cache", "scale", "availability"], 180, 1, ["How would you handle a celebrity link getting a billion clicks in an hour?"]),
    t("How would you design the backend for a real-time chat application?", "technicalDepth", ["websocket", "queue", "delivery", "presence", "storage"], 180, 2, ["How do you guarantee message ordering across devices?"]),
    t("A service you own is timing out under load. Walk me through how you'd diagnose and fix it.", "problemSolving", ["metrics", "bottleneck", "scale", "cache", "load"], 150, 1, ["What would you do if the bottleneck turned out to be the database?"]),
    t("How would you design a rate limiter for a public API?", "technicalDepth", ["token bucket", "sliding window", "redis", "distributed", "throttle"], 150, 2, ["Where does the state live when you have 50 API servers?"]),
    t("Design a news feed system. How do you balance freshness, relevance, and cost?", "problemSolving", ["fanout", "ranking", "cache", "precompute", "trade-off"], 180, 3, ["Push or pull fanout — when would you switch strategies?"]),
    t("How do you approach data consistency in a distributed system? Ground it in something you've built.", "technicalDepth", ["consistency", "eventual", "transaction", "idempotent", "replication"], 150, 3, ["Give me a case where eventual consistency actively hurt you."]),
    t("Design the storage layer for a file-sharing product like Dropbox.", "technicalDepth", ["chunking", "dedup", "metadata", "sync", "blob"], 180, 3, ["How do you sync a 2GB file that changed by 4KB?"]),
    t("Your team must cut infrastructure cost by 40% without hurting reliability. Where do you start?", "problemSolving", ["cost", "utilization", "autoscale", "reserved", "trade-off"], 150, 4, ["Which cut would you refuse to make, and why?"]),
  ],
  leadership: [
    t("Tell me about a time you led a team or project through a difficult period.", "structure", ["led", "team", "morale", "result", "communicated"], 120, 1, ["What did you personally do differently during that period?"]),
    t("How do you handle conflict between two strong performers on your team?", "communication", ["listened", "mediated", "one-on-one", "resolved"], 105, 1, ["Tell me about a real case — how did it end?"]),
    t("Describe a time you had to deliver hard news to your team or a stakeholder.", "confidence", ["transparent", "direct", "empathy", "plan"], 105, 2, ["How did you prepare for that conversation?"]),
    t("How do you develop people? Tell me about someone you helped grow.", "communication", ["mentored", "coached", "feedback", "promoted", "growth"], 120, 2, ["What was the turning point in their growth?"]),
    t("Tell me about a time you inherited a struggling team or project. What did you change first?", "problemSolving", ["assessed", "prioritized", "quick win", "trust", "turnaround"], 135, 3, ["How did you decide what NOT to change?"]),
    t("How do you balance delivery pressure against your team's health and quality standards?", "problemSolving", ["scope", "pushback", "sustainable", "trade-off"], 105, 2, ["Describe a time you pushed back on leadership — what happened?"]),
    t("Describe your approach to setting direction. How do you get a team aligned behind a goal?", "structure", ["vision", "goals", "communicated", "buy-in", "metrics"], 120, 3, ["How do you know alignment is real and not just polite nodding?"]),
    t("Tell me about the hardest personnel decision you've made.", "confidence", ["performance", "fair", "documented", "decision"], 105, 4, ["Looking back, did you act too early or too late?"]),
  ],
  product: [
    t("Tell me about a product decision you drove. How did you know it was the right call?", "problemSolving", ["data", "users", "metrics", "hypothesis", "validated"], 120, 1, ["What signal would have told you it was the wrong call?"]),
    t("How do you prioritize a roadmap when everything feels important?", "structure", ["framework", "impact", "effort", "stakeholders", "trade-off"], 105, 1, ["Walk me through a real prioritization call you made recently."]),
    t("A key metric dropped 15% overnight. Walk me through your first 24 hours.", "problemSolving", ["segment", "funnel", "hypothesis", "data", "root cause"], 120, 2, ["It turned out to be a tracking bug — what do you do next?"]),
    t("Tell me about a feature you shipped that failed. What did you miss?", "confidence", ["assumption", "learned", "users", "iterate"], 105, 2, ["What would your discovery process catch today that it didn't then?"]),
    t("How do you understand what users actually need, rather than what they say they want?", "communication", ["research", "interviews", "behavior", "data", "insight"], 105, 2, ["Give me an example where behavior contradicted what users said."]),
    t("Pick a product you love. How would you improve it, and how would you measure success?", "problemSolving", ["users", "problem", "metric", "experiment"], 135, 1, ["What's the biggest risk in your proposal?"]),
    t("How do you work with engineering when they say your top priority will take three months?", "communication", ["scope", "mvp", "trade-off", "negotiated", "trust"], 105, 3, ["Tell me about a time you cut scope and it was the wrong cut."]),
    t("Describe how you'd set the success metrics for a brand-new product line.", "structure", ["north star", "leading", "lagging", "counter-metric", "cohort"], 120, 3, ["What counter-metric would you watch to catch harm early?"]),
  ],
};

// ─── Selection ────────────────────────────────────────────────────────────────

let uid = 0;
const nextId = () => `q-${Date.now().toString(36)}-${++uid}`;

export function instantiate(tpl: QuestionTemplate, role: string): Question {
  return {
    id: nextId(),
    text: tpl.text.split("{role}").join(role),
    competency: tpl.competency,
    keywords: tpl.keywords,
    expectedSec: tpl.expectedSec,
  };
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Templates for the configured type, "mixed" sampling across every bank. */
export function templatesFor(type: InterviewType): QuestionTemplate[] {
  if (type !== "mixed") return QUESTION_BANKS[type];
  return Object.values(QUESTION_BANKS).flat();
}

/**
 * Build the question pool for a session: filter by difficulty, then rank by
 * overlap with focus skills / resume skills so the interview feels tailored.
 * Returns more than questionCount so adaptive difficulty has room to swap.
 */
export function buildPool(config: InterviewConfig): { question: Question; difficulty: Difficulty; probes: string[] }[] {
  const focus = new Set(
    [...config.focusSkills, ...(config.resume?.skills ?? [])].map((s) => s.toLowerCase()),
  );

  const maxDifficulty = Math.min(4, config.difficulty + 1);
  const eligible = templatesFor(config.type).filter((tpl) => tpl.minDifficulty <= maxDifficulty);

  const scored = shuffled(eligible).map((tpl) => {
    const overlap = tpl.keywords.filter((k) => focus.has(k.toLowerCase())).length;
    return { tpl, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap);

  return scored.map(({ tpl }) => ({
    question: instantiate(tpl, config.role),
    difficulty: tpl.minDifficulty,
    probes: tpl.probes,
  }));
}
