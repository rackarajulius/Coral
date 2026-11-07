/** The onboarding text box look, shared by BrandInput and the location boxes. */
export const BRAND_INPUT_BASE = 'w-full rounded-[14px] text-[16px] bg-card transition-all duration-200';
/** BrandInput's own side padding; the location boxes pad the left for their icon instead. */
export const BRAND_INPUT_CLASSES = `${BRAND_INPUT_BASE} px-4`;
/** The same look for a location box, whose left padding makes room for its map pin. */
export const BRAND_LOCATION_INPUT_CLASSES = `${BRAND_INPUT_BASE} pr-4`;
