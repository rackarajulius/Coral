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
  screeningScore: number;
  resume: boolean;
  coverLetter: string;
  screeningQuestions: {
    question: string;
    answer: string;
    passed: boolean;
  }[];
  timeline: {
    event: string;
    date: string;
    actor?: string;
  }[];
}
