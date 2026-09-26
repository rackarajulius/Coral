export interface EducationEntity {
  id: string;
  profileId: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate?: Date | null;
  current: boolean;
}

