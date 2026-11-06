import { CompanyRole, OfferStatus, SubscriptionStatus } from '@prisma/client';
import { CompanyStatusService, DELETION_GRACE_DAYS } from '../../../src/company/company-status.service';
import { User } from '../../../src/common/types/user.types';

function collaborator<T>(value: unknown): T { return value as T; }

const OWNER = { id: 'owner', firstName: 'Ada', lastName: 'Lovelace' } as User;
const DAY = 24 * 60 * 60 * 1000;

function harness(opts: {
  role?: CompanyRole;
  deactivatedAt?: Date | null;
  deletesAt?: Date | null;
  subscription?: SubscriptionStatus | null;
  openOffers?: number;
} = {}) {
  const company = {
    id: 'company-a', name: 'Acme', pageId: 'page-a', deletionRequestedById: 'owner',
    deactivatedAt: opts.deactivatedAt === undefined ? new Date() : opts.deactivatedAt,
    deletesAt: opts.deletesAt ?? null,
    page: { companyLogo: 'https://cdn.example/acme.png' },
  };
  const tx = {
    job: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    post: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    employerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), delete: jest.fn().mockResolvedValue({}) },
    company: { delete: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    company: {
      findUnique: jest.fn().mockImplementation(async () => company),
      update: jest.fn().mockImplementation(async ({ data }) => { Object.assign(company, data); return company; }),
      findMany: jest.fn().mockResolvedValue([{ id: 'company-a' }]),
    },
    companySubscription: { findUnique: jest.fn().mockResolvedValue(opts.subscription ? { status: opts.subscription } : null) },
    offer: { count: jest.fn().mockResolvedValue(opts.openOffers ?? 0) },
    companyMember: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'owner' }, { userId: 'recruiter' }, { userId: 'elsewhere' }]),
      // "elsewhere" belongs to an older company: their jobs are that company's.
      findFirst: jest.fn().mockImplementation(async ({ where }) => ({ companyId: where.userId === 'elsewhere' ? 'company-b' : 'company-a' })),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
  const context = {
    requireForUser: jest.fn().mockResolvedValue({
      companyId: 'company-a', companyName: 'Acme', role: opts.role ?? CompanyRole.OWNER, memberUserIds: ['owner'],
    }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new CompanyStatusService(collaborator(prisma), collaborator(context), collaborator(audit), collaborator(notifications));
  return { service, prisma, tx, audit, notifications, company };
}

describe('Deleting a company page for good', () => {
  it(`asks for the name, and sets the deletion ${DELETION_GRACE_DAYS} days out`, async () => {
    const { service, prisma, audit } = harness();
    await expect(service.scheduleDeletion(OWNER, 'Acme Inc')).rejects.toThrow("Type the company's name, Acme");
    const before = Date.now();
    const status = await service.scheduleDeletion(OWNER, '  acme ');
    const when = (prisma.company.update.mock.calls[0][0].data.deletesAt as Date).getTime();
    expect(when - before).toBeGreaterThanOrEqual(DELETION_GRACE_DAYS * DAY - 1000);
    expect(when - before).toBeLessThanOrEqual(DELETION_GRACE_DAYS * DAY + 1000);
    expect(status).toMatchObject({ deletesAt: expect.any(Date), canManage: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'Scheduled company page deletion' }));
  });

  it('only for a deactivated page, and only by its owner', async () => {
    await expect(harness({ deactivatedAt: null }).service.scheduleDeletion(OWNER, 'Acme')).rejects.toThrow('Deactivate the page first');
    await expect(harness({ role: CompanyRole.ADMIN }).service.scheduleDeletion(OWNER, 'Acme')).rejects.toThrow("Only the company's owner");
  });

  it('refuses while a paid plan runs or an offer waits for an answer, and says what to do', async () => {
    await expect(harness({ subscription: SubscriptionStatus.ACTIVE }).service.scheduleDeletion(OWNER, 'Acme'))
      .rejects.toThrow('Cancel your paid plan in Billing first.');
    await expect(harness({ openOffers: 2 }).service.scheduleDeletion(OWNER, 'Acme'))
      .rejects.toThrow("2 offers are still waiting for a candidate's answer.");
    // A cancelled plan is no obstacle.
    await expect(harness({ subscription: SubscriptionStatus.CANCELED }).service.scheduleDeletion(OWNER, 'Acme')).resolves.toBeDefined();
    const { prisma } = harness({ openOffers: 1 });
    await expect(new CompanyStatusService(collaborator(prisma), collaborator({}), collaborator({}), collaborator({})).deletionBlockers('company-a'))
      .resolves.toEqual(["1 offer is still waiting for a candidate's answer. Withdraw it or wait for an answer."]);
    expect(prisma.offer.count).toHaveBeenCalledWith({ where: { companyId: 'company-a', status: OfferStatus.SENT } });
  });

  it('can be called off, and reactivating calls it off too', async () => {
    const { service, prisma } = harness({ deletesAt: new Date(Date.now() + DAY) });
    await service.cancelDeletion(OWNER);
    expect(prisma.company.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { deletesAt: null, deletionRequestedById: null } }));
    await service.reactivate(OWNER);
    expect(prisma.company.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { deactivatedAt: null, deactivatedById: null, deletesAt: null, deletionRequestedById: null },
    }));
  });

  it("when the day comes: keeps the company's jobs, closed and named, and removes the page, its posts and the company", async () => {
    const { service, tx, notifications } = harness({ deletesAt: new Date(Date.now() - 1000) });
    await expect(service.deleteCompanyNow('company-a')).resolves.toBe(true);
    // Only the people whose jobs are this company's.
    expect(tx.job.updateMany).toHaveBeenCalledWith({
      where: { postedById: { in: ['owner', 'recruiter'] }, companyName: null }, data: { companyName: 'Acme' },
    });
    expect(tx.job.updateMany).toHaveBeenCalledWith({
      where: { postedById: { in: ['owner', 'recruiter'] }, companyLogo: null }, data: { companyLogo: 'https://cdn.example/acme.png' },
    });
    expect(tx.job.updateMany).toHaveBeenCalledWith({
      where: { postedById: { in: ['owner', 'recruiter'] }, status: { in: ['active'] } }, data: { status: 'closed' },
    });
    expect(tx.post.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'company-a' } });
    // Members' own rows go private rather than standing in for the company.
    expect(tx.employerProfile.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'company-a', id: { not: 'page-a' } }, data: { visibility: 'private', companyId: null },
    });
    expect(tx.employerProfile.delete).toHaveBeenCalledWith({ where: { id: 'page-a' } });
    expect(tx.company.delete).toHaveBeenCalledWith({ where: { id: 'company-a' } });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', title: "Acme's page was deleted" }));
  });

  it('waits when the day has not come, the page was reactivated, or something is in the way', async () => {
    await expect(harness({ deletesAt: new Date(Date.now() + DAY) }).service.deleteCompanyNow('company-a')).resolves.toBe(false);
    await expect(harness({ deletesAt: new Date(Date.now() - 1000), deactivatedAt: null }).service.deleteCompanyNow('company-a')).resolves.toBe(false);

    const blocked = harness({ deletesAt: new Date(Date.now() - 1000), subscription: SubscriptionStatus.ACTIVE });
    await expect(blocked.service.deleteCompanyNow('company-a')).resolves.toBe(false);
    expect(blocked.tx.company.delete).not.toHaveBeenCalled();
    expect(blocked.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      title: "Acme's page wasn't deleted yet", message: "Cancel your paid plan in Billing first. We'll try again tomorrow.",
    }));
  });
});
