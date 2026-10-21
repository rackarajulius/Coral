import { ConfigService } from '@nestjs/config';
import { JSearchJobSource } from '../../../src/resume-matcher/job-sources/jsearch.source';
import { cleanCompanyName, domainSpellsName, siteDomain } from '../../../src/resume-matcher/job-sources/types';

describe('employer names', () => {
  it.each([
    ['Vector Institute   This link will open in a new window', 'Vector Institute'],
    ['Acme (opens in new window)', 'Acme'],
    ['Acme Corp - Opens in a new tab.', 'Acme Corp'],
    ['Zero​Width Inc.', 'ZeroWidth Inc.'],
    ['OpenTable', 'OpenTable'],
    ['K&K Global Talent Solutions INC.', 'K&K Global Talent Solutions INC.'],
  ])('%j reads %j', (raw, clean) => {
    expect(cleanCompanyName(raw)).toBe(clean);
  });
});

describe('websites', () => {
  it.each([
    ['https://www.Randstad.com/careers', 'randstad.com'],
    ['tangerine.net', 'tangerine.net'],
    ['ftp://files.example.com', undefined],
    ['not a url at all', undefined],
    [undefined, undefined],
  ])('%j is %j', (url, domain) => {
    expect(siteDomain(url)).toBe(domain);
  });

  it.each([
    ['Tangerine', 'tangerine.net', true],
    ['Identity Digital', 'identity.digital', true],
    ['Randstad', 'randstad.com', true],
    // A listing's website can be someone else's.
    ['DoorDash Canada', 'doordashcanada.publicfirst.co', false],
    ['Stikeman Elliott LLP', 'stikeman.com', false],
  ])('%s spells %s: %s', (company, domain, expected) => {
    expect(domainSpellsName(company, domain)).toBe(expected);
  });
});

describe('JSearch listings', () => {
  // Trimmed from a real /search-v2 answer (2026-10-15).
  const sample = {
    data: {
      jobs: [
        {
          job_id: 'a', job_title: 'AI Software Engineer', job_publisher: 'Job Bank',
          employer_name: 'Vector Institute   This link will open in a new window',
          employer_logo: 'https://t0.gstatic.com/images?q=tbn:vector', employer_website: null,
        },
        {
          job_id: 'b', job_title: 'Staff Engineer - Android', job_publisher: 'LinkedIn',
          employer_name: 'Tangerine', employer_website: 'https://tangerine.net',
          employer_logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:tangerine',
        },
        {
          job_id: 'c', job_title: 'Staff Software Engineer', job_publisher: 'Indeed',
          employer_name: 'DoorDash Canada', employer_website: 'https://doordashcanada.publicfirst.co',
          employer_logo: 'https://t0.gstatic.com/images?q=tbn:doordash',
        },
      ],
    },
  };

  it('cleans names, trusts only a website that spells the name, and keeps logo and publisher', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(sample)));
    const jobs = await new JSearchJobSource(new ConfigService({ RAPID_API_KEY: 'k' })).search({
      query: 'software engineer names test', location: 'Toronto', limit: 15,
    });
    expect(jobs.map((j) => [j.company, j.companyDomain, j.publisher, !!j.logoImageUrl])).toEqual([
      ['Vector Institute', undefined, 'Job Bank', true],
      ['Tangerine', 'tangerine.net', 'LinkedIn', true],
      ['DoorDash Canada', undefined, 'Indeed', true],
    ]);
    jest.restoreAllMocks();
  });
});
