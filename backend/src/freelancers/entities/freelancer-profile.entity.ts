export interface FreelancerProfileEntity {
  id: string;
  userId: string;
  title?: string | null;
  summary?: string | null;
  hourlyRate?: string | null;
  skills: string[];
  expertise: string[];
}

