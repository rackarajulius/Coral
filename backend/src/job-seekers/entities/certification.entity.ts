export interface CertificationEntity {
  id: string;
  profileId: string;
  name: string;
  issuingOrg: string;
  issueDate: Date;
  expirationDate?: Date | null;
  noExpiration: boolean;
}

