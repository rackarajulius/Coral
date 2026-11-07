import { ConfigService } from '@nestjs/config';
import { isPremiumEnforced } from '../../../src/auth/guards/premium.guard';
import { User } from '../../../src/common/types/user.types';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SeekerEntitlementsService } from '../../../src/seeker-entitlements/seeker-entitlements.service';

const config = (value?: string) => new ConfigService(value === undefined ? {} : { PREMIUM_ENFORCEMENT: value });

describe('switching Premium on', () => {
  it('is off for everything until set', () => {
    expect(isPremiumEnforced(config())).toBe(false);
    expect(isPremiumEnforced(config(), 'matcher.web')).toBe(false);
    expect(isPremiumEnforced(config('false'), 'matcher.web')).toBe(false);
  });

  it('gates everything with "true"', () => {
    expect(isPremiumEnforced(config('true'))).toBe(true);
    expect(isPremiumEnforced(config('true'), 'assist.cover_letter')).toBe(true);
  });

  it('gates only the features listed, one at a time', () => {
    const someOn = config(' matcher.web , research.company ');
    expect(isPremiumEnforced(someOn, 'matcher.web')).toBe(true);
    expect(isPremiumEnforced(someOn, 'research.company')).toBe(true);
    expect(isPremiumEnforced(someOn, 'assist.cover_letter')).toBe(false);
    expect(isPremiumEnforced(someOn, 'coach.session')).toBe(false);
    // Asked about everything at once: no, only some is on.
    expect(isPremiumEnforced(someOn)).toBe(false);
  });
});

describe('a job seeker on the free plan, with only web matching gated', () => {
  const free = { id: 'u1', role: 'JOB_SEEKER', subscriptionTier: 'free' } as User;
  const entitlements = new SeekerEntitlementsService(
    { userUsage: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService,
    config('matcher.web'),
  );

  it('is refused web matching, and nothing else', async () => {
    await expect(entitlements.assertAllowed(free, 'matcher.web')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PREMIUM_REQUIRED', metric: 'matcher.web' }),
    });
    await expect(entitlements.assertAllowed(free, 'assist.cover_letter')).resolves.toBeUndefined();
    await expect(entitlements.assertAllowed(free, 'coach.session')).resolves.toBeUndefined();
  });

  it('says per feature which limits apply, so the page can tell them apart', async () => {
    const snapshot = await entitlements.snapshot(free);
    expect(snapshot.enforced).toBe(false);
    expect(Object.fromEntries(snapshot.metrics.map((m) => [m.metric, m.enforced]))).toEqual({
      'coach.session': false,
      'matcher.web': true,
      'assist.cover_letter': false,
      'assist.tailor': false,
      'research.company': false,
    });
  });
});
