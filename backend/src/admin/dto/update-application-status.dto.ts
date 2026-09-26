import { IsIn, IsString } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsString()
  @IsIn(['pending', 'shortlisted', 'interview', 'rejected', 'withdrawn', 'flagged'])
  status: string;
}
