/**
 * What a company page says about the organisation, in LinkedIn's terms — the
 * options its creation form and Edit page offer (seen live 2026-11-05). The
 * web app keeps the same lists in src/lib/companyFacts.ts.
 */

/** Organization size, stored as shown: "2-10", "1,001-5,000", "10,001+". */
export const COMPANY_SIZES = [
  '0-1',
  '2-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1,000',
  '1,001-5,000',
  '5,001-10,000',
  '10,001+',
] as const;

/**
 * Organization type, stored as a key. LinkedIn asks for it when a page is
 * created; pages made before it existed have none until an owner picks one.
 */
export const COMPANY_TYPES = [
  'PUBLIC_COMPANY',
  'PRIVATELY_HELD',
  'PARTNERSHIP',
  'SELF_EMPLOYED',
  'SELF_OWNED',
  'NONPROFIT',
  'GOVERNMENT_AGENCY',
  'EDUCATIONAL',
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];
