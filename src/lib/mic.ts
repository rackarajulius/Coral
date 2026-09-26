import { toast } from "sonner";

export type MicPermissionState = "granted" | "prompt" | "denied" | "unknown";

/**
 * Best-effort microphone permission state via the Permissions API.
 * Returns 'unknown' where it's unsupported (e.g. some Firefox/Safari versions).
 */
export async function getMicPermissionState(): Promise<MicPermissionState> {
  try {
    const perms = navigator.permissions;
    if (!perms?.query) return "unknown";
    const status = await perms.query({ name: "microphone" as PermissionName });
    return status.state as MicPermissionState;
  } catch {
    return "unknown";
  }
}

/**
 * Prepares the mic UX before starting voice capture:
 * - 'denied' → show a "blocked, here's how to fix" hint and tell the caller to stop.
 * - 'prompt' → warn that the browser permission popup is coming, then proceed.
 * - else     → proceed silently (already granted / unknown).
 *
 * Returns true if the caller should go ahead and start the mic. Note: only the
 * browser can show the actual OS/permission dialog — this just frames it.
 */
export async function prepareMic(reason = "voice search"): Promise<boolean> {
  const state = await getMicPermissionState();

  if (state === "denied") {
    toast.error("Microphone is blocked", {
      description:
        "Click the mic or lock icon in your address bar, allow the microphone, then try again.",
    });
    return false;
  }

  if (state === "prompt") {
    toast.info("Allow your microphone", {
      description: `We use it for ${reason} — you'll see a browser permission popup next.`,
    });
  }

  return true;
}
