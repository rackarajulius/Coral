import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnalyzeReadinessDto {
  /** The role to assess the candidate's readiness against. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetRole: string;
}
