import { IsIn, IsOptional } from 'class-validator';
import { CandidateReactionValue } from '@prisma/client';

/**
 * A thumbs up or down on a candidate.
 *
 * `null` (or omitted) takes the reaction back, which is why this is one endpoint
 * rather than a set and a delete: there is one reaction per person, and changing
 * your mind is the same act as having one.
 */
export class ReactionDto {
  @IsOptional()
  @IsIn([CandidateReactionValue.UP, CandidateReactionValue.DOWN, null])
  value?: CandidateReactionValue | null;
}
