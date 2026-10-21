import { IsString, MaxLength, MinLength } from 'class-validator';

/** A match the seeker isn't interested in. Title and company catch the same job from other sources. */
export class DismissMatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  jobId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company: string;
}
