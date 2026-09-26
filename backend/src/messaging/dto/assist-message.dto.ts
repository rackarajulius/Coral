import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssistMessageDto {
  @IsIn(['interview', 'rejection', 'followup', 'reply', 'rewrite', 'summary'])
  action: 'interview' | 'rejection' | 'followup' | 'reply' | 'rewrite' | 'summary';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  baseDraft?: string;
}
