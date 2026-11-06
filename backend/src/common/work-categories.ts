/**
 * The kinds of work professionals offer on Coral: one list for provider
 * profiles, service listings and project briefs, served to the web app at
 * GET /freelancers/categories so it is never written down twice.
 *
 * A profile outside the list is never public (provider-profile-policy.ts), so
 * removing a category hides everyone in it. Add freely; remove only after
 * moving the profiles and listings in it.
 *
 * Regulated professions are left out on purpose: legal services, public
 * accounting, engineering and health care need a licence Coral cannot check,
 * and a category for them would read as Coral vouching that it had.
 */
export const WORK_CATEGORIES = [
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'software', label: 'Software' },
  { value: 'writing', label: 'Writing & content' },
  { value: 'data', label: 'Data & analytics' },
  { value: 'product', label: 'Product & project management' },
  { value: 'sales', label: 'Sales & business development' },
  { value: 'finance', label: 'Bookkeeping & finance' },
  { value: 'hr', label: 'HR & recruiting' },
  { value: 'support', label: 'Admin & customer support' },
  { value: 'media', label: 'Video, photo & audio' },
  { value: 'translation', label: 'Translation' },
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number]['value'];

/** Just the values, for validation and SQL. */
export const WORK_CATEGORY_VALUES = WORK_CATEGORIES.map((category) => category.value) as unknown as readonly [WorkCategory, ...WorkCategory[]];
