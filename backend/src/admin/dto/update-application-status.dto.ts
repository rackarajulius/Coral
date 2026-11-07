import { IsIn, IsString } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsString()
  // The product's statuses (common/pipeline-stage) plus the admin-only
  // 'flagged'. 'interview' used to be here, which nothing else reads.
  @IsIn(['pending', 'reviewing', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn', 'flagged'])
  status: string;
}
