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

async function send(path: string, method: "PATCH" | "DELETE"): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Action failed");
  }
}

/** Admin employer actions. `id` is the employer's User UUID. */
export const approveEmployer = (id: string) => send(`/admin/employers/${id}/approve`, "PATCH");
export const suspendEmployer = (id: string) => send(`/admin/employers/${id}/suspend`, "PATCH");
export const banEmployer = (id: string) => send(`/admin/employers/${id}/ban`, "PATCH");
export const activateEmployer = (id: string) => send(`/admin/employers/${id}/activate`, "PATCH");
export const deleteEmployer = (id: string) => send(`/admin/employers/${id}`, "DELETE");
