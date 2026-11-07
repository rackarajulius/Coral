import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminListQueryDto } from './admin-list-query.dto';

/**
 * Filters for the admin jobseekers list — only ones the database can answer.
 *
 * Profile completion and application counts are not here: completion is
 * computed in code from several tables, and filtering on a count needs raw
 * SQL. A filter that looked like it worked but couldn't would be worse than
 * none.
 */
export class JobseekersListQueryDto extends AdminListQueryDto {
  /** Comma-separated: Active, Onboarding, Inactive, Suspended, Banned. */
  @IsOptional() @IsString() @MaxLength(100) statuses?: string;

  /** Only people with an open report about something they wrote. */
  @IsOptional() @IsIn(['true']) hasOpenReports?: string;

  /** Only people on Premium, paid or complimentary. */
  @IsOptional() @IsIn(['true']) premiumOnly?: string;

  @IsOptional() @IsDateString() signedUpFrom?: string;
  @IsOptional() @IsDateString() signedUpTo?: string;
  @IsOptional() @IsDateString() activeFrom?: string;
  @IsOptional() @IsDateString() activeTo?: string;

  /** A country code as stored on profiles ("CA"); see GET jobseekers/countries. */
  @IsOptional() @IsString() @MaxLength(10) country?: string;
}
