import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StartSessionDto {
  @IsObject()
  config: Record<string, unknown>;
}

/** Evaluation also saves the answer; the question is identified by its server ID. */
export class EvaluateAnswerDto {
  @IsString()
  @MaxLength(100)
  questionId: string;

  @IsString()
  @MaxLength(8000)
  answer: string;

  @IsNumber()
  @Min(0)
  @Max(900)
  durationSec: number;

  @IsOptional()
  @IsBoolean()
  typed?: boolean;
}
