import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApplicationStatus } from './update-application-status.dto';

export class BulkUpdateApplicationsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  applicationIds: string[];

  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
