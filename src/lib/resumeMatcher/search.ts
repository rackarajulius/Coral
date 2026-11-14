import type { MatchSearch } from "@/lib/api/resumeMatcher";
import { countryNameOf } from "@/lib/location/places";

/**
 * "Anywhere in Uganda, or type a city". Searches cover one country at a
 * time, so an empty box means anywhere in the person's country, not the world.
 */
export function anywherePlaceholder(countryCode: string | undefined): string {
  const country = countryCode ? countryNameOf(countryCode) : undefined;
  return country ? `Anywhere in ${country}, or type a city` : "City, or leave blank for anywhere";
}

/** A search as part of a cache key: "anywhere" and "the profile's city" stay distinct. */
export function searchKey(search: MatchSearch | undefined): string[] {
  if (!search) return ["profile"];
  const place = search.location === undefined ? "profile" : `at:${search.location}`;
  return [search.query ?? "", place, search.countryCode ?? ""];
}
