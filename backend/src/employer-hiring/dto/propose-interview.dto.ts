import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProposeInterviewDto {
  @IsString()
  candidateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  role?: string;

  @IsOptional()
  @IsIn(['video', 'phone', 'onsite'])
  medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingLink?: string;

  /** ISO datetime strings the candidate can choose from. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  proposedSlots: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
