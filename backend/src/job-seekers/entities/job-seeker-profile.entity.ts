export interface JobSeekerProfileEntity {
  id: string;
  userId: string;
  headline?: string | null;
  summary?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  skills: string[];
  languages: string[];
  updatedAt: Date;
}

