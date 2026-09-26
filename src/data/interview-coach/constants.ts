import type {
  CompetencyId,
  Difficulty,
  ExperienceLevel,
  InterviewConfig,
  InterviewType,
} from "./types";

// ─── Roles ────────────────────────────────────────────────────────────────────

export const ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full-Stack Engineer",
  "Mobile Engineer",
  "DevOps Engineer",
  "Data Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "QA Engineer",
  "Security Engineer",
  "Engineering Manager",
  "Product Manager",
  "Product Designer",
  "UX Researcher",
  "Technical Writer",
  "Sales Engineer",
  "Customer Success Manager",
  "Marketing Manager",
  "Business Analyst",
  "Project Manager",
] as const;

export const POPULAR_ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Product Manager",
  "Data Scientist",
  "Engineering Manager",
];

// ─── Experience ───────────────────────────────────────────────────────────────

export const EXPERIENCE_LEVELS: {
  id: ExperienceLevel;
  label: string;
  years: string;
  blurb: string;
}[] = [
  { id: "intern", label: "Intern", years: "0 yrs", blurb: "Internships and first exposure" },
  { id: "junior", label: "Junior", years: "0–2 yrs", blurb: "Early career, learning the craft" },
  { id: "mid", label: "Mid-level", years: "2–5 yrs", blurb: "Independent, reliable delivery" },
  { id: "senior", label: "Senior", years: "5–8 yrs", blurb: "Owns systems, mentors others" },
  { id: "staff", label: "Staff", years: "8–12 yrs", blurb: "Cross-team technical leadership" },
  { id: "principal", label: "Principal", years: "12+ yrs", blurb: "Org-wide strategy and impact" },
];

// ─── Interview types ──────────────────────────────────────────────────────────

export const INTERVIEW_TYPES: {
  id: InterviewType;
  label: string;
  blurb: string;
  competencies: CompetencyId[];
}[] = [
  { id: "hr", label: "HR Screen", blurb: "Motivation, fit, and career story", competencies: ["communication", "confidence"] },
  { id: "behavioral", label: "Behavioral", blurb: "Past experiences with the STAR method", competencies: ["structure", "communication"] },
  { id: "technical", label: "Technical", blurb: "Depth in your core technical skills", competencies: ["technicalDepth", "problemSolving"] },
  { id: "system-design", label: "System Design", blurb: "Architecture, trade-offs, and scale", competencies: ["technicalDepth", "problemSolving", "structure"] },
  { id: "leadership", label: "Leadership", blurb: "Influence, conflict, and team growth", competencies: ["confidence", "communication", "structure"] },
  { id: "product", label: "Product", blurb: "Product sense, metrics, and prioritization", competencies: ["problemSolving", "communication"] },
  { id: "mixed", label: "Mixed Mock", blurb: "A realistic blend across all rounds", competencies: ["communication", "confidence", "technicalDepth", "problemSolving", "structure"] },
];

export const interviewTypeLabel = (id: InterviewType) =>
  INTERVIEW_TYPES.find((t) => t.id === id)?.label ?? id;

// ─── Difficulty ───────────────────────────────────────────────────────────────

export const DIFFICULTY_LEVELS: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 1, label: "Beginner", blurb: "Warm, forgiving questions to build rhythm" },
  { id: 2, label: "Intermediate", blurb: "Standard interview bar for your level" },
  { id: 3, label: "Advanced", blurb: "Probing follow-ups and less hand-holding" },
  { id: 4, label: "Expert", blurb: "Bar-raiser pressure, edge cases, trade-offs" },
];

export const difficultyLabel = (d: Difficulty) =>
  DIFFICULTY_LEVELS.find((l) => l.id === d)?.label ?? `Level ${d}`;

// ─── Competencies ─────────────────────────────────────────────────────────────

export const COMPETENCIES: { id: CompetencyId; label: string; short: string }[] = [
  { id: "communication", label: "Communication", short: "Comms" },
  { id: "confidence", label: "Confidence", short: "Conf" },
  { id: "technicalDepth", label: "Technical Depth", short: "Tech" },
  { id: "problemSolving", label: "Problem Solving", short: "Solve" },
  { id: "structure", label: "Answer Structure", short: "STAR" },
];

