export interface EmployerProfileEntity {
  id: string;
  userId: string;
  companyId?: string | null;
  companyName: string;
  jobTitle: string;
  industry?: string | null;
  updatedAt: Date;
}

