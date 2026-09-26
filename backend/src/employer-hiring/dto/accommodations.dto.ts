import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * What a candidate needs in order to take a screening on equal terms.
 *
 * Phrased as needs, not conditions. There is no field for a diagnosis and none
 * should be added: an employer doesn't need one to honour a request, requiring
 * it is unlawful in many jurisdictions, and it would immediately become the
 * most sensitive record in the system.
 */
export const ACCOMMODATION_NEEDS = [
  /** More time per answer; removes silence-based auto-advance pressure. */
  'extra_time',
  /** Type answers instead of speaking, chosen up front rather than as a fallback. */
  'typed_answers',
  /** A person instead of the AI interviewer. Always available. */
  'human_interviewer',
  /** Screen reader or other assistive software in use during the interview. */
  'assistive_tech',
  /** Anything the list doesn't cover — see `note`. */
  'other',
] as const;

export class RequestAccommodationsDto {
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(ACCOMMODATION_NEEDS as unknown as string[], { each: true })
  needs: string[];

  /** The candidate's own words. Optional, and never required to justify a need. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
