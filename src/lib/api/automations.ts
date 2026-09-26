import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/employers/automations${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  return (await res.json()).data as T;
}

export type ScheduledTaskType =
  | "STALE_APPLICATIONS"
  | "INTERVIEWS_WITHOUT_OUTCOME"
  | "WEEKLY_SUMMARY"
  | "SAVED_SEARCH_MATCHES";

export type TaskCadence = "DAILY" | "WEEKDAYS" | "WEEKLY";

export interface TaskTemplate {
  type: ScheduledTaskType;
  label: string;
  description: string;
  /** lucide icon name. */
  icon: string;
  cadence: TaskCadence;
  hourLocal: number;
  weekday: number | null;
  cadenceLabel: string;
  /** Several of these may run at once, each watching a different thing. */
  allowMultiple: boolean;
  /** Must be chosen before the task can be created. */
  requiresTarget: "shortlist" | null;
}

export interface ScheduledTask extends TaskTemplate {
  id: string;
  link: string;
  /** The saved search this one watches, for per-target kinds. */
  targetId: string | null;
  /** Null when the watched search has been deleted. */
  targetLabel: string | null;
  timezone: string;
  enabled: boolean;
  /** When false, a run that finds nothing stays silent. */
  notifyWhenEmpty: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  /** What the last run reported, verbatim. */
  lastSummary: string | null;
}

export interface TaskRunOutcome {
  count: number;
  title: string;
  message: string;
}

/**
 * The creator's zone, sent when a task is made.
 *
 * Without it every task runs at server time, which is nobody's 9am.
 */
export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const getTaskTemplates = () => req<TaskTemplate[]>("/templates");
export const listTasks = () => req<ScheduledTask[]>("");

export const createTask = (input: {
  type: ScheduledTaskType;
  cadence?: TaskCadence;
  hourLocal?: number;
  weekday?: number | null;
  notifyWhenEmpty?: boolean;
  /** Required when the template declares requiresTarget. */
  shortlistId?: string;
}) =>
  req<ScheduledTask>("", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      weekday: input.weekday ?? undefined,
      timezone: browserTimeZone(),
    }),
  });

export const updateTask = (
  id: string,
  patch: {
    cadence?: TaskCadence;
    hourLocal?: number;
    weekday?: number | null;
    enabled?: boolean;
    notifyWhenEmpty?: boolean;
  },
) =>
  req<ScheduledTask>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      weekday: patch.weekday ?? undefined,
      timezone: browserTimeZone(),
    }),
  });

export const deleteTask = (id: string) => req<{ removed: boolean }>(`/${id}`, { method: "DELETE" });

export const runTaskNow = (id: string) => req<TaskRunOutcome>(`/${id}/run`, { method: "POST" });
