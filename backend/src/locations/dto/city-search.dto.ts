import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CitySearchDto {
  /** What has been typed so far: "tor", "london, on". */
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  q: string;

  /**
   * The person's own country, whose cities come first: a code ("CA") or a
   * name ("Canada"), since profiles store names. Anything unrecognised is ignored.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  near?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15)
  limit?: number;
}
