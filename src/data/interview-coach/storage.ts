// Versioned localStorage helpers — every value is wrapped in { v, data } so a
// future schema change can bump the version and safely discard stale payloads.

export const STORAGE_KEYS = {
  history: "ic:history:v1",
  activeSession: "ic:active-session:v1",
} as const;

const VERSION = 1;

export function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: number; data: T };
    if (parsed?.v !== VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: VERSION, data }));
  } catch {
    // Quota exceeded or storage disabled — the feature degrades to in-memory.
  }
}

export function clearStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
