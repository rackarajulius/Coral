import { Type } from 'class-transformer';
import {
  IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
  ValidateNested,
} from 'class-validator';

/** All optional, all 1-5. A reviewer rates only what they experienced. */
export class CategoryRatingsDto {
  @IsOptional() @IsInt() @Min(1) @Max(5) communication?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) clarity?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) respect?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) timeliness?: number;
}

export class CreateReviewDto {
  /** The interaction being reviewed. Exactly one must be given. */
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  interviewId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(4)
  @MaxLength(120)
  title: string;

  /**
   * Minimum length is enforced here AND in the moderation check. A two-word
   * review tells a reader nothing and is the easiest thing to mass-produce.
   */
  @IsString()
  @MinLength(60)
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CategoryRatingsDto)
  categoryRatings?: CategoryRatingsDto;
}

export class RespondToReviewDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  body: string;
}

export class FlagReviewDto {
  @IsIn(['inaccurate', 'not_a_real_candidate', 'personal_details', 'abusive', 'other'])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}

export class ModerateReviewDto {
  @IsIn(['publish', 'remove'])
  action: 'publish' | 'remove';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
