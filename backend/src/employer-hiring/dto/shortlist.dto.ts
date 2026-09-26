import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PipelineStage } from '@prisma/client';

/**
 * The stages a recruiter can move a sourced candidate to.
 *
 * Was `['new', 'contacted', 'screening', 'interview', 'offer']` — a vocabulary
 * of its own, with no way to record that someone was hired or turned down. It is
 * now the shared ladder, so the sourced board and the applicant board cannot
 * describe the same person differently. WITHDRAWN is absent on purpose: that is
 * the candidate's own act, not a move an employer makes for them.
 */
export const SHORTLIST_STAGES = [
  PipelineStage.SOURCED,
  PipelineStage.CONTACTED,
  PipelineStage.APPLIED,
  PipelineStage.SCREENING,
  PipelineStage.INTERVIEW,
  PipelineStage.OFFER,
  PipelineStage.HIRED,
  PipelineStage.REJECTED,
] as const;

export class OpenShortlistDto {
  /** The search prompt this shortlist belongs to. */
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  roleTitle?: string;
}

export class UpsertShortlistItemDto {
  /**
   * null/omitted = not in the pipeline (saved only).
   *
   * Checked against SHORTLIST_STAGES rather than the whole enum, so WITHDRAWN
   * cannot be set here — an employer marking someone as having withdrawn would
   * be putting words in their mouth.
   */
  @IsOptional()
  @IsIn([...SHORTLIST_STAGES])
  stage?: (typeof SHORTLIST_STAGES)[number] | null;

  @IsOptional()
  @IsBoolean()
  saved?: boolean;

  /** The candidate card as shown when shortlisted. Required on first add. */
  @IsOptional()
  @IsObject()
  snapshot?: Record<string, unknown>;
}

/** A stage move made from the merged candidate board, by card id. */
export class MoveShortlistItemDto {
  @IsIn([...SHORTLIST_STAGES])
  stage: (typeof SHORTLIST_STAGES)[number];
}

/** A project the team means to keep, rather than a search they happened to run. */
export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}

/** Gathers a scattered candidate into one project. */
export class MoveItemToProjectDto {
  @IsString()
  @MinLength(1)
  shortlistId: string;
}

export class UpdateShortlistDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleTitle?: string;

  /** Empty string clears it, leaving a plain saved search behind. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
