export interface ExperienceEntity {
  id: string;
  profileId: string;
  title: string;
  company: string;
  startDate: Date;
  endDate?: Date | null;
  current: boolean;
}

