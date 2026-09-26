import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

class RatingDto {
  @IsString()
  @MaxLength(60)
  label: string;

  @IsInt()
  @Min(1)
  @Max(4)
  score: number;
}

export class SubmitScorecardDto {
  /** Employer-private per-competency ratings (1–4). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RatingDto)
  ratings?: RatingDto[];

  @IsOptional()
  @IsIn(['strong_yes', 'yes', 'maybe', 'no'])
  recommendation?: 'strong_yes' | 'yes' | 'maybe' | 'no';

  /** Private notes — never shown to the candidate. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  /** Candidate-visible decision (this is the no-ghosting signal). */
  @IsIn(['advancing', 'rejected', 'hold', 'hired'])
  outcome: 'advancing' | 'rejected' | 'hold' | 'hired';

  /** Friendly message shared with the candidate alongside the outcome. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outcomeNote?: string;
}
