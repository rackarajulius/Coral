// ─── Shared Types ────────────────────────────────────────────────────────────

export type Phase = "prompt" | "generating" | "workspace";
export type WorkspaceTab = "candidates" | "pipeline" | "job-description";

export type MessageBlock =
  | { type: "heading"; content: string }
  | { type: "text"; content: string }
  | { type: "code"; filename?: string; language?: string; content: string }
  | { type: "meta"; label: string; value: string }
  | { type: "bullet-list"; items: string[] }
  | {
      type: "candidate-mini";
      name: string;
      initials: string;
      match: number;
      company: string;
      role: string;
      snippet: string;
    };

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Structured sections for scanable AI responses. */
  blocks?: MessageBlock[];
}

/** Progressive workspace reveal steps (set by timed effect in useHiringAssistant). */
export const REVEAL = {
  ROLE_SUMMARY: 1,
  REQUIRED_QUALS: 2,
  NICE_TO_HAVE: 3,
  CANDIDATES: 4,
  COMPLETE: 5,
} as const;

export const REVEAL_TIMINGS_MS = [400, 1100, 1900, 2700, 3500] as const;

export const FOLLOW_UP_RESPONSE_MS = 900;

export function createMessage(
  role: Message["role"],
  text: string,
  blocks?: MessageBlock[]
): Message {
  return { id: crypto.randomUUID(), role, text, blocks };
}

/** Short heading derived from the user's hiring prompt. */
export function promptToRoleTitle(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "Hiring workspace";

  const line = trimmed.split(/\n/)[0].trim();
  const capped = line.length > 60 ? `${line.slice(0, 57)}…` : line;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

export interface Qualification {
  text: string;
  confidence: number;
}

export interface Candidate {
  /** userId — present on real sourced candidates; enables outreach/actions. */
  id?: string;
  name: string;
  role: string;
  company: string;
  location: string;
  match: number;
  reason: string;
  initials: string;
  skills: string[];
  yearsExp: number;
  education: string;
  connection: "1st" | "2nd" | "3rd+";
  openToWork: boolean;
  lastActive: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
}

export interface PipelineCandidate extends Candidate {
  stageId: string;
  addedAt: string;
  /**
   * The application this sourced card is the same person as, if any.
   *
   * Sourcing and applications used to be separate records with separate
   * stages, so someone you found and then received an application from showed
   * up twice and the two cards could disagree. When this is set they are one
   * candidate, and the card says so and links across.
   */
  applicationId?: string | null;
}

export interface SuggestionChip {
  icon: React.ElementType;
  label: string;
}

// ─── Role & Seniority taxonomy ────────────────────────────────────────────────

export type RoleType =
  | "frontend"
  | "backend"
  | "fullstack"
  | "design"
  | "sales"
  | "marketing"
  | "data"
  | "product"
  | "management"
  | "general";

export type Seniority =
  | "junior"
  | "mid"
  | "senior"
  | "staff"
  | "lead"
  | "principal"
  | "executive";

/** Structured output from parsing a free-text hiring prompt. */
export interface ParsedIntent {
  raw: string;
  roleType: RoleType;
  seniority: Seniority;
  /** Domain/tech keywords extracted from the prompt (lowercased). */
  keywords: string[];
  remote: boolean;
  location: string | null;
}

/** Shape of a generated or template job description. */
export interface JobDescriptionContent {
  aboutRole: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  compensation: string;
  benefits: string[];
}
