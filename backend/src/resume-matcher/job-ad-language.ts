/**
 * The language most job ads in a place are written in, where it isn't
 * English, so the matcher can search them in it.
 *
 * The matcher searches with the role from the profile, usually in English,
 * and a keyword search only finds ads that use those words. Counted on Adzuna
 * (2026-10-16): "nurse" found 786 jobs in Germany against 74,119 for
 * "Pflegefachkraft", and 135 in France against 62,063 for "infirmier".
 *
 * Written out by hand rather than taken from a country's official languages:
 * GeoNames lists Zulu first for South Africa and Mandarin for Singapore, and
 * hiring there is in English. A country left out keeps English-only searches,
 * as before — a miss costs nothing that wasn't already missed.
 */
const BY_COUNTRY: Record<string, string> = {
  // Europe
  AT: 'de', DE: 'de', CH: 'de', LI: 'de',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  NL: 'nl',
  IT: 'it', SM: 'it',
  ES: 'es', PT: 'pt',
  PL: 'pl', CZ: 'cs', SK: 'sk', HU: 'hu', RO: 'ro', MD: 'ro', BG: 'bg', GR: 'el',
  HR: 'hr', SI: 'sl', RS: 'sr', UA: 'uk', TR: 'tr',
  SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', EE: 'et', LV: 'lv', LT: 'lt',
  // The Americas
  MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', BO: 'es', PY: 'es', UY: 'es',
  CR: 'es', PA: 'es', GT: 'es', HN: 'es', SV: 'es', NI: 'es', DO: 'es', CU: 'es',
  BR: 'pt', HT: 'fr',
  // Africa: French-speaking job markets, the Maghreb included, and Portuguese-speaking ones
  SN: 'fr', CI: 'fr', CM: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr', GN: 'fr', CD: 'fr',
  CG: 'fr', GA: 'fr', MG: 'fr', TD: 'fr', CF: 'fr', DJ: 'fr', BI: 'fr', MA: 'fr', DZ: 'fr', TN: 'fr',
  AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt',
  // Asia
  JP: 'ja', KR: 'ko', CN: 'zh', TW: 'zh', VN: 'vi', TH: 'th', ID: 'id',
};

/** Regions whose job ads differ from the rest of their country (GeoNames' English region names). */
const BY_REGION: Record<string, Record<string, string>> = {
  CA: { Quebec: 'fr' },
  BE: { Flanders: 'nl' },
  CH: { Geneva: 'fr', Vaud: 'fr', 'Neuchâtel': 'fr', Jura: 'fr', Fribourg: 'fr', Valais: 'fr', Ticino: 'it' },
};

/** ISO 639-1 ("de"), or undefined where job ads are mostly in English. */
export function jobAdLanguage(countryCode: string | undefined, region?: string): string | undefined {
  if (!countryCode) return undefined;
  const code = countryCode.toUpperCase();
  return (region ? BY_REGION[code]?.[region] : undefined) ?? BY_COUNTRY[code];
}

/** "de" → "German". */
export function languageName(language: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(language) ?? language;
  } catch {
    return language;
  }
}
