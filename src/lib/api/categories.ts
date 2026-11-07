const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/** A kind of work on Coral, as the server lists it. */
export interface WorkCategory {
  value: string;
  label: string;
}

/**
 * The kinds of work professionals offer, from the server: the only list.
 * Provider profiles, services and project briefs all use it.
 */
export async function getWorkCategories(signal?: AbortSignal): Promise<WorkCategory[]> {
  const res = await fetch(`${API_BASE_URL}/freelancers/categories`, { signal });
  if (!res.ok) throw new Error("Could not load the categories");
  const json = await res.json();
  return (json.data ?? []) as WorkCategory[];
}
