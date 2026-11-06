import { useQuery } from "@tanstack/react-query";
import { getWorkCategories } from "@/lib/api/categories";

/**
 * The kinds of work on Coral, loaded once per session: the list only changes
 * with a deploy, and every category picker and badge reads the same copy.
 */
export function useWorkCategories() {
  const query = useQuery({
    queryKey: ["work-categories"],
    queryFn: ({ signal }) => getWorkCategories(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
  const categories = query.data ?? [];

  return {
    categories,
    /** True until the list has arrived (or failed). */
    isLoading: query.isPending,
    /** The label for a value, or `fallback` while loading or for one no longer listed. */
    label: (value: string | null | undefined, fallback = "Professional") =>
      categories.find((category) => category.value === value)?.label ?? fallback,
    /** The value when it is one of ours: for a `?category=` read from a URL. */
    find: (value: string | null | undefined) => categories.find((category) => category.value === value)?.value,
  };
}
