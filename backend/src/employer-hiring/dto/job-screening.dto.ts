import {
  ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min,
} from 'class-validator';
import { SCREENING_LANGUAGES } from '../../services/ai/ai.service';

/** Most candidates one invite call may cover — keeps an accidental click cheap. */
export const SCREEN_BATCH_MAX = 50;

/** Ceiling on screens ever sent for a single job (all batches combined). */
export const SCREEN_PER_JOB_MAX = 200;

export class GenerateJobQuestionsDto {
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(8)
  questionCount?: number;

  /**
   * Replace an existing set. Off by default: regenerating means new candidates
   * sit a different exam from the ones already scored, so it must be a choice.
   */
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;

  /**
   * BCP-47 language for the round. Chosen here because changing it requires
   * regenerating the questions anyway — the two decisions are the same one.
   */
  @IsOptional()
  @IsIn(SCREENING_LANGUAGES.map((l) => l.tag))
  language?: string;
}

export class InviteScreenBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(SCREEN_BATCH_MAX)
  @IsString({ each: true })
  candidateIds: string[];

  /**
   * 'text' (typed answers, AI-scored) · 'video' (recorded, human review) ·
   * 'live' (spoken conversation with the AI interviewer, AI-scored).
   */
  @IsOptional()
  @IsIn(['text', 'video', 'live'])
  mode?: 'text' | 'video' | 'live';
}
