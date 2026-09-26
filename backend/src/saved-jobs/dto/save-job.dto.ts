import { IsUUID } from 'class-validator';

export class SaveJobDto {
  @IsUUID()
  jobId: string;
}
