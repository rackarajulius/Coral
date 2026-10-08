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
  "text-muted-foreground hover:text-foreground data-[state=active]:border-orange-500 " +
  "data-[state=active]:bg-transparent data-[state=active]:text-orange-700 " +
  "dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-none";

export const EMPLOYER_ACTIVE_TAB =
  "border-orange-500 text-orange-700 dark:text-orange-400";

export const EMPLOYER_UNDERLINE_TAB_TRIGGER =
  "employer-underline-tab " + UNDERLINE_TAB_TRIGGER;
