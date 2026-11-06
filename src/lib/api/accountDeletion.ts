import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/**
 * What deleting an account did to a company it was part of. Accounts no
 * longer take their company's page with them (backend company-departure.ts).
 */
export interface CompanyDeparture {
  companyName: string;
  /** handed_over: a teammate now owns the page and their jobs. deactivated: nobody else was left. */
  outcome: "handed_over" | "deactivated";
  successorName?: string;
}

/** An admin deleting an account, reporting what happened to its companies. */
export async function deleteAccountAsAdmin(path: string): Promise<CompanyDeparture[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || "Action failed");
  return ((body as { data?: { companies?: CompanyDeparture[] } }).data?.companies ?? []) as CompanyDeparture[];
}

/** One line for the confirmation toast, or nothing when they were in no company. */
export function departureNote(companies: CompanyDeparture[]): string | undefined {
  if (companies.length === 0) return undefined;
  return companies
    .map((c) =>
      c.outcome === "handed_over"
        ? `${c.companyName}'s page and jobs passed to ${c.successorName ?? "a teammate"}.`
        : `${c.companyName} was deactivated — nobody else was on its team.`,
    )
    .join(" ");
}

/** What the confirmation says will happen to any company they're part of. */
export const COMPANY_DELETION_RULE =
  "If they're on a company team, its page, ownership and their jobs pass to another member (an owner or admin first). If they're the only member, the company page is deactivated.";
