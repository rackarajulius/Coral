import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestHeadlinesDto {
  /** Optional role to tailor the headline suggestions toward. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetRole?: string;
}
