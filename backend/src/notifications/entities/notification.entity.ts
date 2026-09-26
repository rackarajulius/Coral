export interface NotificationEntity {
  id: string;
  userId: string;
  title: string;
  message: string;
  readAt?: Date | null;
  createdAt: Date;
}

