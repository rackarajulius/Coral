/**
 * Underline tab styling — a bottom rule across the row with an orange bar under
 * the active tab, instead of the default filled-pill look.
 *
 * Extracted because the same long class string was pasted four times in
 * /jobseeker/settings; every new place that wanted the look copied it again and
 * they drifted. Import these instead of re-typing the string.
 *
 * Usage:
 *   <TabsList className={UNDERLINE_TABS_LIST}>
 *     <TabsTrigger value="x" className={UNDERLINE_TAB_TRIGGER}>…</TabsTrigger>
 */
export const UNDERLINE_TABS_LIST =
  "h-auto justify-start gap-1 rounded-none border-b border-border bg-transparent p-0";

export const UNDERLINE_TAB_TRIGGER =
  "-mb-px rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 " +
  "hover:text-foreground data-[state=active]:border-orange-500 " +
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground " +
  "data-[state=active]:shadow-none";
