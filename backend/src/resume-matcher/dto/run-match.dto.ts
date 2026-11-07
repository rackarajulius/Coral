import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RunMatchDto {
  /** Optional role/keyword from the search bar. Omitted = match the stored profile. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  /**
   * Where to look: a chosen city ("Toronto, ON") or typed text. An empty
   * string means anywhere. Omitted means the city on the profile.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  /** The chosen city's country (ISO 3166), when it was picked from suggestions. */
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  /**
   * Answer with the jobs as soon as they are found, ranked by keywords, and
   * leave the AI's scores to `POST /resume-matcher/run/scores` with the same
   * search. Not part of what makes two searches the same.
   */
  @IsOptional()
  @IsBoolean()
  scoreLater?: boolean;
}
