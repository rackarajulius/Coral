import { Logger } from '@nestjs/common';
import { CitiesService, normalizePlace } from '../../../src/locations/cities.service';
import { cityOf, meansRemote } from '../../../src/locations/place-text';

// The real GeoNames list (src/locations/data): what people will actually be offered.
const cities = new CitiesService();
const labels = (q: string, near?: string, limit = 5) => cities.search(q, { near, limit }).map((c) => c.label);

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  cities.search('warm up');
});
afterAll(() => jest.restoreAllMocks());

describe('normalizePlace', () => {
  it.each([
    ['Montréal', 'montreal'],
    ["St. John's", 'st johns'],
    ['Saint-Jérôme', 'st jerome'],
    ['Sainte-Foy', 'ste foy'],
    ['  Mount   Pearl ', 'mt pearl'],
  ])('%j → %j', (raw, key) => expect(normalizePlace(raw)).toBe(key));
});

describe('city search', () => {
  it('puts the best-known city first', () => {
    expect(labels('tor')[0]).toBe('Toronto, ON');
    expect(labels('kam')[0]).toBe('Kampala, Uganda');
  });

  it("puts the person's own country first", () => {
    expect(labels('lon')[0]).toBe('London, United Kingdom');
    expect(labels('lon', 'CA')[0]).toBe('London, ON');
    expect(labels('kam', 'UG').slice(0, 2)).toEqual(['Kampala, Uganda', 'Kamuli, Uganda']);
  });

  it('narrows by province, state or country after a comma', () => {
    expect(labels('london, on')).toEqual(['London, ON']);
    expect(labels('london, uk')[0]).toBe('London, United Kingdom');
    expect(labels('springfield, il')).toEqual(['Springfield, IL']);
    expect(labels('kampala, ug')).toEqual(['Kampala, Uganda']);
  });

  it('finds names however they are typed', () => {
    expect(labels('montreal')[0]).toBe('Montréal, QC');
    expect(labels('st johns')[0]).toBe("St. John's, NL");
    expect(labels('saint john')[0]).toBe('Saint John, NB');
    expect(labels('quebec city')[0]).toBe('Québec, QC');
    expect(labels('etobi')[0]).toBe('Etobicoke, ON');
  });

  it('describes a suggestion fully', () => {
    expect(cities.search('vancouver', { near: 'CA', limit: 1 })[0]).toEqual({
      name: 'Vancouver', region: 'British Columbia', regionCode: 'BC', countryCode: 'CA', country: 'Canada', label: 'Vancouver, BC',
    });
  });

  it('keeps to the limit and ignores empty input', () => {
    expect(cities.search('s', { limit: 50 })).toHaveLength(15);
    expect(cities.search('  ,  ')).toEqual([]);
    expect(cities.search('zzqqxx')).toEqual([]);
  });
});

describe('what a written place means', () => {
  const read = (text: string, near?: string) => {
    const r = cities.readPlace(text, near);
    if (!r) return 'nothing';
    if (r.kind === 'city') return `city ${r.city.label}`;
    return r.kind === 'region' ? `region ${r.region}, ${r.country}` : `country ${r.country}`;
  };

  it('reads a province as the province, though a city elsewhere has its name', () => {
    // "Ontario" is also a city in California: these were all searched there.
    expect(read('ONTARIO CANADA')).toBe('region Ontario, Canada');
    expect(read('Ontario, Canada')).toBe('region Ontario, Canada');
    expect(read('Ontario', 'CA')).toBe('region Ontario, Canada');
    expect(read('ON', 'CA')).toBe('region Ontario, Canada');
    expect(read('Ontario', 'US')).toBe('city Ontario, CA');
  });

  it('reads states and countries written alone', () => {
    expect(read('Texas')).toBe('region Texas, United States');
    expect(read('Bavaria')).toBe('region Bavaria, Germany');
    expect(read('Canada')).toBe('country Canada');
    expect(read('UGANDA')).toBe('country Uganda');
  });

  it('still reads cities as cities', () => {
    expect(read('Toronto, Ontario, Canada')).toBe('city Toronto, ON');
    expect(read('London, Canada')).toBe('city London, ON');
    expect(read('Paris, Texas')).toBe('city Paris, TX');
    expect(read('Atlanta, Georgia', 'US')).toBe('city Atlanta, GA');
    expect(read('Kampala')).toBe('city Kampala, Uganda');
    expect(read('Remote')).toBe('nothing');
  });

  it('places job listings that name a province the same way', () => {
    expect(cities.countryOfText('Ontario, Canada')).toBe('CA');
    expect(cities.countryOfText('ONTARIO CANADA')).toBe('CA');
    expect(cities.countryOfText('Ontario', 'CA')).toBe('CA');
    expect(cities.countryOfText('Atlanta, Georgia', 'US')).toBe('US');
    expect(cities.countryOfText('Tbilisi, Georgia')).toBe('GE');
    expect(cities.countryOfText('Berlin', 'CA')).toBe('DE');
  });
});

describe('currencies', () => {
  it("knows each country's, for pay a listing states without one", () => {
    expect([cities.currencyOf('CA'), cities.currencyOf('ug'), cities.currencyOf('DE'), cities.currencyOf('GB')]).toEqual(['CAD', 'UGX', 'EUR', 'GBP']);
    expect(cities.currencyOf('ZZ')).toBeUndefined();
    expect(cities.currencyOf(undefined)).toBeUndefined();
  });
});

describe('reading free-text locations from profiles', () => {
  it('resolves a city name, preferring the profile country', () => {
    expect(cities.resolve('Toronto')?.countryCode).toBe('CA');
    expect(cities.resolve('London', 'Canada')?.label).toBe('London, ON');
    expect(cities.resolve('london', 'GB')?.countryCode).toBe('GB');
    expect(cities.resolve('Kampala', 'UG')?.label).toBe('Kampala, Uganda');
  });

  it('gives nothing for text that is not a city', () => {
    expect(cities.resolve('ONTARIO CANADA')).toBeUndefined();
    expect(cities.resolve('')).toBeUndefined();
  });

  it.each([
    ['Calgary, AB', 'UG', 'CA'],
    ['Toronto Headquarters', 'UG', 'CA'],
    ['Edmonton (+3 more)', 'UG', 'CA'],
    ['Remote (Canada)', 'UG', 'CA'],
    ['Berlin', 'CA', 'DE'],
    ['Sydney', 'CA', 'AU'],
    ['Atlanta, Georgia', 'CA', 'US'],
    ['Kampala, UG', 'UG', 'UG'],
    ['Burnaby, Greater Vancouver', 'CA', 'CA'],
    ['Canada/US', 'US', 'US'],
    ['Canada/US', 'CA', 'CA'],
    ['Remote', 'UG', undefined],
    ['Anywhere', 'CA', undefined],
  ])("reads a job's location %j (searching %s) as %s", (text, near, expected) => {
    expect(cities.countryOfText(text, near)).toBe(expected);
  });

  it('reads "Remote" and a place\'s city part without the list', () => {
    expect(cityOf('Toronto, ON')).toBe('Toronto');
    expect(cityOf('  Kampala  ')).toBe('Kampala');
    expect(meansRemote('Remote')).toBe(true);
    expect(meansRemote(' remote work')).toBe(true);
    expect(meansRemote('Remotely, ON')).toBe(false);
  });

  it('reads country codes and names', () => {
    expect(cities.countryCodeOf('Canada')).toBe('CA');
    expect(cities.countryCodeOf('ug')).toBe('UG');
    expect(cities.countryCodeOf('Narnia')).toBeUndefined();
  });
});
