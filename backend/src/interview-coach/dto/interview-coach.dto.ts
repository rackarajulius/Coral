import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export class StartSessionDto {
  /** InterviewConfig from the setup wizard. */
  @IsObject()
  config: Record<string, unknown>;

  /** Questions the client engine planned (until the AI engine lands in Phase 2). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  questions?: Record<string, unknown>[];
}

export class RecordAnswerDto {
  /** One AnswerRecord — question + transcript + evaluation. */
  @IsObject()
  answer: Record<string, unknown>;

  /** Running competency scores after this answer. */
  @IsOptional()
  @IsObject()
  liveScores?: Record<string, number>;

  /** Transcript lines to append (AI question + candidate answer). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  transcript?: Record<string, unknown>[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  questionIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;
}

/** Ask the AI to evaluate one spoken answer. */
export class EvaluateAnswerDto {
  @IsObject()
  question: Record<string, unknown>;

  @IsString()
  @MaxLength(8000)
  answer: string;

  /** Seconds spoken — fractional, since it's measured from timestamps. */
  @IsNumber()
  @Min(0)
  durationSec: number;
}

/** Ask the AI to build the end-of-interview report. */
export class BuildReportDto {
  @IsObject()
  finalScores: Record<string, number>;

  @IsArray()
  @ArrayMaxSize(30)
  qa: Record<string, unknown>[];
}

export class CompleteSessionDto {
  /** The SessionReport blob built for this run. */
  @IsObject()
  report: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Max(100)
  overallScore: number;

  @IsIn(['not-ready', 'getting-there', 'ready', 'strong'])
  readiness: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsIn(['completed', 'abandoned'])
  status?: 'completed' | 'abandoned';
}
