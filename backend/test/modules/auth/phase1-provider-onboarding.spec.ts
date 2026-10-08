import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuthService } from '../../../src/auth/auth.service';
import { AuthController } from '../../../src/auth/auth.controller';
import type { AccountClosureService } from '../../../src/auth/account-closure.service';
import type { User } from '../../../src/common/types/user.types';
import { AppValidationPipe } from '../../../src/common/pipes/validation.pipe';

function harness(role = 'FREELANCER') {
  const pending = { id: 'member', role, status: 'PENDING_ONBOARDING' };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'member' }]),
    user: {
      findUnique: jest.fn().mockResolvedValue(pending),
      update: jest.fn().mockResolvedValue({ ...pending, status: 'ACTIVE' }),
    },
    freelancerProfile: { upsert: jest.fn() },
    jobSeekerProfile: { upsert: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(pending) },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
  };
  return { tx, prisma, service: new AuthService(prisma as unknown as PrismaService, {} as ConfigService) };
}

describe('Phase 1 legacy provider onboarding', () => {
  it('rejects explicit null profile data at the controller validation boundary', async () => {
    const types = Reflect.getMetadata('design:paramtypes', AuthController.prototype, 'completeOnboarding');
    const metatype = types[0];
    const pipe = new AppValidationPipe();
    await expect(pipe.transform({ role: 'FREELANCER', profileData: null }, { type: 'body', metatype })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ role: 'FREELANCER' }, { type: 'body', metatype })).resolves.toMatchObject({ role: 'FREELANCER' });
  });
  it('finishes a legacy provider in a private draft without overwriting historical statistics', async () => {
    const { service, tx } = harness();
    await service.completeOnboarding('member', 'FREELANCER', { headline: 'Designer', skills: ['UX'] });
    expect(tx.freelancerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'member' },
      create: expect.objectContaining({ userId: 'member', providerEnabled: true, publicPreviewEnabled: false, currency: 'CAD' }),
      update: { headline: 'Designer', skills: ['UX'], providerEnabled: true, publicPreviewEnabled: false },
    });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'member' }, data: { role: 'FREELANCER', status: 'ACTIVE' } });
    expect(tx.jobSeekerProfile.upsert).not.toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.user.findUnique.mock.invocationCallOrder[0]);
  });

  it.each([
    { completedProjects: 100 }, { rating: 5 }, { totalEarnings: 100000 },
    { publicPreviewEnabled: true }, { providerEnabled: true },
    { user: { connect: { id: 'other' } } }, { skills: null }, { availableForRemote: 'false' },
  ])('rejects self-declared trust, visibility or malformed provider fields: %j', async (payload) => {
    const { service, tx } = harness();
    await expect(service.completeOnboarding('member', 'FREELANCER', payload)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each([null, [], 'profile'])('rejects non-object profile data: %j', async (payload) => {
    const { service, prisma } = harness();
    await expect(service.completeOnboarding('member', 'FREELANCER', payload as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'FREELANCER', status: 'ACTIVE' },
    { role: 'EMPLOYER', status: 'PENDING_ONBOARDING' },
    { role: 'JOB_SEEKER', status: 'SUSPENDED' },
    null,
  ])('rechecks the locked account before creating a profile: %j', async (freshAccount) => {
    const { service, tx } = harness();
    tx.user.findUnique.mockResolvedValue(freshAccount);
    await expect(service.completeOnboarding('member', 'FREELANCER')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('keeps ordinary jobseeker onboarding on its existing profile path', async () => {
    const { service, tx } = harness('JOB_SEEKER');
    await service.completeOnboarding('member', 'JOB_SEEKER', { headline: 'Software developer' });
    expect(tx.jobSeekerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'member' }, create: { userId: 'member', headline: 'Software developer' }, update: { headline: 'Software developer' },
    });
    expect(tx.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'member' }, data: { role: 'JOB_SEEKER', status: 'ACTIVE' } });
  });

  it('preserves Canada pilot fields from validated onboarding to both profile upsert paths', async () => {
    const { service, tx } = harness('JOB_SEEKER');
    const profileData = {
      headline: 'Software professional', city: 'Toronto', state: 'Ontario', country: 'Canada',
      experienceLevel: 'mid', jobTypes: ['contract'], remotePreference: 'Remote', remoteWork: true,
      preferredIndustries: ['Technology'],
    };
    const metatype = Reflect.getMetadata('design:paramtypes', AuthController.prototype, 'completeOnboarding')[0];
    const dto = await new AppValidationPipe().transform(
      { role: 'JOB_SEEKER', profileData: structuredClone(profileData) }, { type: 'body', metatype },
    );
    // The production whitelist must retain the contents of the nested object.
    expect(dto).toEqual({ role: 'JOB_SEEKER', profileData });
    const controller = new AuthController(service, {} as AccountClosureService);
    const result = await controller.completeOnboarding(dto, { id: 'member' } as User);
    expect(tx.jobSeekerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'member' }, create: { ...profileData, userId: 'member' }, update: profileData,
    });
    expect(tx.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(result.data.user).toMatchObject({ role: 'JOB_SEEKER', status: 'ACTIVE' });
  });
});
