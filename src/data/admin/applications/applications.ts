/**
 * Application status as the admin shows it — the stage names employers see on
 * their board (server: applicationStatusLabel), plus Flagged, which only the
 * admin Flag action sets.
 */
export type ApplicationStatus =
  | "Applied"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected"
  | "Withdrawn"
  | "Flagged";

/** "2026-10-13T09:32:13.112Z" → "Oct 13, 2026". The list used to print the raw timestamp. */
export const formatAppliedDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const APPLICATION_STATUSES: ApplicationStatus[] = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected", "Withdrawn", "Flagged"];

export interface Application {
  id: string;
  applicant: {
    name: string;
    email: string;
    /** null when they haven't added one. */
    phone: string | null;
    /** Their photo, if any. Drawn with ApplicantAvatar, which falls back to initials. */
    avatarUrl: string | null;
    /** Name parts for the initials fallback (personInitials). */
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    location: string;
    profileCompletion: number;
  };
  job: {
    title: string;
    employer: string;
    location: string;
    salary: string;
    type: string;
    postedDate: string;
    status: string;
  };
  appliedDate: string;
  status: ApplicationStatus;
  resume: boolean;
  coverLetter: string;
  /**
   * The AI screen sent for this application, if any. Facts only — its score
   * is deliberately not sent (the scorer has an open defect).
   */
  screening: {
    mode: string;
    status: "invited" | "completed" | "declined" | string;
    invitedAt: string;
    completedAt: string | null;
    items: { question: string; answer: string | null }[];
  } | null;
  timeline: {
    event: string;
    date: string;
    actor?: string;
  }[];
}
