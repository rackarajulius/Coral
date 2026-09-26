import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartConversationDto {
  @IsUUID()
  candidateId: string;

  @IsOptional()
  @IsString()
  jobId?: string;
}
