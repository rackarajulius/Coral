import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export interface CopilotCandidate {
  id?: string;
  name: string;
  skills?: string[];
  match?: number | null;
}

export class CopilotDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  /** The active role/search context (parsed intent's raw prompt). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  role?: string;

  /** The current shortlist the copilot can act on. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  candidates?: CopilotCandidate[];
}
