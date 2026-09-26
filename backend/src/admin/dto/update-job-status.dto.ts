import { IsIn, IsString } from 'class-validator';

export class UpdateJobStatusDto {
  @IsString()
  @IsIn(['published', 'flagged', 'suspended', 'rejected', 'pending', 'draft'])
  status: string;
}
