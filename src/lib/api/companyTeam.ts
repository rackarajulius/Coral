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
