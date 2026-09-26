import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsObject, IsOptional, IsString,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

/**
 * Integrity observations reported by the client. Self-reported and therefore
 * trivially suppressible by a determined candidate — which is fine, because
 * these are context for a human reviewer, never proof and never scored.
 * Values are bounded so a malformed or hostile client can't distort the record.
 */
export class IntegritySignalsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  pasteCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pastedChars?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  blurCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  blurMs?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsNumber({}, { each: true })
  latencies?: number[];
}

export class SubmitScreenDto {
  /** Text-mode answers, in the same order as the screen's questions. Omitted for video mode. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(3000, { each: true })
  answers?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IntegritySignalsDto)
  integrity?: IntegritySignalsDto;
}
