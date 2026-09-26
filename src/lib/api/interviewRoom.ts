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

export interface InterviewRoom {
  /** Which side of the call this user is on. The employer seat initiates the offer. */
  seat: "employer" | "candidate";
  /** Display name of the other participant (company for candidates, name for employers). */
  peerName: string;
  /** Signalling channel name — an unguessable HMAC of the interview id. */
  channel: string;
  status: string;
  scheduledAt: string | null;
  roleTitle: string | null;
  medium: string;
  /** True only once the interview is confirmed. */
  canJoin: boolean;
}

export async function getInterviewRoom(id: string): Promise<InterviewRoom> {
  const res = await fetch(`${API_BASE_URL}/interviews/${encodeURIComponent(id)}/room`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Interview not found");
    if (res.status === 403) throw new Error("You are not a participant in this interview");
    throw new Error("Couldn't open the interview room");
  }
  return (await res.json()).data as InterviewRoom;
}
