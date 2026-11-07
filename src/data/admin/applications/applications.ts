export type ApplicationStatus =
  | "Submitted"
  | "Under Review"
  | "Shortlisted"
  | "Interview"
  | "Rejected"
  | "Withdrawn"
  | "Flagged";

export interface Application {
  id: string;
  applicant: {
    name: string;
    email: string;
    phone: string;
    avatar: string;
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
