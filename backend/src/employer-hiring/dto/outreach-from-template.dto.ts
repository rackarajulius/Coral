import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class OutreachFromTemplateDto {
  @IsUUID()
  templateId!: string;

  @IsUUID()
  candidateId!: string;

  /**
   * What fills `{{job_title}}` — the project's role, since a sourced candidate
   * has no job. Omitted, the token stays visible for the recruiter to fill in.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;
}
