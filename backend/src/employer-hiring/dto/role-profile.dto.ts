import { IsString, MaxLength, MinLength } from 'class-validator';

export class RoleProfileDto {
  /** The employer's free-text hiring prompt. */
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;
}
