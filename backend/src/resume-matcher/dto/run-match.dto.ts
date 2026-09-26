import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RunMatchDto {
  /** Optional role/keyword from the search bar. Omitted = match the stored profile. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;
}
