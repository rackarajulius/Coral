import { IsIn, IsOptional } from 'class-validator';

/**
 * Self-selected buckets. Coarse on purpose: finer categories make individuals
 * re-identifiable in a small applicant pool, which is the opposite of what this
 * data is for. "prefer_not_to_say" is a real answer, not a missing one.
 */
export const ETHNICITY_OPTIONS = [
  'asian',
  'black_african_caribbean',
  'hispanic_latino',
  'middle_eastern_north_african',
  'native_indigenous',
  'pacific_islander',
  'white',
  'multiple',
  'other',
  'prefer_not_to_say',
] as const;

export const GENDER_OPTIONS = [
  'woman',
  'man',
  'non_binary',
  'other',
  'prefer_not_to_say',
] as const;

export const AGE_BAND_OPTIONS = [
  'under_25',
  '25_34',
  '35_44',
  '45_54',
  '55_plus',
  'prefer_not_to_say',
] as const;

export const DISABILITY_OPTIONS = ['yes', 'no', 'prefer_not_to_say'] as const;
export const VETERAN_OPTIONS = ['yes', 'no', 'prefer_not_to_say'] as const;

export class UpsertDemographicReportDto {
  @IsOptional()
  @IsIn(ETHNICITY_OPTIONS as unknown as string[])
  ethnicity?: string;

  @IsOptional()
  @IsIn(GENDER_OPTIONS as unknown as string[])
  gender?: string;

  @IsOptional()
  @IsIn(AGE_BAND_OPTIONS as unknown as string[])
  ageBand?: string;

  @IsOptional()
  @IsIn(DISABILITY_OPTIONS as unknown as string[])
  disability?: string;

  @IsOptional()
  @IsIn(VETERAN_OPTIONS as unknown as string[])
  veteran?: string;
}
