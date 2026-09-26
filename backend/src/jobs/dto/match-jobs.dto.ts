import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class MatchJobsDto {
  /** The job ids currently visible to the candidate (one screenful). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  jobIds: string[];
}
