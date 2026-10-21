import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AshbyJobSource } from '../../../src/resume-matcher/job-sources/ashby.source';
import { LeverJobSource } from '../../../src/resume-matcher/job-sources/lever.source';
import {
  CandidateJob,
  parseBoards,
  rankByTerms,
  searchBoards,
} from '../../../src/resume-matcher/job-sources/types';

const job = (id: string, title: string, description = ''): CandidateJob => ({
  id, title, company: 'Acme', location: 'Toronto', description, source: 'ashby',
});

/** Answers each board URL from a table; unknown URLs fail like a 404. */
function serve(bodies: Record<string, unknown>) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const key = Object.keys(bodies).find((k) => url.includes(k));
    return key
      ? new Response(JSON.stringify(bodies[key]), { status: 200 })
      : new Response('not found', { status: 404 });
  });
}

beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('parseBoards', () => {
  it('reads tokens with optional display names and keeps at most eight', () => {
    expect(parseBoards(' neofinancial:Neo Financial, jobber ,,1password:1Password ')).toEqual([
      { token: 'neofinancial', company: 'Neo Financial' },
      { token: 'jobber', company: 'Jobber' },
      { token: '1password', company: '1Password' },
    ]);
    expect(parseBoards(Array.from({ length: 12 }, (_, i) => `b${i}`).join(','))).toHaveLength(8);
    expect(parseBoards(undefined)).toEqual([]);
  });

  it('reads an optional website, and ignores one that is not a plain domain', () => {
    expect(parseBoards('jobber:Jobber:GetJobber.com,jane::jane.app,bad:Bad:https://x.com/a,odd:Odd:localhost')).toEqual([
      { token: 'jobber', company: 'Jobber', domain: 'getjobber.com' },
      { token: 'jane', company: 'Jane', domain: 'jane.app' },
      { token: 'bad', company: 'Bad' },
      { token: 'odd', company: 'Odd' },
    ]);
  });
});

describe('rankByTerms', () => {
  it('puts title fits first and drops jobs that do not fit at all', () => {
    const ranked = rankByTerms(
      [
        job('a', 'Senior Recruiter', 'Hiring senior engineers.'),
        job('b', 'Frontend Engineer', 'React and TypeScript.'),
        job('c', 'Office Manager', 'Runs the office.'),
        job('d', 'Senior Frontend Engineer', ''),
      ],
      ['senior', 'frontend', 'engineer'],
    );
    expect(ranked.map((j) => j.id)).toEqual(['d', 'b', 'a']);
  });

  it('keeps every job, in order, when there is nothing to match on', () => {
    expect(rankByTerms([job('a', 'X'), job('b', 'Y')], []).map((j) => j.id)).toEqual(['a', 'b']);
  });
});

describe('searchBoards', () => {
  const boards = [
    { token: 'one', company: 'One' },
    { token: 'two', company: 'Two' },
    { token: 'three', company: 'Three' },
  ];

  it('takes from each board in turn so a late board still appears', async () => {
    const jobs = await searchBoards(
      'Test',
      boards,
      async (b) => [job(`${b.token}-1`, 'Engineer'), job(`${b.token}-2`, 'Engineer')],
      'engineer',
      4,
      () => undefined,
    );
    expect(jobs.map((j) => j.id)).toEqual(['one-1', 'two-1', 'three-1', 'one-2']);
  });

  it('skips a failing board, but fails the source when every board fails', async () => {
    const warn = jest.fn();
    const some = await searchBoards(
      'Test',
      boards,
      async (b) => {
        if (b.token === 'two') throw new Error('HTTP 404');
        return [job(b.token, 'Engineer')];
      },
      'engineer',
      10,
      warn,
    );
    expect(some.map((j) => j.id)).toEqual(['one', 'three']);
    expect(warn).toHaveBeenCalledWith('Test board "two" failed: HTTP 404');

    await expect(
      searchBoards('Test', boards, async () => { throw new Error('down'); }, 'engineer', 10, () => undefined),
    ).rejects.toThrow('every Test board failed');
  });
});

describe('AshbyJobSource', () => {
  const source = (boards: string) => new AshbyJobSource(new ConfigService({ ASHBY_BOARDS: boards }));

  it('maps listed jobs, names the company, and shows only pay the employer published', async () => {
    serve({
      'job-board/ashby-map-test': {
        jobs: [
          {
            id: 'j1', title: 'Frontend Engineer', location: 'Toronto', isListed: true,
            secondaryLocations: [{ location: 'Vancouver' }, { location: 'Montreal' }],
            jobUrl: 'https://jobs.ashbyhq.com/x/j1', descriptionPlain: 'React',
            shouldDisplayCompensationOnJobPostings: true,
            compensation: { scrapeableCompensationSalarySummary: 'CA$120K - CA$150K', compensationTierSummary: 'CA$120K – CA$150K • Offers Equity' },
          },
          {
            id: 'j2', title: 'Backend Engineer', location: 'Remote (Canada)', isListed: true,
            shouldDisplayCompensationOnJobPostings: false,
            compensation: { scrapeableCompensationSalarySummary: 'CA$1 - CA$2' },
          },
          { id: 'j3', title: 'Hidden Engineer', location: 'Toronto', isListed: false },
        ],
      },
    });

    const jobs = await source('ashby-map-test:Neo Financial').search({ query: 'engineer', location: '', limit: 10 });
    expect(jobs).toEqual([
      {
        id: 'ashby:ashby-map-test:j1', title: 'Frontend Engineer', company: 'Neo Financial',
        location: 'Toronto (+2 more)', description: 'React', url: 'https://jobs.ashbyhq.com/x/j1',
        salary: 'CA$120K - CA$150K', source: 'ashby',
      },
      expect.objectContaining({ id: 'ashby:ashby-map-test:j2', location: 'Remote (Canada)', salary: undefined }),
    ]);
  });

  it('is off with no boards configured', () => {
    expect(source('').isEnabled()).toBe(false);
  });
});

describe('LeverJobSource', () => {
  it("treats Lever's 200 {ok:false} for an unknown handle as a failure", async () => {
    serve({ 'postings/lever-gone-test': { ok: false, error: 'Document not found' } });
    const lever = new LeverJobSource(new ConfigService({ LEVER_COMPANIES: 'lever-gone-test' }));
    await expect(lever.search({ query: 'engineer', location: '', limit: 10 })).rejects.toThrow('every Lever board failed');
  });
});
