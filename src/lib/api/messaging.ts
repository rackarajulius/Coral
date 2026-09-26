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

export interface ApiConversation {
  id: string;
  name: string;
  initials: string;
  role: string;
  /** The other participant, for actions about the person not the thread. */
  peerId: string;
  /** True when the viewer is the employer, so the peer is a candidate. */
  viewerIsEmployer: boolean;
  lastMsg: string;
  time: string;
  unread: number;
  online: boolean;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  from: "me" | "them";
  text: string;
  time: string;
  date: string;
  status: "sending" | "sent" | "delivered" | "seen" | "failed";
  attachments?: { name: string; type: string; size: string; url?: string }[];
}

export async function getConversations(): Promise<ApiConversation[]> {
  const res = await fetch(`${API_BASE_URL}/messaging/conversations`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load conversations");
  return ((await res.json()).data ?? []) as ApiConversation[];
}

export async function getMessages(conversationId: string, before?: string): Promise<ApiMessage[]> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/messages${qs}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return ((await res.json()).data ?? []) as ApiMessage[];
}

/** Employer opens (or reopens) a thread with a candidate who applied to their job. */
export async function startConversation(candidateId: string, jobId?: string): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE_URL}/messaging/conversations`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ candidateId, jobId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't start the conversation");
  }
  return (await res.json()).data as { id: string };
}

export interface UploadedAttachment {
  name: string;
  type: string;
  size: string;
  path: string;
}

export async function sendMessage(
  conversationId: string,
  body: string,
  attachments?: UploadedAttachment[],
): Promise<ApiMessage> {
  const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ body, attachments }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || "Failed to send message");
  }
  return (await res.json()).data as ApiMessage;
}

/** Uploads one file to a conversation; returns metadata to attach when sending. */
export async function uploadMessageAttachment(conversationId: string, file: File): Promise<UploadedAttachment> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/attachments`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || "Failed to upload attachment");
  }
  return (await res.json()).data as UploadedAttachment;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/read`, {
    method: "POST",
    headers: await authHeaders(),
  });
}

/** AI composer assist: draft/rewrite a reply or summarize the thread. */
export async function messagingAssist(
  conversationId: string,
  input: { action: "interview" | "rejection" | "followup" | "reply" | "rewrite" | "summary"; tone?: string; baseDraft?: string },
): Promise<{ text?: string; summary?: string }> {
  const res = await fetch(`${API_BASE_URL}/messaging/conversations/${conversationId}/assist`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || "The assistant couldn't respond");
  }
  return (await res.json()).data as { text?: string; summary?: string };
}
