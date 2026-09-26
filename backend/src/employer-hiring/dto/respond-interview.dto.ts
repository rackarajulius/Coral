import { IsIn, IsOptional, IsString } from 'class-validator';

export class RespondInterviewDto {
  @IsIn(['accept', 'decline'])
  action: 'accept' | 'decline';

  /** The chosen slot (ISO string from proposedSlots). Defaults to the first. */
  @IsOptional()
  @IsString()
  slot?: string;
}
