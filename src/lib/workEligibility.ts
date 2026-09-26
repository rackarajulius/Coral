// Canadian work-eligibility statuses. Values are stored on the profile; labels
// drive the editor; `badge` is the short form shown on the hero/public profile.

export interface WorkEligibilityOption {
  value: string;
  label: string;
  badge: string;
  /** Whether a permit-expiry date is relevant for this status. */
  hasExpiry: boolean;
}

export const WORK_ELIGIBILITY_OPTIONS: WorkEligibilityOption[] = [
  { value: "citizen", label: "Canadian Citizen", badge: "Canadian Citizen", hasExpiry: false },
  { value: "pr", label: "Permanent Resident", badge: "Permanent Resident", hasExpiry: false },
  { value: "work_permit_open", label: "Work Permit — Open", badge: "Open Work Permit", hasExpiry: true },
  {
    value: "work_permit_closed",
    label: "Work Permit — Employer-specific",
    badge: "Work Permit",
    hasExpiry: true,
  },
  { value: "study_permit", label: "Study Permit / PGWP", badge: "Study Permit / PGWP", hasExpiry: true },
  { value: "iec", label: "Working Holiday (IEC)", badge: "Working Holiday (IEC)", hasExpiry: true },
  {
    value: "needs_sponsorship",
    label: "Requires Sponsorship",
    badge: "Needs Sponsorship",
    hasExpiry: false,
  },
];

export const getWorkEligibilityOption = (
  value: string | undefined | null,
): WorkEligibilityOption | undefined =>
  value ? WORK_ELIGIBILITY_OPTIONS.find((o) => o.value === value) : undefined;
