import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class JobContextDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(255)
  company: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;
}

/**
 * Body for the cover-letter and tailoring endpoints. The resume comes from the
 * signed-in seeker's stored profile — the client only sends the target job.
 */
export class AssistDto {
  @IsObject()
  @ValidateNested()
  @Type(() => JobContextDto)
  job: JobContextDto;
}
