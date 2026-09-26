import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

/** An admin comp: Premium until a date, with a reason kept on file. */
export class GrantPremiumDto {
  /** ISO date-time the comp ends. Must be in the future, at most a year out. */
  @IsDateString()
  until!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
