import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class InviteScreenDto {
  @IsString()
  candidateId: string;

  /** 'text' (typed answers, AI-scored) or 'video' (recorded answers, human review). */
  @IsOptional()
  @IsIn(['text', 'video'])
  mode?: 'text' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  jobDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(8)
  questionCount?: number;
}
