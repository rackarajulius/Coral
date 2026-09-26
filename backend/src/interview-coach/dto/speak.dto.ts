import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SpeakDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2500)
  text: string;

  /** Optional ElevenLabs voice id; falls back to the configured default. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  voiceId?: string;
}
