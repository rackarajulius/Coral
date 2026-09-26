import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class DispatchJobAlertsDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
