import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DraftOutreachDto {
  @IsString()
  candidateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tone?: string; // warm | direct | concise
}
