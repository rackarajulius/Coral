export interface UserEntity {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

