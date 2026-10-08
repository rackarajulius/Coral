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

/** Self-onboarding: lets a PENDING_ONBOARDING user pick their account role. */
export async function updateUserRole(role: "EMPLOYER" | "JOB_SEEKER" | "FREELANCER"): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/role`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Failed to update role" }));
    throw new Error(body.message || "Failed to update role");
  }
}

/** Permanently closes only the authenticated jobseeker's own account. */
export interface AccountClosureResult {
  cleanupPending: boolean;
  message?: string;
}

export async function deleteMyAccount(): Promise<AccountClosureResult> {
  const res = await fetch(`${API_BASE_URL}/auth/account`, {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ confirmation: "CLOSE" }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.code === "ACCOUNT_CLOSED_CLEANUP_PENDING" && body.accountClosed === true) {
    return { cleanupPending: true, message: body.message };
  }
  if (!res.ok || body.success !== true) {
    const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
    throw new Error(message || "Could not close your account. Please try again.");
  }
  return { cleanupPending: false };
}
