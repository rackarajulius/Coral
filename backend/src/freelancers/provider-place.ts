import type { CitiesService, PlaceReading } from '../locations/cities.service';

/** Where a provider is based, as stored beside the words they wrote. */
export interface ProviderPlace {
  placeCountryCode: string | null;
  placeRegion: string | null;
  placeCity: string | null;
}

/**
 * Read where a provider says they're based: "toronto" with "Canada" is
 * Toronto, Ontario, CA. A city field holding a province ("Ontario") or a
 * country is read as that.
 *
 * The country they wrote decides. A city the list only knows elsewhere keeps
 * just their country, rather than moving them to another one. Nothing
 * readable gives all nulls, and the profile then matches no location search.
 */
export function readProviderPlace(
  cities: Pick<CitiesService, 'countryCodeOf' | 'readPlace'>,
  city: string | null | undefined,
  country: string | null | undefined,
): ProviderPlace {
  const stated = cities.countryCodeOf(country) ?? null;
  const reading = cities.readPlace(city, stated ?? undefined);
  const place = reading && fromReading(reading);
  if (place && (!stated || place.placeCountryCode === stated)) return place;
  return { placeCountryCode: stated, placeRegion: null, placeCity: null };
}

function fromReading(reading: PlaceReading): ProviderPlace {
  if (reading.kind === 'city') {
    return { placeCountryCode: reading.city.countryCode, placeRegion: reading.city.region ?? null, placeCity: reading.city.name };
  }
  if (reading.kind === 'region') return { placeCountryCode: reading.countryCode, placeRegion: reading.region, placeCity: null };
  return { placeCountryCode: reading.countryCode, placeRegion: null, placeCity: null };
}

/** A directory location search, read the same way as the profiles it matches. */
export type PlaceFilter =
  | { kind: 'city'; countryCode: string; region: string | null; city: string; label: string }
  | { kind: 'region'; countryCode: string; region: string; label: string }
  | { kind: 'country'; countryCode: string; label: string };

/**
 * Read what a visitor typed or picked: "London, ON", "Ontario", "Canada".
 * Undefined when it isn't a place the list knows.
 *
 * `near` settles a bare name found in several countries. The directory's
 * pilot is in Canada, so "London" alone is London, Ontario; "London, UK"
 * still finds England.
 *
 * A name that is both a province and a city, "Quebec", is read as the
 * province: it holds the city too, so nobody is lost, and the city alone is
 * one pick away in the suggestions ("Québec, QC").
 */
export function readPlaceFilter(
  cities: Pick<CitiesService, 'readPlace' | 'readRegion'>,
  text: string,
  near: string,
): PlaceFilter | undefined {
  const reading = (!text.includes(',') && cities.readRegion(text, near)) || cities.readPlace(text, near);
  if (!reading) return undefined;
  if (reading.kind === 'city') {
    const { city } = reading;
    return {
      kind: 'city', countryCode: city.countryCode, region: city.region ?? null, city: city.name,
      label: [city.name, city.region, city.country].filter(Boolean).join(', '),
    };
  }
  if (reading.kind === 'region') {
    return { kind: 'region', countryCode: reading.countryCode, region: reading.region, label: `${reading.region}, ${reading.country}` };
  }
  return { kind: 'country', countryCode: reading.countryCode, label: reading.country };
}
