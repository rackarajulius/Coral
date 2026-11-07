/**
 * What a company page says about the organisation, in LinkedIn's terms — the
 * options its creation form and Edit page offer. One list for every form that
 * asks (onboarding, the company editor, settings, admin), so the same company
 * can't be "1–10" in one place and "2-10" in another. The server keeps the
 * same values in backend/src/company/company-facts.ts.
 */

/** Organization size, stored exactly as shown. */
export const COMPANY_SIZES = [
  "0-1",
  "2-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1,000",
  "1,001-5,000",
  "5,001-10,000",
  "10,001+",
] as const;

/** Organization type: the stored key and what people read. */
export const COMPANY_TYPES = [
  { value: "PUBLIC_COMPANY", label: "Public company" },
  { value: "PRIVATELY_HELD", label: "Privately held" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "SELF_EMPLOYED", label: "Self-employed" },
  { value: "SELF_OWNED", label: "Sole proprietorship" },
  { value: "NONPROFIT", label: "Nonprofit" },
  { value: "GOVERNMENT_AGENCY", label: "Government agency" },
  { value: "EDUCATIONAL", label: "Educational" },
] as const;

export function companyTypeLabel(value?: string | null): string | null {
  return COMPANY_TYPES.find((t) => t.value === value)?.label ?? null;
}

/** "2-10 employees", or nothing when no size is set. */
export function companySizeLabel(size?: string | null): string | null {
  const s = size?.trim();
  return s ? `${s} employees` : null;
}

/**
 * The size choices to offer for a page. A page saved before these bands may
 * hold a range that spans two of them ("1-10", "1000+"); it stays selectable,
 * marked as older, so opening the form never silently changes what it says.
 */
export function companySizeOptions(current?: string | null): { value: string; label: string }[] {
  const bands = COMPANY_SIZES.map((s) => ({ value: s as string, label: `${s} employees` }));
  const held = current?.trim();
  if (held && !(COMPANY_SIZES as readonly string[]).includes(held)) {
    return [{ value: held, label: `${held} employees (older range — pick a current one)` }, ...bands];
  }
  return bands;
}

/** The smallest headcount a size allows: "1,001-5,000" → 1001. Null when unreadable. */
export function companySizeFloor(size?: string | null): number | null {
  const first = size?.replace(/,/g, "").match(/\d+/)?.[0];
  return first ? Number(first) : null;
}
