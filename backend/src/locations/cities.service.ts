import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

/** A city to suggest, and how to write it. */
export interface CitySuggestion {
  name: string;
  /** Province or state, when known: "Ontario". */
  region?: string;
  /** Its short form, for Canada and the US: "ON", "TX". */
  regionCode?: string;
  /** ISO 3166 code: "CA". */
  countryCode: string;
  country: string;
  /** How it is written in a search: "Toronto, ON" in Canada and the US, "Kampala, Uganda" elsewhere. */
  label: string;
}

/** What a written place means, as `readPlace` reads it. */
export type PlaceReading =
  | { kind: 'city'; city: CitySuggestion }
  | { kind: 'region'; region: string; regionCode?: string; countryCode: string; country: string }
  | { kind: 'country'; countryCode: string; country: string };

interface Place {
  name: string;
  key: string;
  countryCode: string;
  region?: { name: string; code: string };
  population: number;
  /** A district of a larger city (Scarborough, Etobicoke…), shown below whole cities. */
  district: boolean;
}

interface Index {
  /** Every place, ordered by key, so a prefix is a contiguous run. */
  sorted: Place[];
  countries: Map<string, string>;
  /** Each country's currency (ISO 4217): "CA" → "CAD". */
  currencies: Map<string, string>;
  /** Each country's provinces or states, by search key and by short form: "ontario" and "on". */
  regions: Map<string, Map<string, { name: string; code?: string }>>;
  /** Country names (and the usual short forms) as search keys, longest first. */
  countryKeys: Array<[key: string, code: string]>;
}

/** What people write instead of the full country name. */
const COUNTRY_ALIASES: Array<[string, string]> = [
  // Only read when no city was found, so "us" here means the country: "Canada/US", "Remote, US".
  ['us', 'US'],
  ['usa', 'US'],
  ['u s a', 'US'],
  ['united states of america', 'US'],
  ['uk', 'GB'],
  ['u k', 'GB'],
  ['great britain', 'GB'],
  ['england', 'GB'],
  ['scotland', 'GB'],
  ['wales', 'GB'],
];

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 15;
/** How strongly the person's own country comes first: London, ON before London, UK for a Canadian. */
const NEAR_BOOST = 50;
const DISTRICT_WEIGHT = 0.3;
const EXACT_BOOST = 3;

/**
 * Spelling as people type it: accents, punctuation and case set aside, and
 * "saint"/"st", "sainte"/"ste", "mount"/"mt" treated alike, so "st johns"
 * finds St. John's and "saint-jerome" finds Saint-Jérôme.
 */
export function normalizePlace(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bmount\b/g, 'mt')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * City search for location autocomplete, from GeoNames (CC BY 4.0, credited
 * in the site footer): every place over 1,000 people, plus capitals and seats
 * of provinces and counties — about 154,000.
 *
 * Kept in memory and searched here rather than through Google Places, which
 * is what JobAssist uses: no key, no cost per keystroke, and what people type
 * never leaves us. The list is loaded on first use; see
 * scripts/build-city-index.ts to rebuild it.
 */
