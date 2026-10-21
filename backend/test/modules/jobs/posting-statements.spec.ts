import {
  asksForCanadianExperience,
  payRangeTooWide,
  postingStatements,
  statesPay,
} from '../../../src/jobs/posting-statements';

describe('what a posting states', () => {
  it('counts a figure or a range as stated pay, and the form\'s zero as none', () => {
    expect(statesPay({ salaryMin: 60000, salaryMax: 80000 })).toBe(true);
    expect(statesPay({ salaryMin: null, salaryMax: 25 })).toBe(true);
    expect(statesPay({ salaryMin: null, salaryMax: null })).toBe(false);
    expect(statesPay({ salaryMin: 0, salaryMax: 0 })).toBe(false);
  });

  it('flags a yearly range wider than $50,000, below the $200,000 the rule stops at', () => {
    expect(payRangeTooWide({ salaryMin: 60000, salaryMax: 120000, salaryPeriod: 'yearly' })).toBe(true);
    expect(payRangeTooWide({ salaryMin: 60000, salaryMax: 110000, salaryPeriod: 'yearly' })).toBe(false);
    expect(payRangeTooWide({ salaryMin: 60000, salaryMax: 120000, salaryPeriod: null })).toBe(true);
    // Above the ceiling, and pay that isn't yearly, the limit doesn't apply.
    expect(payRangeTooWide({ salaryMin: 150000, salaryMax: 250000, salaryPeriod: 'yearly' })).toBe(false);
    expect(payRangeTooWide({ salaryMin: 20, salaryMax: 90000, salaryPeriod: 'hourly' })).toBe(false);
    expect(payRangeTooWide({ salaryMin: null, salaryMax: 120000, salaryPeriod: 'yearly' })).toBe(false);
  });

  it('finds "Canadian experience" however it is put', () => {
    expect(asksForCanadianExperience('2+ years of Canadian work experience required')).toBe(true);
    expect(asksForCanadianExperience(null, ['Must have Canadian experience'])).toBe(true);
    expect(asksForCanadianExperience('Experience working in Canada is an asset')).toBe(true);
    expect(asksForCanadianExperience('Expérience canadienne requise')).toBe(true);
    expect(asksForCanadianExperience('Serve Canadian customers; 3 years of experience in sales')).toBe(false);
    expect(asksForCanadianExperience(undefined, [])).toBe(false);
  });

  it('carries the statements wherever the posting goes', () => {
    expect(postingStatements({ existingVacancy: true, usesAi: false })).toEqual([
      'This posting is for an existing vacancy.',
    ]);
    expect(postingStatements({ existingVacancy: false, usesAi: true })).toEqual([
      'This posting is not for an existing vacancy: it gathers candidates for future openings.',
      'Artificial intelligence is used to screen, assess or select applicants for this position.',
    ]);
    expect(postingStatements({ existingVacancy: null, usesAi: false })).toEqual([]);
  });
});
