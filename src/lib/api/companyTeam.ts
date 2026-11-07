import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/employers/company/${path}`, {
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

export type CompanyRole =
  | "OWNER"
  | "ADMIN"
  | "RECRUITER"
  | "HIRING_MANAGER"
  | "INTERVIEWER"
  | "VIEWER";

/** PENDING is someone who asked to join on a matching domain — no access yet. */
export type MemberStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REMOVED";

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: CompanyRole;
  status: MemberStatus;
  joinedAt: string | null;
  lastActiveAt: string | null;
  isSelf: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: CompanyRole;
  expiresAt: string;
  expired: boolean;
  createdAt: string;
}

export interface TeamResponse {
  companyId: string;
  companyName: string;
  myRole: CompanyRole;
  canManage: boolean;
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export interface RoleReference {
  role: CompanyRole;
  label: string;
  description: string;
  capabilities: string[];
  /** What this role does NOT yet restrict. Null when there's nothing to admit. */
  limitation: string | null;
}

/** The signed-in user's own seat — what the server will actually let them do. */
export interface MySeat {
  /** Null for a platform admin, who is not a company member at all. */
  role: CompanyRole | null;
  status: string | null;
  /**
   * Their own company, so the browser can join the right board channel.
   * Null for a platform admin or a sole operator with no company.
   */
  companyId: string | null;
  capabilities: string[];
}

export const getTeam = () => req<TeamResponse>("members");
export const getRoles = () => req<RoleReference[]>("roles");
export const getMySeat = () => req<MySeat>("me");

export const inviteMember = (email: string, role: CompanyRole) =>
  req<TeamInvitation>("invitations", { method: "POST", body: JSON.stringify({ email, role }) });

export const revokeInvitation = (id: string) =>
  req<{ revoked: boolean }>(`invitations/${id}`, { method: "DELETE" });

export const approveMember = (id: string, role?: CompanyRole) =>
  req<TeamMember>(`members/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(role ? { role } : {}),
  });

export const setMemberRole = (id: string, role: CompanyRole) =>
  req<TeamMember>(`members/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });

export const suspendMember = (id: string) =>
  req<TeamMember>(`members/${id}/suspend`, { method: "POST" });

export const reactivateMember = (id: string) =>
  req<TeamMember>(`members/${id}/reactivate`, { method: "POST" });

export const removeMember = (id: string) =>
  req<TeamMember>(`members/${id}`, { method: "DELETE" });

export interface JoinLink {
  id: string;
  url: string;
  role: CompanyRole;
  domainLocked: boolean;
  /** Null when the company has no work domain — the lock then can't engage. */
  domain: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string;
  expired: boolean;
  exhausted: boolean;
}

export const getJoinLink = () => req<JoinLink | null>("join-link");

export const regenerateJoinLink = (input: {
  role?: CompanyRole;
  domainLocked?: boolean;
  expiresInDays?: number;
  maxUses?: number | null;
}) =>
  req<JoinLink>("join-link", {
    method: "POST",
    body: JSON.stringify({ ...input, maxUses: input.maxUses ?? undefined }),
  });

export const revokeJoinLink = () => req<{ revoked: boolean }>("join-link", { method: "DELETE" });

/** Roles a link may grant. Owner and Admin are deliberately excluded. */
export const LINK_ROLES: CompanyRole[] = [
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "VIEWER",
];

export const ROLE_LABELS: Record<CompanyRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring manager",
  INTERVIEWER: "Interviewer",
  VIEWER: "Viewer",
};

export const ASSIGNABLE_ROLES: CompanyRole[] = [
  "ADMIN",
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "VIEWER",
];

/* --------------------------------- domain --------------------------------- */

/** How a domain was shown to be the company's. */
export type DomainMethod = "sign-in" | "dns" | "email";

/** The company's domain, and any proof of one under way. */
export interface CompanyDomainStatus {
  /** Set only once proven. Null: the company is unclaimed. */
  domain: string | null;
  verifiedAt: string | null;
  method: DomainMethod | null;
  /** Owners and admins prove and remove; everyone else can only look. */
  canManage: boolean;
  /** The domain of their own confirmed sign-in email: claimable in one click. */
  signInDomain: string | null;
  /** A starting point for the box, from the website or their email. Not a claim. */
  suggestion: string | null;
  /** Whether Coral can send email right now; the code route needs it. */
  emailAvailable: boolean;
  pending:
    | { method: "dns"; domain: string; expiresAt: string; record: { type: "TXT"; host: string; value: string } }
    | { method: "email"; domain: string; expiresAt: string; sentTo: string }
    | null;
}

export const getCompanyDomain = () => req<CompanyDomainStatus>("domain");
export const claimDomainBySignIn = (domain: string) =>
  req<CompanyDomainStatus>("domain/sign-in", { method: "POST", body: JSON.stringify({ domain }) });
export const startDomainDns = (domain: string) =>
  req<CompanyDomainStatus>("domain/dns", { method: "POST", body: JSON.stringify({ domain }) });
export const checkDomainDns = () =>
  req<CompanyDomainStatus & { found: boolean }>("domain/dns/check", { method: "POST" });
export const startDomainEmail = (email: string) =>
  req<CompanyDomainStatus>("domain/email", { method: "POST", body: JSON.stringify({ email }) });
export const confirmDomainEmail = (code: string) =>
  req<CompanyDomainStatus>("domain/email/confirm", { method: "POST", body: JSON.stringify({ code }) });
export const releaseCompanyDomain = () => req<CompanyDomainStatus>("domain", { method: "DELETE" });

/* ── Taking the company page down and bringing it back (owner only) ── */

export interface CompanyPageStatus {
  companyName: string;
  /** ISO time it was deactivated; null while the page is live. */
  deactivatedAt: string | null;
  /** ISO time the page will be deleted for good; null unless the owner asked. */
  deletesAt: string | null;
  /** Only the owner may deactivate or reactivate, as LinkedIn keeps it to super admins. */
  canManage: boolean;
}

export const getCompanyPageStatus = () => req<CompanyPageStatus>("page");

export const deactivateCompanyPage = () =>
  req<CompanyPageStatus & { jobsClosed: number }>("page/deactivate", { method: "POST" });

export const reactivateCompanyPage = () =>
  req<CompanyPageStatus>("page/reactivate", { method: "POST" });

/** Delete the deactivated page for good, 30 days from now. Confirmed by typing its name. */
export const scheduleCompanyDeletion = (confirmName: string) =>
  req<CompanyPageStatus>("page/delete", { method: "POST", body: JSON.stringify({ confirmName }) });

export const cancelCompanyDeletion = () =>
  req<CompanyPageStatus>("page/delete/cancel", { method: "POST" });
