/**
 * Builds the city list behind location autocomplete (src/locations/data/cities.tsv.gz).
 *
 * From GeoNames (https://www.geonames.org, CC BY 4.0 — commercial use allowed
 * with credit, which is in the site footer). Download into a fresh folder:
 *   https://download.geonames.org/export/dump/cities1000.zip   (extract it)
 *   https://download.geonames.org/export/dump/admin1CodesASCII.txt
 *   https://download.geonames.org/export/dump/countryInfo.txt
 * then:
 *   npx ts-node --transpile-only scripts/build-city-index.ts \
 *     <cities1000.txt> <admin1CodesASCII.txt> <countryInfo.txt> src/locations/data/cities.tsv.gz
 *
 * Output lines, tab-separated:
 *   C  <country code>  <country name>  <currency (ISO 4217)>
 *   R  <country.admin1>  <region name>  <abbreviation or empty>
 *   P  <name>  <country code>  <admin1 code>  <population>  <"x" for a district of a larger city>  <search key>
 *
 * Places are written sorted by search key, with the key included, so the
 * server neither normalizes nor sorts 150,000 names when it starts.
 */
import { readFileSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { normalizePlace } from '../src/locations/cities.service';

const [citiesPath, admin1Path, countryPath, outPath] = process.argv.slice(2);
if (!citiesPath || !admin1Path || !countryPath || !outPath) {
  console.error('usage: build-city-index.ts <cities1000.txt> <admin1CodesASCII.txt> <countryInfo.txt> <out.tsv.gz>');
  process.exit(1);
}

/** Abandoned, historical and destroyed places are not where anyone works. */
const SKIP_FEATURES = new Set(['PPLQ', 'PPLH', 'PPLW', 'PPLCH']);
/** Kept even when GeoNames has no population for them: capitals and province/county seats. */
const ALWAYS_KEEP = new Set(['PPLC', 'PPLA', 'PPLA2']);

/** GeoNames gives Canadian provinces numeric codes (Ontario is 08); people write ON. */
const CA_ABBREVIATIONS: Record<string, string> = {
  Alberta: 'AB', 'British Columbia': 'BC', Manitoba: 'MB', 'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL', 'Northwest Territories': 'NT', 'Nova Scotia': 'NS',
  Nunavut: 'NU', Ontario: 'ON', 'Prince Edward Island': 'PE', Quebec: 'QC',
  Saskatchewan: 'SK', Yukon: 'YT',
};

const clean = (s: string) => s.replace(/[\t\r\n]/g, ' ').trim();

const countries = new Map<string, { name: string; currency: string }>();
for (const line of readFileSync(countryPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('\t');
  // Column 11 is the currency: a job listing that states pay without one is in it.
  if (f[0] && f[4]) countries.set(f[0], { name: clean(f[4]), currency: clean(f[10] ?? '') });
}

const regions = new Map<string, { name: string; abbr: string }>();
for (const line of readFileSync(admin1Path, 'utf8').split('\n')) {
  if (!line) continue;
  const [key, name] = line.split('\t');
  if (!key || !name) continue;
  const [cc, code] = key.split('.');
  // US states already use postal codes; Canada's are mapped by name.
  const abbr = cc === 'CA' ? CA_ABBREVIATIONS[name] ?? '' : cc === 'US' && /^[A-Z]{2}$/.test(code) ? code : '';
  regions.set(key, { name: clean(name), abbr });
}

const places: Array<{ key: string; line: string }> = [];
const usedRegions = new Set<string>();
const usedCountries = new Set<string>();
for (const line of readFileSync(citiesPath, 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const [name, feature, cc, admin1, population] = [clean(f[1]), f[7], f[8], f[10], Number(f[14]) || 0];
  if (!name || !cc || SKIP_FEATURES.has(feature)) continue;
  if (population < 1000 && !ALWAYS_KEEP.has(feature)) continue;
  const key = normalizePlace(name);
  if (!key) continue;
  const regionKey = `${cc}.${admin1}`;
  if (regions.has(regionKey)) usedRegions.add(regionKey);
  usedCountries.add(cc);
  const district = feature === 'PPLX' ? 'x' : '';
  places.push({ key, line: ['P', name, cc, regions.has(regionKey) ? admin1 : '', String(population), district, key].join('\t') });
}
places.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

const out = [
  `# GeoNames cities1000, ${places.length} places, built ${new Date().toISOString().slice(0, 10)}. CC BY 4.0, https://www.geonames.org`,
  ...[...usedCountries].sort().map((cc) => ['C', cc, countries.get(cc)?.name ?? cc, countries.get(cc)?.currency ?? ''].join('\t')),
  ...[...usedRegions].sort().map((key) => ['R', key, regions.get(key)!.name, regions.get(key)!.abbr].join('\t')),
  ...places.map((p) => p.line),
].join('\n');

writeFileSync(outPath, gzipSync(Buffer.from(out, 'utf8'), { level: 9 }));
console.log(`${places.length} places, ${usedRegions.size} regions, ${usedCountries.size} countries -> ${outPath}`);