export const competencyLabel = (id: CompetencyId) =>
  COMPETENCIES.find((c) => c.id === id)?.label ?? id;

// ─── Preferences ──────────────────────────────────────────────────────────────

export const LANGUAGES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "en-IN", label: "English (India)" },
];

export const DURATION_OPTIONS = [10, 15, 20, 30, 45];
export const QUESTION_COUNT_OPTIONS = [4, 6, 8, 10, 12];

export const FOCUS_SKILLS = [
  "React", "TypeScript", "Node.js", "Python", "SQL", "AWS", "Kubernetes",
  "System design", "APIs", "Testing", "CI/CD", "Data modeling",
  "Stakeholder management", "Roadmapping", "Metrics", "Team leadership",
  "Conflict resolution", "Hiring", "Mentoring", "Prioritization",
];

/** Plausible technology set for a role family — used by the resume "parse" and
 *  the past-interview card badges when no explicit skills were provided. */
export function techsForRole(role: string): string[] {
  const r = role.toLowerCase();
  if (r.includes("front")) return ["React", "TypeScript", "Testing", "APIs", "CSS"];
  if (r.includes("back") || r.includes("devops") || r.includes("data engineer"))
    return ["Node.js", "SQL", "AWS", "APIs", "CI/CD"];
  if (r.includes("data") || r.includes("machine")) return ["Python", "SQL", "Data modeling", "Metrics"];
  if (r.includes("manager") || r.includes("lead"))
    return ["Team leadership", "Hiring", "Mentoring", "Roadmapping"];
  if (r.includes("product")) return ["Metrics", "Prioritization", "Roadmapping", "Stakeholder management"];
  return ["Communication", "APIs", "Testing", "Prioritization"];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * A job posting's level ("entry", "Mid level", "Lead"…) as a coach level, or
 * undefined when it doesn't clearly map — then the person picks it.
 */
export function coachLevelFromJob(level: string | null | undefined): ExperienceLevel | undefined {
  const l = (level ?? "").toLowerCase();
  if (!l) return undefined;
  if (/intern/.test(l)) return "intern";
  if (/entry|junior|graduate|associate/.test(l)) return "junior";
  if (/principal|director|head|executive|vp/.test(l)) return "principal";
  if (/staff|lead/.test(l)) return "staff";
  if (/senior|sr\b/.test(l)) return "senior";
  if (/mid|intermediate/.test(l)) return "mid";
  return undefined;
}

export const DEFAULT_CONFIG: Partial<InterviewConfig> = {
  experience: "mid",
  type: "behavioral",
  difficulty: 2,
  adaptive: false,
  language: "en-US",
  speechRate: 1,
  durationMin: 20,
  questionCount: 6,
  focusSkills: [],
};

/** Avg thinking + transition overhead per question, used for duration estimates. */
export const PER_QUESTION_OVERHEAD_SEC = 45;

// ─── Home page recommendations ────────────────────────────────────────────────

export const RECOMMENDED_INTERVIEWS: {
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  minutes: number;
  skills: string[];
}[] = [
  { role: "Frontend Engineer", type: "technical", difficulty: 2, minutes: 20, skills: ["React", "TypeScript", "APIs"] },
  { role: "Backend Engineer", type: "system-design", difficulty: 3, minutes: 30, skills: ["System design", "SQL", "AWS"] },
  { role: "Product Manager", type: "product", difficulty: 2, minutes: 20, skills: ["Metrics", "Prioritization", "Roadmapping"] },
  { role: "Engineering Manager", type: "leadership", difficulty: 3, minutes: 25, skills: ["Team leadership", "Conflict resolution", "Hiring"] },
  { role: "Data Scientist", type: "behavioral", difficulty: 2, minutes: 15, skills: ["Communication", "Metrics", "Stakeholder management"] },
];
