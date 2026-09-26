import { toast } from "sonner";
import supabase from "@/lib/supabase";

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

export interface GoogleIntegrationStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

/** Whether Google Calendar is configured server-side and connected for this user. */
export async function getGoogleStatus(): Promise<GoogleIntegrationStatus> {
  const res = await fetch(`${API_BASE_URL}/integrations/google/status`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to check Google status");
  return (await res.json()).data as GoogleIntegrationStatus;
}

/** Starts the Google Calendar connect flow (returns the consent URL). */
export async function getGoogleConnectUrl(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/integrations/google/connect`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Google integration isn't configured");
  }
  return (await res.json()).data.url as string;
}

export type GoogleConnectResult = "connected" | "error" | "dismissed" | "blocked";

/**
 * Runs the Google Calendar consent flow in a centered popup so the employer
 * keeps their place (the schedule dialog stays open). The OAuth callback lands
 * on our `/oauth/google` route, which posts the result back to this window.
 * Falls back to full-page redirect if the popup is blocked.
 */
export async function connectGoogleWithPopup(): Promise<GoogleConnectResult> {
  const url = await getGoogleConnectUrl();

  const w = 500;
  const h = 640;
  const y = window.top!.outerHeight / 2 + window.top!.screenY - h / 2;
  const x = window.top!.outerWidth / 2 + window.top!.screenX - w / 2;
  const popup = window.open(
    url,
    "google-oauth",
    `popup=yes,width=${w},height=${h},top=${Math.max(0, y)},left=${Math.max(0, x)}`,
  );

  // Popup blocked — tell the user why we're about to leave the page, then fall
  // back to a same-tab redirect (the callback route forwards to
  // /employers/candidates?google=... where the success/error toast is shown).
  if (!popup) {
    toast.info("Allow popups to connect without leaving this page.", {
      description: "Taking you to Google to connect instead…",
    });
    window.setTimeout(() => {
      window.location.href = url;
    }, 1600);
    return "blocked";
  }

  return new Promise<GoogleConnectResult>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; status?: string } | null;
      if (!d || d.source !== "google-oauth") return;
      cleanup();
      resolve(d.status === "connected" ? "connected" : "error");
    };
    // If the user closes the popup without finishing, resolve as dismissed.
    const poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        resolve("dismissed");
      }
    }, 500);
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      try {
        popup.close();
      } catch {
        /* cross-origin while on Google's domain — ignore */
      }
    };
    window.addEventListener("message", onMessage);
  });
}

export async function disconnectGoogle(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/integrations/google/connection`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to disconnect Google");
}
