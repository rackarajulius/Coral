import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GenerateInterviewPrepDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsString()
  @MaxLength(150)
  targetRole: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  interviewType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  difficulty?: string;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  focusAreas?: string[];

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  questionCount?: number;
}

export class InterviewPrepFeedbackDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

export class InterviewPrepSessionsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