@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name);
  private index?: Index;
  /**
   * A property rather than a constructor argument: Nest would try to inject
   * a `string` argument and fail to start. Copied next to the compiled
   * service by the `assets` setting in nest-cli.json.
   */
  protected dataPath = join(__dirname, 'data', 'cities.tsv.gz');

  /**
   * Cities whose name starts with what was typed, most likely first.
   *
   * Text after a comma narrows by province, state or country: "london, on",
   * "london, uk", "springfield, il". "Quebec City" also finds Québec, which is
   * how GeoNames names it.
   */
  search(query: string, options: { near?: string; limit?: number } = {}): CitySuggestion[] {
    const [cityPart, ...rest] = query.split(',');
    const key = normalizePlace(cityPart ?? '');
    if (!key) return [];
    const qualifier = normalizePlace(rest.join(' '));
    const near = options.near?.trim().toUpperCase();
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const keys = new Set([key]);
    if (key.endsWith(' city')) keys.add(key.slice(0, -' city'.length));

    const scored = new Map<Place, number>();
    for (const k of keys) {
      for (const place of this.withPrefix(k)) {
        if (qualifier && !this.matchesQualifier(place, qualifier)) continue;
        let score = Math.max(place.population, 1);
        if (near && place.countryCode === near) score *= NEAR_BOOST;
        if (place.district) score *= DISTRICT_WEIGHT;
        if (place.key === k) score *= EXACT_BOOST;
        scored.set(place, Math.max(score, scored.get(place) ?? 0));
      }
    }

    // One suggestion per label: GeoNames can list a city twice.
    const seen = new Set<string>();
    const out: CitySuggestion[] = [];
    for (const [place] of [...scored].sort((a, b) => b[1] - a[1])) {
      const suggestion = this.toSuggestion(place);
      const id = `${suggestion.label}|${suggestion.countryCode}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(suggestion);
      if (out.length === limit) break;
    }
    return out;
  }

  /**
   * The best-known city a person's free-text location points to — profile
   * fields hold things like "Toronto", "toronto, on" or "Kampala". Undefined
   * when nothing fits.
   */
  resolve(text: string | null | undefined, country?: string | null): CitySuggestion | undefined {
    if (!text?.trim()) return undefined;
    const near = this.countryCodeOf(country);
    return this.search(text, { near, limit: 1 }).find((s) => normalizePlace(s.name) === normalizePlace(text.split(',')[0]));
  }

  /**
   * The country a job's location is in, read from text as job boards write
   * it: "Calgary, AB", "Toronto Headquarters", "Edmonton (+3 more)",
   * "Remote (Canada)", "Berlin". Undefined when it can't be told — "Remote",
   * "Anywhere", nothing at all.
   *
   * `near` is the country being searched: a name found in several countries
   * is read as that one's, so a doubtful job is kept rather than dropped.
   *
   * A country written out decides: "Ontario" is also a city in California,
   * and "Ontario, Canada" and "ONTARIO CANADA" were read as the United States.
   */
  countryOfText(text: string | null | undefined, near?: string): string | undefined {
    if (!text?.trim()) return undefined;
    const named = this.countryNamedIn(text, near);
    const expected = named ?? near;
    const city = this.cityStartingText(text, expected);
    if (city && (!expected || city.countryCode === expected)) return city.countryCode;
    // A province or state of the expected country: "Ontario" in a Canadian search.
    if (expected && this.regionNamed(text, expected)) return expected;
    // A city elsewhere ("Berlin" in a Canadian search), unless the text names
    // another country, or that city's own region ("Atlanta, Georgia" is not
    // the country Georgia).
    if (city && (!named || this.namesRegionOf(text, city))) return city.countryCode;
    // No city: a country named outright, as in "Remote (Canada)" or "Canada".
    return named;
  }

  /**
   * What a place someone wrote means: a city, a province or state, or a whole
   * country. Profiles hold all three in their city field ("ONTARIO CANADA",
   * "Uganda"), and a province isn't a city to search for.
   */
  readPlace(text: string | null | undefined, near?: string): PlaceReading | undefined {
    const t = text?.trim();
    if (!t) return undefined;
    const countryOnly = this.countryCodeOf(t);
    if (countryOnly) return this.countryReading(countryOnly);

    const named = this.countryNamedIn(t, near);
    const expected = named ?? near;
    // With what follows the comma ("London, ON"), or failing that the city
    // alone: "Toronto, Ontario, Canada" has more after it than one narrowing.
    const city = this.resolve(t, expected) ?? (t.includes(',') ? this.resolve(t.split(',')[0], expected) : undefined);
    if (city && (!expected || city.countryCode === expected)) return { kind: 'city', city };
    const region = expected
      ? (() => {
          const found = this.regionNamed(t, expected);
          return found && { ...found, countryCode: expected };
        })()
      : this.regionAnywhere(t);
    if (region) {
      const { countryCode } = region;
      return {
        kind: 'region',
        region: region.name,
        ...(region.code ? { regionCode: region.code } : {}),
        countryCode,
        country: this.load().countries.get(countryCode) ?? countryCode,
      };
    }
    if (city && (!named || this.namesRegionOf(t, city))) return { kind: 'city', city };
    return named ? this.countryReading(named) : undefined;
  }

  /** "CA", "ca", "Canada" → "CA". Undefined when it isn't a country. */
  countryCodeOf(text: string | null | undefined): string | undefined {
    const t = text?.trim();
    if (!t) return undefined;
    const { countries } = this.load();
    if (/^[a-z]{2}$/i.test(t) && countries.has(t.toUpperCase())) return t.toUpperCase();
    const wanted = normalizePlace(t);
    for (const [code, name] of countries) if (normalizePlace(name) === wanted) return code;
    return undefined;
  }

  /** "UG" → "UGX". Undefined for a code it doesn't know. */
  currencyOf(countryCode: string | null | undefined): string | undefined {
    return countryCode ? this.load().currencies.get(countryCode.toUpperCase()) : undefined;
  }

  /* ------------------------------- internals ------------------------------ */

  private countryReading(countryCode: string): PlaceReading {
    return { kind: 'country', countryCode, country: this.load().countries.get(countryCode) ?? countryCode };
  }

  /**
   * The city a text starts with: the longest leading run of words that names
   * one ("Toronto Headquarters" is Toronto), read with what follows the first
   * comma when that narrows it ("London, ON").
   */
  private cityStartingText(text: string, near?: string): CitySuggestion | undefined {
    const [place, ...rest] = text.split(',');
    const qualifier = rest.join(' ').replace(/\([^)]*\)/g, ' ').trim();
    const words = normalizePlace(place.replace(/\([^)]*\)/g, ' ')).split(' ').filter(Boolean);
    for (let n = words.length; n >= 1; n--) {
      const name = words.slice(0, n).join(' ');
      const tries = qualifier ? [`${name}, ${qualifier}`, name] : [name];
      for (const attempt of tries) {
        const hit = this.search(attempt, { near, limit: 1 })[0];
        if (hit && normalizePlace(hit.name) === name) return hit;
      }
    }
    return undefined;
  }

  /**
   * The province or state a text names first, in a given country: "Ontario",
   * "ONTARIO CANADA", "Ontario, Canada", "Texas, USA", "ON". The country's own
   * name after it is set aside.
   */
  private regionNamed(text: string, countryCode: string): { name: string; code?: string } | undefined {
    const regions = this.load().regions.get(countryCode);
    if (!regions) return undefined;
    let first = normalizePlace(text.split(',')[0].replace(/\([^)]*\)/g, ' '));
    for (const [key, code] of this.load().countryKeys) {
      if (code !== countryCode) continue;
      if (first === key) return undefined;
      if (first.endsWith(` ${key}`)) first = first.slice(0, -key.length - 1).trim();
    }
    return regions.get(first);
  }

  /** A province or state named alone, when only one country has one by that name ("Bavaria", "Texas"). */
  private regionAnywhere(text: string): { name: string; code?: string; countryCode: string } | undefined {
    const found: Array<{ name: string; code?: string; countryCode: string }> = [];
    for (const countryCode of this.load().regions.keys()) {
      const region = this.regionNamed(text, countryCode);
      if (region) found.push({ ...region, countryCode });
    }
    return found.length === 1 ? found[0] : undefined;
  }

  /** Whether the text also names the city's province or state: "Atlanta, Georgia". */
  private namesRegionOf(text: string, city: CitySuggestion): boolean {
    return !!city.region && ` ${normalizePlace(text)} `.includes(` ${normalizePlace(city.region)} `);
  }

  /**
   * The country a text names as a whole word. When it names several
   * ("Canada/US"), the searched one counts; otherwise the longest name wins
   * ("South Sudan" over "Sudan").
   */
  private countryNamedIn(text: string, near?: string): string | undefined {
    const padded = ` ${normalizePlace(text)} `;
    const named = this.load()
      .countryKeys.filter(([key]) => padded.includes(` ${key} `))
      .map(([, code]) => code);
    return near && named.includes(near) ? near : named[0];
  }

  private withPrefix(prefix: string): Place[] {
    const { sorted } = this.load();
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].key < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out: Place[] = [];
    for (let i = lo; i < sorted.length && sorted[i].key.startsWith(prefix); i++) out.push(sorted[i]);
    return out;
  }

  private matchesQualifier(place: Place, qualifier: string): boolean {
    const country = this.load().countries.get(place.countryCode) ?? '';
    return (
      (!!place.region && (normalizePlace(place.region.code) === qualifier || normalizePlace(place.region.name).startsWith(qualifier))) ||
      place.countryCode.toLowerCase() === qualifier ||
      normalizePlace(country).startsWith(qualifier) ||
      // "uk" is what people write for the United Kingdom.
      (qualifier === 'uk' && place.countryCode === 'GB')
    );
  }

  private toSuggestion(place: Place): CitySuggestion {
    const country = this.load().countries.get(place.countryCode) ?? place.countryCode;
    const regionCode = place.region?.code || undefined;
    return {
      name: place.name,
      ...(place.region ? { region: place.region.name } : {}),
      ...(regionCode ? { regionCode } : {}),
      countryCode: place.countryCode,
      country,
      label: regionCode ? `${place.name}, ${regionCode}` : `${place.name}, ${country}`,
    };
  }

  private load(): Index {
    if (this.index) return this.index;
    const started = Date.now();
    const text = gunzipSync(readFileSync(this.dataPath)).toString('utf8');
    const countries = new Map<string, string>();
    const currencies = new Map<string, string>();
    const regions = new Map<string, { name: string; code: string }>();
    const places: Place[] = [];
    for (const line of text.split('\n')) {
      const f = line.split('\t');
      if (f[0] === 'C') {
        countries.set(f[1], f[2]);
        if (f[3]) currencies.set(f[1], f[3]);
      } else if (f[0] === 'R') regions.set(f[1], { name: f[2], code: f[3] ?? '' });
      else if (f[0] === 'P') {
        const region = f[3] ? regions.get(`${f[2]}.${f[3]}`) : undefined;
        places.push({
          name: f[1],
          // Precomputed by the build script; computed here only for an older file.
          key: f[6] || normalizePlace(f[1]),
          countryCode: f[2],
          ...(region ? { region } : {}),
          population: Number(f[4]) || 0,
          district: f[5] === 'x',
        });
      }
    }
    // The build script writes places in key order; sort only if a file isn't.
    if (places.some((p, i) => i > 0 && places[i - 1].key > p.key)) {
      places.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    }
    const countryKeys: Array<[string, string]> = [
      ...[...countries].map(([code, name]): [string, string] => [normalizePlace(name), code]),
      ...COUNTRY_ALIASES,
    ]
      .filter(([key]) => key.length > 1)
      .sort((a, b) => b[0].length - a[0].length);
    const regionsByCountry = new Map<string, Map<string, { name: string; code?: string }>>();
    for (const [key, region] of regions) {
      const countryCode = key.split('.')[0];
      const byName = regionsByCountry.get(countryCode) ?? new Map<string, { name: string; code?: string }>();
      const entry = { name: region.name, ...(region.code ? { code: region.code } : {}) };
      byName.set(normalizePlace(region.name), entry);
      if (region.code) byName.set(region.code.toLowerCase(), entry);
      regionsByCountry.set(countryCode, byName);
    }
    this.index = { sorted: places, countries, currencies, regions: regionsByCountry, countryKeys };
    this.logger.log(`Loaded ${places.length} places in ${Date.now() - started}ms`);
    return this.index;
  }
}
