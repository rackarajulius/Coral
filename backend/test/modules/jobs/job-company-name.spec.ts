import { jobCompanyName } from '../../../src/jobs/job-company-name';

describe('the company a job is shown under', () => {
  const employer = (companyName: string | null) => ({ employerProfile: { companyName } });

  it("an ordinary posting takes the employer's company name", () => {
    expect(jobCompanyName({ companyName: null, postedBy: employer('MTN UGANDA') })).toBe('MTN UGANDA');
  });

  it("a name an admin set for the job wins, as on the job page", () => {
    expect(jobCompanyName({ companyName: 'Acme', postedBy: employer('Admin Co') })).toBe('Acme');
  });

  it('blank names are no names', () => {
    expect(jobCompanyName({ companyName: '  ', postedBy: employer(' Globex ') })).toBe('Globex');
    expect(jobCompanyName({ companyName: '', postedBy: employer('   ') })).toBeNull();
    expect(jobCompanyName({ companyName: null, postedBy: { employerProfile: null } })).toBeNull();
    expect(jobCompanyName({ companyName: null, postedBy: null })).toBeNull();
  });
});
