import type { CitySuggestion } from "../api/locations";

export interface LocationParts {
  city: string;
  state: string;
  country: string;
}

/**
 * "Kampala, Uganda" → the three columns the backend stores it in.
 *
 * The profile edits location as one line, which is how people write it, and the
 * backend keeps city/state/country separately so employers can filter on them.
 * One comma is read as city + country, two as city + state + country, since
 * that is the order those are written in. Anything past the third is kept with
 * the country rather than dropped, and the split reverses the join in
 * `mapServerProfileToSyncedFields` exactly, so a value survives a round trip
 * untouched.
 *
 * It cannot be lossless on its own, though, and that is why callers should pass
 * the parts they loaded rather than the joined text when nothing was edited.
 * A profile holding only `country: "Canada"` renders as "Canada", and reading
 * that back gives `city: "Canada"` — one comma-free word is far more often a
 * city than a country, so the guess is right in general and wrong exactly here.
 * Re-splitting unchanged text would quietly migrate the value between columns.
 *
 * Previously this field went nowhere at all: it was seeded to "Kampala,
 * Uganda", never loaded, and never saved — so it was wrong for almost everyone
 * and editing it changed nothing.
 */
export function splitLocation(location: string): LocationParts {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { city: "", state: "", country: "" };
  if (parts.length === 1) return { city: parts[0], state: "", country: "" };
  if (parts.length === 2) return { city: parts[0], state: "", country: parts[1] };
  return { city: parts[0], state: parts[1], country: parts.slice(2).join(", ") };
}

/**
 * A picked city written as a profile location line: "Toronto, Ontario,
 * Canada", "Kampala, Uganda" — city, province or state where the country
 * has them in the list (Canada, the US), country. That is the order
 * `splitLocation` reads back into the city, state and country columns, so
 * the short label "Toronto, ON" (which would put "ON" in the country column)
 * is not used for profiles.
 */
export function placeLine(city: CitySuggestion): string {
  return [city.name, city.regionCode ? city.region : undefined, city.country].filter(Boolean).join(", ");
}

/** A picked city as the profile's columns: the same as `splitLocation(placeLine(city))`. */
export function placeParts(city: CitySuggestion): LocationParts {
  return { city: city.name, state: city.regionCode ? city.region ?? "" : "", country: city.country };
}

/** "UG" → "Uganda", using the browser's own country names; undefined for a code it doesn't know. */
export function countryNameOf(code: string): string | undefined {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase());
  } catch {
    return undefined;
  }
}
