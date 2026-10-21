import {
  employmentTypeOf,
  formatPay,
  isoDate,
  workplaceFromText,
  workplaceOf,
  yearlyPay,
} from '../../../src/resume-matcher/job-sources/types';

describe('job type, as each source words it', () => {
  it.each([
    ['FULLTIME', 'full_time'],          // JSearch
    [['FULLTIME', 'CONTRACTOR'], 'full_time'],
    ['Full-time permanent', 'full_time'], // Lever
    ['FullTime', 'full_time'],          // Ashby
    ['full-time', 'full_time'],         // Coral
    ['part_time', 'part_time'],         // Adzuna
    ['PartTime', 'part_time'],
    ['Intern', 'internship'],
    ['internship', 'internship'],
    ['Contract', 'contract'],
    ['CONTRACTOR', 'contract'],
    ['Temporary', 'temporary'],
    ['Volunteer', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('%j is %j', (raw, expected) => {
    expect(employmentTypeOf(raw as string | string[] | undefined)).toBe(expected);
  });
});

describe('workplace', () => {
  it.each([
    ['OnSite', 'onsite'], ['on-site', 'onsite'], ['In office', 'onsite'],
    ['Hybrid', 'hybrid'], ['remote', 'remote'], ['unspecified', undefined], [null, undefined],
  ])('stated as %j is %j', (raw, expected) => {
    expect(workplaceOf(raw)).toBe(expected);
  });

  it.each([
    ['Remote (Canada)', 'remote'],
    ['Toronto (Hybrid)', 'hybrid'],
    ['Toronto, Ontario', undefined], // silence is not "on-site"
    ['Remotely Piloted Systems Engineer', undefined],
  ])('read from %j is %j', (text, expected) => {
    expect(workplaceFromText(text)).toBe(expected);
  });
});

describe('pay as a card shows it', () => {
  it.each([
    [[120000, 150000, 'CAD'], 'C$120k–C$150k'],
    [[45000, 60000, 'eur'], '€45k–€60k'],
    [[25, 30, 'USD', 'HOUR'], 'US$25–US$30/hr'],
    [[4000, undefined, 'GBP', 'MONTH'], '£4k/mo'],
    [[2500000, 3000000, 'UGX'], 'UGX 2,500k–UGX 3,000k'],
    [[50000, 50000, 'AUD'], 'A$50k'],
    // No currency known: no sign, rather than a guessed one (it used to say CAD everywhere).
    [[50000, 70000, undefined], '50k–70k'],
  ] as const)('%j → %s', (args, shown) => {
    const [min, max, currency, period] = args as unknown as [number, number | undefined, string | undefined, string | undefined];
    expect(formatPay(min, max, currency, period)).toBe(shown);
  });

  it('shows nothing without a number', () => {
    expect(formatPay(undefined, null, 'USD')).toBeUndefined();
    expect(formatPay(0, 0, 'USD')).toBeUndefined();
  });
});

describe('pay, per year', () => {
  it('turns hourly, monthly and yearly pay into yearly figures', () => {
    expect(yearlyPay(25, 26.5, '1 HOUR', 'cad')).toEqual({ min: 52000, max: 55120, currency: 'CAD' });
    expect(yearlyPay(5000, null, 'per-month-salary', 'USD')).toEqual({ min: 60000, currency: 'USD' });
    expect(yearlyPay(116000, 145000, '1 YEAR', 'CAD')).toEqual({ min: 116000, max: 145000, currency: 'CAD' });
    expect(yearlyPay(80000, 90000, null)).toEqual({ min: 80000, max: 90000 });
  });

  it('has nothing to say without a number', () => {
    expect(yearlyPay(null, undefined, 'YEAR')).toBeUndefined();
    expect(yearlyPay(0, 0, 'YEAR')).toBeUndefined();
  });
});

describe('dates', () => {
  it('reads ISO strings and epoch milliseconds', () => {
    expect(isoDate('2026-09-23T08:53:39-04:00')).toBe('2026-09-23T12:53:39.000Z');
    expect(isoDate(1786646472936)).toBe(new Date(1786646472936).toISOString());
    expect(isoDate('not a date')).toBeUndefined();
    expect(isoDate(null)).toBeUndefined();
  });
});
