import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/** The job or service a project was done in. A service is named only while it is public. */
export type ProjectAssociation =
  | { kind: "job"; title: string; company: string }
  | { kind: "service"; id: string; title: string };

/** A project as visitors see it. */
export interface PublicProject {
  id: string;
  title: string;
  description: string;
  /** "2024-09"; null when not given. */
  startMonth: string | null;
  endMonth: string | null;
  current: boolean;
  skills: string[];
  link: string | null;
  mediaUrls: string[];
  associatedWith: ProjectAssociation | null;
}

/** One of your own, with what the editor needs. */
export interface OwnProject extends PublicProject {
  projectUrl: string | null;
  experienceId: string | null;
  serviceListingId: string | null;
}

/** What a save sends. On an edit, null clears a field. */
export interface ProjectInput {
  title: string;
  description: string;
  startMonth: string | null;
  endMonth: string | null;
  current: boolean;
  skills: string[];
  projectUrl: string | null;
  mediaUrls: string[];
  experienceId: string | null;
  serviceListingId: string | null;
}

export const MY_PROJECTS_KEY = ["job-seekers", "me", "projects"] as const;

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/job-seekers/me/projects${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The server says what was wrong ("A project can't end before it starts").
    const message = (json as { message?: string | string[] }).message;
    throw new Error((Array.isArray(message) ? message[0] : message) || "Couldn't save the project");
  }
  return (json as { data?: T }).data as T;
}

export const listMyProjects = () => send<OwnProject[]>("GET", "");
export const createProject = (input: ProjectInput) => send<OwnProject>("POST", "", input);
export const updateProject = (id: string, input: ProjectInput) => send<OwnProject>("PATCH", `/${encodeURIComponent(id)}`, input);
export const deleteProject = (id: string) => send<void>("DELETE", `/${encodeURIComponent(id)}`);

/** "2024-09" → "Sep 2024". */
export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "May 2022 – Present", "Sep 2024", or null when no dates were given. */
export function projectPeriod(project: Pick<PublicProject, "startMonth" | "endMonth" | "current">): string | null {
  const start = project.startMonth ? monthLabel(project.startMonth) : null;
  const end = project.current ? "Present" : project.endMonth ? monthLabel(project.endMonth) : null;
  if (start && end) return start === end ? start : `${start} – ${end}`;
  return start ?? (project.current ? "Ongoing" : end);
}
