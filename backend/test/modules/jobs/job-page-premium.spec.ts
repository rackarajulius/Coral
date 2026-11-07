import { NotFoundException } from '@nestjs/common';
import { User } from '../../../src/common/types/user.types';
import { JobsController } from '../../../src/jobs/jobs.controller';
import { EntitlementException } from '../../../src/seeker-entitlements/entitlement.exception';

const seeker = { id: 'seeker-1', role: 'JOB_SEEKER' } as User;
const JOB_ID = '11111111-1111-4111-8111-111111111111';

const refusal = (metric: 'assist.tailor' | 'research.company') =>
  new EntitlementException({
    code: 'PREMIUM_REQUIRED',
    metric,
    tier: 'free',
    resetsAt: null,
    message: 'Premium includes it.',
  });

/**
 * Tailoring and company research on a job page are the same Premium features
 * as on the matcher, so they answer to the same allowance.
 */
describe('Premium tools on a job page', () => {
  const jobsService = { getVisibleJobEntity: jest.fn() };
  const jobFit = { tailorForJob: jest.fn() };
  const research = { research: jest.fn() };
  const entitlements = { assertAllowed: jest.fn(), record: jest.fn() };
  const controller = new JobsController(
    jobsService as never,
    {} as never,
    {} as never,
    jobFit as never,
    research as never,
    entitlements as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    entitlements.assertAllowed.mockResolvedValue(undefined);
    entitlements.record.mockResolvedValue(undefined);
    jobsService.getVisibleJobEntity.mockResolvedValue({ id: JOB_ID, companyName: 'Acme', title: 'Nurse' });
  });

  it('tailors only within the allowance, and counts it afterwards', async () => {
    jobFit.tailorForJob.mockResolvedValue({ tailoredSummary: 'x' });

    await expect(controller.tailorForJob(seeker, JOB_ID)).resolves.toEqual({
      success: true,
      data: { tailoredSummary: 'x' },
    });
    expect(entitlements.assertAllowed).toHaveBeenCalledWith(seeker, 'assist.tailor');
    expect(entitlements.record).toHaveBeenCalledWith('seeker-1', 'assist.tailor');
  });

  it('a refused tailoring spends nothing', async () => {
    entitlements.assertAllowed.mockRejectedValue(refusal('assist.tailor'));

    await expect(controller.tailorForJob(seeker, JOB_ID)).rejects.toBeInstanceOf(EntitlementException);
    expect(jobFit.tailorForJob).not.toHaveBeenCalled();
    expect(entitlements.record).not.toHaveBeenCalled();
  });

  it('a failed tailoring is not counted', async () => {
    jobFit.tailorForJob.mockRejectedValue(new Error('AI down'));

    await expect(controller.tailorForJob(seeker, JOB_ID)).rejects.toThrow('AI down');
    expect(entitlements.record).not.toHaveBeenCalled();
  });

  it('researches the company within the allowance, and counts a real lookup', async () => {
    research.research.mockResolvedValue({ configured: true, profile: { summary: 's' }, sources: [] });

    await controller.companyResearch(seeker, JOB_ID);
    expect(jobsService.getVisibleJobEntity).toHaveBeenCalledWith(JOB_ID, seeker);
    expect(entitlements.assertAllowed).toHaveBeenCalledWith(seeker, 'research.company');
    expect(research.research).toHaveBeenCalledWith('Acme', 'Nurse');
    expect(entitlements.record).toHaveBeenCalledWith('seeker-1', 'research.company');
  });

  it("researches an ordinary posting under its employer's company name", async () => {
    jobsService.getVisibleJobEntity.mockResolvedValue({
      id: JOB_ID,
      companyName: null,
      title: 'Front desk receptionist',
      postedBy: { employerProfile: { companyName: 'MTN UGANDA' } },
    });
    research.research.mockResolvedValue({ configured: true, profile: { summary: 's' }, sources: [] });

    await controller.companyResearch(seeker, JOB_ID);
    expect(research.research).toHaveBeenCalledWith('MTN UGANDA', 'Front desk receptionist');
  });

  it('a refused research makes no crawl', async () => {
    entitlements.assertAllowed.mockRejectedValue(refusal('research.company'));

    await expect(controller.companyResearch(seeker, JOB_ID)).rejects.toBeInstanceOf(EntitlementException);
    expect(research.research).not.toHaveBeenCalled();
  });

  it('nothing found, or no provider set up, is not counted', async () => {
    research.research.mockResolvedValue({ configured: true, profile: null, sources: [] });
    await controller.companyResearch(seeker, JOB_ID);
    research.research.mockResolvedValue({ configured: false, profile: null, sources: [] });
    await controller.companyResearch(seeker, JOB_ID);

    expect(entitlements.record).not.toHaveBeenCalled();
  });

  it('a job without a company name, or one the reader cannot see, uses no allowance', async () => {
    jobsService.getVisibleJobEntity.mockResolvedValueOnce({ id: JOB_ID, companyName: '  ', title: 'Nurse' });
    await expect(controller.companyResearch(seeker, JOB_ID)).resolves.toMatchObject({ data: { profile: null } });

    jobsService.getVisibleJobEntity.mockResolvedValueOnce(null);
    await expect(controller.companyResearch(seeker, JOB_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(entitlements.assertAllowed).not.toHaveBeenCalled();
  });
});
