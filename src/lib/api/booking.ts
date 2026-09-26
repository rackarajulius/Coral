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

export interface AvailabilitySlot {
  id: string;
  role: string | null;
  startAt: string;
  durationMins: number;
  medium: string;
  status: "open" | "booked" | "cancelled";
  interviewId: string | null;
}

export interface MyAvailability {
  employerId: string;
  slots: AvailabilitySlot[];
}

export interface BookingSlot {
  id: string;
  startAt: string;
  durationMins: number;
  role: string | null;
  medium: string;
}

export interface BookingPageData {
  employerId: string;
  company: string;
  slots: BookingSlot[];
}

/* ------------------------------- employer ------------------------------- */

export async function getMyAvailability(): Promise<MyAvailability> {
  const res = await fetch(`${API_BASE_URL}/employers/availability`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load availability");
  return (await res.json()).data as MyAvailability;
}

export async function addAvailability(input: {
  role?: string;
  durationMins?: number;
  medium?: string;
  slots: string[]; // ISO datetimes
}): Promise<MyAvailability> {
  const res = await fetch(`${API_BASE_URL}/employers/availability`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to add slots");
  }
  return (await res.json()).data as MyAvailability;
}

export async function removeAvailability(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/employers/availability/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to remove slot");
  }
}

/* ------------------------------ candidate -------------------------------- */

export async function getBookingPage(employerId: string): Promise<BookingPageData> {
  const res = await fetch(`${API_BASE_URL}/booking/${encodeURIComponent(employerId)}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Please sign in to book a time" : "This booking link isn't available");
  return (await res.json()).data as BookingPageData;
}

export async function bookSlot(slotId: string): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE_URL}/booking/slots/${encodeURIComponent(slotId)}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't book that time");
  }
  return (await res.json()).data as { id: string };
}

/* --------------------------------- .ics ---------------------------------- */

/** Downloads the interview's `.ics` calendar file (auth-gated) and triggers a save. */
export async function downloadInterviewIcs(interviewId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/interviews/${encodeURIComponent(interviewId)}/calendar.ics`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Couldn't get the calendar file");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interview-${interviewId.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
