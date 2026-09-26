import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApplicationStatus } from './update-application-status.dto';

export class ListApplicationsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;

  @IsOptional()
  @IsUUID()
  applicantId?: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;
}
