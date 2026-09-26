import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}${path}`, {
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

/**
 * `unavailable` is not the same as `coming_soon` — it means the integration is
 * built but this deployment has no credentials for it, which an operator can
 * fix today. Telling someone to "come back later" for that would be wrong.
 */
export type IntegrationStatus = "connected" | "available" | "coming_soon" | "unavailable";

export interface IntegrationEntry {
  key: string;
  name: string;
  category: string;
  description: string;
  /** lucide icon name. */
  icon: string;
  status: IntegrationStatus;
  detail: string | null;
}

/** Generated server-side from what is actually implemented. */
export const listIntegrations = () => req<IntegrationEntry[]>("/employers/integrations");

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  /** Last delivery outcome, so a silently broken endpoint is visible. */
  lastStatus: number | null;
  lastError: string | null;
  lastAttemptAt: string | null;
  failureCount: number;
  createdAt: string;
}

/** The signing secret comes back once, on create, and is never readable again. */
export interface CreatedWebhook extends Webhook {
  secret: string;
}

export const listWebhooks = () => req<Webhook[]>("/employers/webhooks");

export const getWebhookEvents = () =>
  req<{ events: string[] }>("/employers/webhooks/events").then((r) => r.events);

export const createWebhook = (url: string, events: string[]) =>
  req<CreatedWebhook>("/employers/webhooks", {
    method: "POST",
    body: JSON.stringify({ url, events }),
  });

export const testWebhook = (id: string) =>
  req<{ ok?: boolean; status?: number; error?: string }>(`/employers/webhooks/${id}/test`, {
    method: "POST",
  });

export const deleteWebhook = (id: string) =>
  req<{ removed: boolean }>(`/employers/webhooks/${id}`, { method: "DELETE" });

/* ---------------------------------- Slack --------------------------------- */

export interface SlackStatus {
  /** False when this deployment has no Slack app configured. */
  configured: boolean;
  connected: boolean;
  channel: string | null;
  team: string | null;
  /** Last delivery failure, so a revoked webhook is visible rather than silent. */
  lastError: string | null;
}

export const getSlackStatus = () => req<SlackStatus>("/integrations/slack/status");

/** Returns Slack's install URL; the caller sends the browser there. */
export const getSlackInstallUrl = () =>
  req<{ url: string }>("/integrations/slack/connect", { method: "POST" }).then((r) => r.url);

export const testSlack = () =>
  req<{ ok: boolean; error?: string }>("/integrations/slack/test", { method: "POST" });

export const disconnectSlack = () =>
  req<{ disconnected: boolean }>("/integrations/slack", { method: "DELETE" });

/* ------------------------------- Microsoft -------------------------------- */

export interface MicrosoftStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

export const getMicrosoftStatus = () => req<MicrosoftStatus>("/integrations/microsoft/status");

/** Returns the consent URL; the caller sends the browser there. */
export const getMicrosoftConsentUrl = () =>
  req<{ url: string }>("/integrations/microsoft/connect", { method: "POST" }).then((r) => r.url);

export const disconnectMicrosoft = () =>
  req<{ disconnected: boolean }>("/integrations/microsoft", { method: "DELETE" });

/* ---------------------------------- Zoom ---------------------------------- */

export interface ZoomStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

export const getZoomStatus = () => req<ZoomStatus>("/integrations/zoom/status");

export const getZoomConsentUrl = () =>
  req<{ url: string }>("/integrations/zoom/connect", { method: "POST" }).then((r) => r.url);

export const disconnectZoom = () =>
  req<{ disconnected: boolean }>("/integrations/zoom", { method: "DELETE" });
