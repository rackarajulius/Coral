import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthService } from '../../../src/auth/auth.service';
import { User } from '../../../src/common/types/user.types';
import { PrismaService } from '../../../src/prisma/prisma.service';

const caller = (id = 'member', role: UserRole = UserRole.JOB_SEEKER) => ({ id, role } as User);

function harness(role: UserRole = UserRole.JOB_SEEKER, status: UserStatus = UserStatus.PENDING_ONBOARDING) {
  const fresh = { id: 'member', role, status };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'member' }]),
    user: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...fresh })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...fresh, ...data })),
    },
  };
  const prisma = {
    // A stale pre-lock snapshot must not participate in authorization or writes.
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'member', role: UserRole.JOB_SEEKER, status: UserStatus.PENDING_ONBOARDING }),
      update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'member', ...data })),
    },
    $transaction: jest.fn().mockImplementation((work) => work(tx)),
  };
  const service = new AuthService(prisma as unknown as PrismaService, {} as ConfigService);
  return { service, prisma, tx, fresh };
}

describe('Phase 1 role selection: locked pending-account eligibility', () => {
  it.each([UserRole.JOB_SEEKER, UserRole.EMPLOYER, UserRole.FREELANCER])(
    'allows a default pending account to choose %s while keeping onboarding pending', async (newRole) => {
      const { service, prisma, tx } = harness();
      expect(await service.updateUserRole('member', newRole, caller())).toMatchObject({ role: newRole, status: UserStatus.PENDING_ONBOARDING });
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'member' }, data: { role: newRole } });
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.user.findUnique.mock.invocationCallOrder[0]);
      expect(tx.user.findUnique.mock.invocationCallOrder[0]).toBeLessThan(tx.user.update.mock.invocationCallOrder[0]);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it('rejects a stale pending snapshot after concurrent onboarding activates the locked account', async () => {
    const { service, prisma, tx, fresh } = harness();
    tx.$queryRaw.mockImplementation(async () => {
      // The competing onboarding request committed before this lock became available.
      fresh.role = UserRole.FREELANCER;
      fresh.status = UserStatus.ACTIVE;
      return [{ id: fresh.id }];
    });
    await expect(service.updateUserRole('member', UserRole.EMPLOYER, caller())).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { id: 'member' } });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED])(
    'does not allow self-service role changes for a %s account', async (status) => {
      const { service, tx } = harness(UserRole.JOB_SEEKER, status);
      await expect(service.updateUserRole('member', UserRole.FREELANCER, caller())).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.user.update).not.toHaveBeenCalled();
    },
  );

  it('does not let a pending member change someone else\'s role', async () => {
    const { service, tx } = harness();
    await expect(service.updateUserRole('member', UserRole.EMPLOYER, caller('other'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('never allows self-service administrator selection', async () => {
    const { service, tx } = harness();
    await expect(service.updateUserRole('member', UserRole.ADMIN, caller())).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each([
    { before: UserRole.FREELANCER, requested: UserRole.EMPLOYER },
    { before: UserRole.EMPLOYER, requested: UserRole.JOB_SEEKER },
  ])('preserves a previously selected pending type ($before → $requested)', async ({ before, requested }) => {
    const { service, tx } = harness(before);
    await expect(service.updateUserRole('member', requested, caller('member', before))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('allows an idempotent repeat of an already selected pending account type', async () => {
    const { service } = harness(UserRole.FREELANCER);
    expect(await service.updateUserRole('member', UserRole.FREELANCER, caller('member', UserRole.FREELANCER)))
      .toMatchObject({ role: UserRole.FREELANCER, status: UserStatus.PENDING_ONBOARDING });
  });

  it.each([UserRole.JOB_SEEKER, UserRole.EMPLOYER, UserRole.FREELANCER, UserRole.ADMIN])(
    'preserves administrator authority to set %s on an existing active account', async (newRole) => {
      const { service, tx } = harness(UserRole.EMPLOYER, UserStatus.ACTIVE);
      expect(await service.updateUserRole('member', newRole, caller('admin', UserRole.ADMIN)))
        .toMatchObject({ role: newRole, status: UserStatus.ACTIVE });
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'member' }, data: { role: newRole } });
    },
  );

  it('retains not-found behavior for a missing target, including an administrator', async () => {
    const { service, tx } = harness();
    tx.user.findUnique.mockResolvedValue(null);
    await expect(service.updateUserRole('member', UserRole.FREELANCER, caller('admin', UserRole.ADMIN))).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('Explicit default administrator provisioning', () => {
  const formerDefaultEmail = 'rackarajulius@gmail.com';
  const identity = { id: 'auth-member', email: formerDefaultEmail, email_confirmed_at: '2026-10-08T00:00:00Z' };
  type Lookup = 'new' | 'existing' | 'relinked';

  function provisioningHarness(configuredEmail: string | undefined, lookup: Lookup, role: UserRole = UserRole.JOB_SEEKER) {
    const existing = {
      id: 'member', supabaseId: identity.id, email: identity.email, role,
      status: role === UserRole.ADMIN ? UserStatus.ACTIVE : UserStatus.PENDING_ONBOARDING,
      lastLoginAt: null,
    };
    const prisma = { user: {
      findUnique: jest.fn()
        .mockResolvedValueOnce(lookup === 'existing' ? existing : null)
        .mockResolvedValueOnce(lookup === 'relinked' ? existing : null),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'member', ...data })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data })),
    } };
    const config = { get: jest.fn().mockReturnValue(configuredEmail) };
    const service = new AuthService(prisma as unknown as PrismaService, config as unknown as ConfigService);
    return { service, prisma, existing };
  }

  it.each([undefined, '', ' \t '])('does not grant the formerly hardcoded email administrator access with config %j', async (configuredEmail) => {
    for (const lookup of ['new', 'existing', 'relinked'] as const) {
      const { service, prisma } = provisioningHarness(configuredEmail, lookup);
      await expect(service.findOrCreateUser(identity, async () => true)).resolves.toMatchObject({
        role: UserRole.JOB_SEEKER, status: UserStatus.PENDING_ONBOARDING,
      });
      if (lookup === 'new') {
        expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
          role: UserRole.JOB_SEEKER, status: UserStatus.PENDING_ONBOARDING,
        }) }));
      } else {
        expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('role');
        expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('status');
      }
    }
  });

  it.each(['new', 'existing', 'relinked'] as const)('grants an explicitly configured matching email administrator access for %s accounts', async (lookup) => {
    const { service } = provisioningHarness(' RACKARAJULIUS@GMAIL.COM ', lookup);
    await expect(service.findOrCreateUser(identity, async () => true)).resolves.toMatchObject({
      role: UserRole.ADMIN, status: UserStatus.ACTIVE,
    });
  });

  it('keeps a nonmatching new account in candidate onboarding', async () => {
    const { service } = provisioningHarness('controlled-admin@example.test', 'new');
    await expect(service.findOrCreateUser(identity, async () => true)).resolves.toMatchObject({
      role: UserRole.JOB_SEEKER, status: UserStatus.PENDING_ONBOARDING,
    });
  });

  it('preserves an existing administrator when no provisioning email is configured', async () => {
    const { service, prisma } = provisioningHarness(undefined, 'existing', UserRole.ADMIN);
    await expect(service.findOrCreateUser(identity)).resolves.toMatchObject({ role: UserRole.ADMIN, status: UserStatus.ACTIVE });
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('role');
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('status');
  });

  it('does not promote a recently seen candidate when provisioning is disabled', async () => {
    const { service, prisma, existing } = provisioningHarness('', 'existing');
    prisma.user.findUnique.mockReset().mockResolvedValue({ ...existing, lastLoginAt: new Date() });
    await expect(service.findOrCreateUser(identity)).resolves.toMatchObject({
      role: UserRole.JOB_SEEKER, status: UserStatus.PENDING_ONBOARDING,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
