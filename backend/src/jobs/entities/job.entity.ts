export interface JobEntity {
  id: string;
  companyId: string;
  postedBy: string;
  title: string;
  description: string;
  location: string;
  isRemote: boolean;
  status: string;
  createdAt: Date;
}

