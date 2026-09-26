import supabase from "@/lib/supabase";
import {
  JobAlert,
  AlertEmploymentType,
  AlertExperience,
  AlertFrequency,
} from "@/data/jobactivity/job-activity-mock";

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

interface BackendJobAlert {
  id: string;
  name: string;
  keywords: string[];
  location: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  salaryMin: number | null;
  frequency: string;
  isActive: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The editable fields the UI collects, in frontend vocabulary. */
export interface AlertInput {
  title: string;
  keywords: string[];
  location: string;
  type: AlertEmploymentType;
  experience: AlertExperience;
  salary: string; // free text e.g. "$150k–$200k"
  frequency: AlertFrequency;
  active?: boolean;
}

/* ------------------------------- mappers ------------------------------- */

function mapType(t: string | null): AlertEmploymentType {
  switch ((t ?? "").toLowerCase()) {
    case "part-time":
      return "Part-time";
    case "contract":
    case "freelance":
      return "Contract";
    case "internship":
      return "Internship";
    default:
      return "Full-time";
  }
}

function mapExperience(x: string | null): AlertExperience {
  switch ((x ?? "").toLowerCase()) {
    case "entry":
      return "Entry";
    case "senior":
      return "Senior";
    case "lead":
      return "Lead";
    default:
      return "Mid";
  }
}

function mapFrequency(f: string): AlertFrequency {
  switch ((f ?? "").toLowerCase()) {
    case "instant":
      return "Instant";
    case "weekly":
      return "Weekly";
    default:
      return "Daily";
  }
}

/** Parse a free-text salary into an integer minimum (honest best-effort). */
function parseSalaryToMin(salary: string): number | undefined {
  const m = salary.match(/(\d[\d,.]*)\s*([km])?/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "k") return Math.round(n * 1_000);
  if (unit === "m") return Math.round(n * 1_000_000);
  return Math.round(n);
}

/** Format a stored minimum back into a display string (min-only, so "+"). */
function formatSalaryFromMin(min: number | null): string {
  if (min === null || min === undefined) return "";
  if (min >= 1000) return `$${Math.round(min / 1000)}k+`;
  return `$${min}+`;
}

function toJobAlert(a: BackendJobAlert): JobAlert {
  return {
    id: a.id,
    title: a.name,
    keywords: a.keywords ?? [],
    location: a.location ?? "",
    type: mapType(a.jobType),
    experience: mapExperience(a.experienceLevel),
    salary: formatSalaryFromMin(a.salaryMin),
    frequency: mapFrequency(a.frequency),
    active: a.isActive,
    // remote / channels / newMatches / matches are not stored server-side — omit.
  };
}

/** Frontend input → backend payload. */
function toPayload(input: Partial<AlertInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.name = input.title.trim();
  if (input.keywords !== undefined) body.keywords = input.keywords;
  if (input.location !== undefined) body.location = input.location.trim();
  if (input.type !== undefined) body.jobType = input.type;
  if (input.experience !== undefined) body.experienceLevel = input.experience;
  if (input.salary !== undefined) {
    const min = parseSalaryToMin(input.salary);
    if (min !== undefined) body.salaryMin = min;
  }
  if (input.frequency !== undefined) body.frequency = input.frequency.toLowerCase();
  if (input.active !== undefined) body.isActive = input.active;
  return body;
}

/* -------------------------------- api ---------------------------------- */

export async function getMyAlerts(): Promise<JobAlert[]> {
  const res = await fetch(`${API_BASE_URL}/job-alerts?limit=100`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load job alerts");
  const json = await res.json();
  return ((json.data ?? []) as BackendJobAlert[]).map(toJobAlert);
}

export async function createAlert(input: AlertInput): Promise<JobAlert> {
  const res = await fetch(`${API_BASE_URL}/job-alerts`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(toPayload(input)),
  });
  if (!res.ok) throw new Error("Failed to create alert");
  const json = await res.json();
  return toJobAlert(json.data as BackendJobAlert);
}

export async function updateAlert(id: string, input: Partial<AlertInput>): Promise<JobAlert> {
  const res = await fetch(`${API_BASE_URL}/job-alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(toPayload(input)),
  });
  if (!res.ok) throw new Error("Failed to update alert");
  const json = await res.json();
  return toJobAlert(json.data as BackendJobAlert);
}

export async function deleteAlert(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/job-alerts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete alert");
}
