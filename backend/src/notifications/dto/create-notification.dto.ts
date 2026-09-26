import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: 'low' | 'normal' | 'high';
}

