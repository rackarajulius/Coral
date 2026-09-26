import type { PipelineStage } from "./Index";
import {
  LADDER,
  STAGE_COLOURS,
  STAGE_LABELS,
  type PipelineStageId,
} from "@/data/employer/pipelineLadder";

/**
 * The sourced board's columns, built from the shared ladder.
 *
 * Was its own list — new / contacted / screening / interview / offer — with no
 * way to record that someone was hired or turned down. A recruiter who made an
 * offer and got a yes had nowhere to put them, so the board quietly stopped
 * being a record of what happened.
 *
 * REJECTED is appended rather than being part of LADDER: people need somewhere
 * to go, but it must not count as progress past Interview.
 */
const BOARD_STAGES: PipelineStageId[] = [...LADDER, "REJECTED"];

export const pipelineStages: PipelineStage[] = BOARD_STAGES.map((id) => ({
  id,
  label: STAGE_LABELS[id],
  ...STAGE_COLOURS[id],
}));

// ─── AI copilot suggested actions ────────────────────────────────────────────
export const aiActions: string[] = [
  "Write outreach for the top candidate",
  "Compare top 3 candidates",
  "Generate interview questions",
  "Broaden location radius",
  "Lower experience threshold",
  "Find candidates at competitors",
  "Adjust salary range",
  "Screen for leadership skills",
];
