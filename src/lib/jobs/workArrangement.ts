/**
 * Work arrangement → the two booleans the Job schema actually stores.
 *
 * Shared because the forms and this mapping drifted apart once already: the
 * employer form offered a "flexible" option that nothing mapped, so choosing it
 * silently produced an on-site job that never appeared under a remote filter.
 * Keeping the option list and the mapping in one file makes that recurrence
 * visible rather than silent.
 */
export type WorkArrangement = "on-site" | "hybrid" | "remote" | "flexible";

export const WORK_ARRANGEMENTS: { value: WorkArrangement; label: string }[] = [
  { value: "on-site", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
  { value: "flexible", label: "Flexible" },
];

export interface RemoteFlags {
  isRemote: boolean;
  isHybrid: boolean;
}

/**
 * `flexible` sets BOTH flags: the employer is saying fully remote is available
 * *and* so is coming in, so the job should match a candidate filtering for
 * either. The schema has no third state, so a flexible job displays as
 * "Remote" — accurate, if less specific than the employer chose.
 *
 * Anything unrecognised falls through to on-site, which is the safe default:
 * it under-claims rather than advertising remote work that isn't on offer.
 */
export function toRemoteFlags(arrangement: string | null | undefined): RemoteFlags {
  switch ((arrangement ?? "").trim().toLowerCase()) {
    case "remote":
      return { isRemote: true, isHybrid: false };
    case "hybrid":
      return { isRemote: false, isHybrid: true };
    case "flexible":
      return { isRemote: true, isHybrid: true };
    default:
      return { isRemote: false, isHybrid: false };
  }
}

/** The inverse — for populating an edit form from a stored job. */
export function toWorkArrangement(flags: Partial<RemoteFlags>): WorkArrangement {
  if (flags.isRemote && flags.isHybrid) return "flexible";
  if (flags.isRemote) return "remote";
  if (flags.isHybrid) return "hybrid";
  return "on-site";
}
