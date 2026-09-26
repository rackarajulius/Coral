import supabase from "@/lib/supabase";
import type { Candidate, Stage, TimelineEvent } from "@/data/employer/Candidates/types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

interface BackendApplicant {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  resumeUrl: string | null;
  job: { id: string; title: string };
  matchScore: number | null;
  matchedSkills: string[];
  applicant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    currentTitle: string | null;
    currentCompany: string | null;
    location: string;
    skills: string[];
    summary: string | null;
    experiences: { title: string; company: string; startDate: string; endDate: string | null; current: boolean }[];
    educations: { institution: string; degree: string; endDate: string | null }[];
  };
}

/**
 * Backend ApplicationStatus → board stage.
 *
 * Used by the older applicants-only endpoint. The merged board gets its stage
 * label from the server, which derives it from the same shared ladder — see
 * @/data/employer/pipelineLadder and backend/src/common/pipeline-stage.ts.
 * **Do not add a stage here without adding it there.**
 */
const STAGE_MAP: Record<string, Stage> = {
  pending: "Applied",
  reviewing: "Screening",
  shortlisted: "Screening",
  interviewing: "Interview",
  offered: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

/**
 * Board stage → backend ApplicationStatus, for persisting an applicant's move.
 *
 * Sourced and Contacted map to nothing: they describe an approach made before
 * any application existed, and there is no status meaning "un-applied".
 * Dragging an applicant back to one of those is refused rather than invented,
 * because the candidate would see the change in their own tracker. Withdrawn is
 * theirs to declare, never the employer's.
 */
export const STATUS_FOR_STAGE: Record<Stage, string | null> = {
  Sourced: null,
  Contacted: null,
  Applied: "pending",
  Screening: "reviewing",
  Interview: "interviewing",
  Offer: "offered",
  Hired: "hired",
  Rejected: "rejected",
  Withdrawn: null,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Application received",
  reviewing: "Moved to screening",
  shortlisted: "Shortlisted",
  interviewing: "Moved to interview",
  offered: "Offer extended",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Candidate withdrew",
};

function period(start: string, end: string | null, current: boolean): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${fmt(start)} – ${current || !end ? "Present" : fmt(end)}`;
}

function toCandidate(b: BackendApplicant): Candidate {
  const appliedDate = b.appliedAt.slice(0, 10);
  const matched = new Set(b.matchedSkills.map((s) => s.toLowerCase()));

  // Honest timeline: application received + latest status change (real timestamps only).
  const timeline: TimelineEvent[] = [
    { id: `${b.id}-applied`, type: "applied", text: `Applied for ${b.job.title}`, at: appliedDate },
  ];
  if (b.status !== "pending" && b.updatedAt.slice(0, 10) >= appliedDate) {
    timeline.push({
      id: `${b.id}-status`,
      type: "stage",
      text: STATUS_LABELS[b.status] ?? b.status,
      at: b.updatedAt.slice(0, 10),
    });
  }

  return {
    id: b.id, // application id — used to persist stage moves
    applicantId: b.applicant.id,
    jobId: b.job.id,
    name: b.applicant.name,
    initials: b.applicant.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    email: b.applicant.email,
    phone: b.applicant.phone ?? "",
    currentRole: b.applicant.currentTitle ?? "",
    currentCompany: b.applicant.currentCompany ?? "",
    role: b.job.title,
    location: b.applicant.location,
    stage: STAGE_MAP[b.status] ?? "Applied",
    matchScore: b.matchScore,
    appliedDate,
    status: b.status === "withdrawn" ? "Withdrawn" : "Active",
    tags: [],
    skills: b.applicant.skills.map((name) => ({
      name,
      ...(matched.has(name.toLowerCase()) ? { match: 100 } : {}),
    })),
    strengths: [], // no AI assessment yet — never fabricated
    concerns: [],
    summary: b.applicant.summary ?? "",
    experience: b.applicant.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      period: period(e.startDate, e.endDate, e.current),
    })),
    education: b.applicant.educations.map((e) => ({
      school: e.institution,
      degree: e.degree,
      year: e.endDate ? String(new Date(e.endDate).getFullYear()) : "",
    })),
    timeline,
    resumeUrl: b.resumeUrl ?? undefined,
  };
}

export interface ApplicantQuery {
  page?: number;
  limit?: number;
  jobId?: string;
  stage?: string;
  q?: string;
  /** "match" sorts by stored skill overlap; "recent" by application date. */
  sort?: "match" | "recent";
  includeRejected?: boolean;
}

export interface ApplicantPage {
  candidates: Candidate[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Real applicants across the company's jobs, mapped for the ATS board.
 *
 * Filtering and sorting are the server's job. Doing them in the browser meant
 * fetching the 200 most recent applications and ranking those, so "top
 * applicants" silently became "top of the newest 200" for any employer past
 * that — and match score could not be ordered by at all, because it was
 * computed per request rather than stored.
 */
export async function getMyJobApplicants(query: ApplicantQuery = {}): Promise<ApplicantPage> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.jobId) params.set("jobId", query.jobId);
  if (query.stage) params.set("stage", query.stage);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.sort) params.set("sort", query.sort);
  if (query.includeRejected) params.set("includeRejected", "true");

  const qs = params.toString();
  const res = await fetch(`${API_BASE_URL}/applications/for-my-jobs${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load applicants");
  const json = await res.json();
  const meta = json.meta ?? {};
  return {
    candidates: ((json.data ?? []) as BackendApplicant[]).map(toCandidate),
    page: meta.page ?? 1,
    limit: meta.limit ?? 50,
    total: meta.total ?? (json.data?.length ?? 0),
    totalPages: meta.totalPages ?? 1,
  };
}

/** A row of the merged board, as the server sends it. */
interface BackendPipelineRow {
  id: string;
  source: "applied" | "sourced";
  applicantId: string;
  jobId?: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  currentRole: string;
  currentCompany: string;
  role: string;
  location: string;
  stage: Stage;
  matchScore: number | null;
  appliedDate: string;
  status: "Active" | "Withdrawn";
  skills: { name: string; match?: number }[];
  summary: string;
  resumeUrl?: string;
  /** The company's tags on this person. Absent from older servers. */
  tags?: string[];
}

export interface PipelineQuery {
  page?: number;
  limit?: number;
  q?: string;
  sort?: "match" | "recent";
  /** Board stage labels; converted to the server's ids here. */
  stages?: Stage[];
  jobIds?: string[];
  source?: "applied" | "sourced";
  includeRejected?: boolean;
  /** Tag labels; a candidate matches if they carry any of them. */
  tags?: string[];
}

/**
 * The merged candidate board: applicants and sourced candidates in one list.
 *
 * Replaces `getMyJobApplicants` for this page. Filtering and sorting stay on
 * the server for the same reason they always did — narrowing in the browser
 * would rank the current page rather than the whole pipeline — and that is
 * doubly true now that the list has two sources in it.
 */
export async function getPipelineBoard(query: PipelineQuery = {}): Promise<{
  candidates: Candidate[];
  page: number;
  total: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.sort) params.set("sort", query.sort);
  // Labels are what this board renders; the server speaks the enum.
  if (query.stages?.length) params.set("stage", query.stages.map(stageToId).join(","));
  if (query.jobIds?.length) params.set("jobId", query.jobIds.join(","));
  if (query.source) params.set("source", query.source);
  if (query.includeRejected) params.set("includeRejected", "true");
  if (query.tags?.length) params.set("tags", query.tags.join(","));

  const res = await fetch(`${API_BASE_URL}/applications/pipeline-board?${params}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load the candidate board");
  const json = await res.json();
  return {
    candidates: ((json.candidates ?? []) as BackendPipelineRow[]).map(toPipelineCandidate),
    page: json.page ?? 1,
    total: json.total ?? 0,
    totalPages: json.totalPages ?? 1,
  };
}

/** "Interview" → "INTERVIEW". The board renders labels; the server stores ids. */
const stageToId = (stage: Stage): string => stage.toUpperCase();

function toPipelineCandidate(r: BackendPipelineRow): Candidate {
  return {
    ...r,
    // The company's own tags, as the server sent them.
    tags: r.tags ?? [],
    // Not sent by the server, and not invented here. The drawer has honest
    // empty states for all of these; filling them with guesses is how a board
    // starts asserting things nobody measured.
    strengths: [],
    concerns: [],
    experience: [],
    education: [],
    timeline: [
      {
        id: `${r.id}-entered`,
        type: r.source === "sourced" ? "note" : "applied",
        text: r.source === "sourced" ? `Sourced for ${r.role}` : `Applied for ${r.role}`,
        at: r.appliedDate,
      },
    ],
  };
}

/**
 * Persists a stage move.
 *
 * Routed by where the row came from: an applicant's stage is their
 * application's status, while a sourced candidate's lives on their shortlist
 * card. The server keeps the two in step when they are linked, so a move made
 * from either board reaches both.
 */
export async function updateApplicantStage(applicationId: string, stage: Stage): Promise<void> {
  const status = STATUS_FOR_STAGE[stage];
  if (!status) {
    // Nothing to write, and nothing worth pretending. The caller keeps the row
    // where it was rather than showing a move the server never accepted.
    throw new Error(`An applicant cannot be moved to ${stage}.`);
  }
  const res = await fetch(`${API_BASE_URL}/applications/${encodeURIComponent(applicationId)}/status`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update stage");
}
