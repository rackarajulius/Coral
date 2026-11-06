import { ForbiddenException } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole } from '@prisma/client';
import { CompanyStatusService } from '../../../src/company/company-status.service';
import { handOverCompanies, describeDeparture } from '../../../src/company/company-departure';
import { EmployerVerificationService } from '../../../src/employers/employer-verification.service';
import { User } from '../../../src/common/types/user.types';

function collaborator<T>(value: unknown): T { return value as T; }

const OWNER = { id: 'owner', firstName: 'Ada', lastName: 'Lovelace' } as User;

describe('Deactivating a company page', () => {
  function harness(role: CompanyRole = CompanyRole.OWNER, deactivatedAt: Date | null = null) {
    const state = { deactivatedAt };
    const tx = {
      company: { update: jest.fn().mockImplementation(async ({ data }) => { state.deactivatedAt = data.deactivatedAt; return {}; }) },
      job: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const prisma = {
      company: {
        findUnique: jest.fn().mockImplementation(async () => ({ name: 'Acme', deactivatedAt: state.deactivatedAt })),
        update: jest.fn().mockImplementation(async ({ data }) => { state.deactivatedAt = data.deactivatedAt; return { name: 'Acme' }; }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const context = {
      requireForUser: jest.fn().mockResolvedValue({
        companyId: 'company-a', companyName: 'Acme', role, memberUserIds: ['owner', 'recruiter', 'left'],
      }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new CompanyStatusService(collaborator(prisma), collaborator(context), collaborator(audit), collaborator(notifications));
    return { service, prisma, tx, audit, state };
  }

  it("takes the page down and closes every member's live jobs, saying how many", async () => {
    const { service, tx, audit } = harness();
    const result = await service.deactivate(OWNER);
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'company-a' },
      data: { deactivatedAt: expect.any(Date), deactivatedById: 'owner' },
    });
    expect(tx.job.updateMany).toHaveBeenCalledWith({
      where: { postedById: { in: ['owner', 'recruiter', 'left'] }, status: { in: ['active'] } },
      data: { status: 'closed' },
    });
    expect(result).toMatchObject({ jobsClosed: 3, canManage: true, deactivatedAt: expect.any(Date) });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'Deactivated company page', summary: 'Ada Lovelace deactivated the company page and closed 3 live jobs.',
    }));
  });

  it('does nothing twice, and brings the page back on reactivation', async () => {
    const { service, tx, prisma } = harness(CompanyRole.OWNER, new Date());
    await expect(service.deactivate(OWNER)).resolves.toMatchObject({ jobsClosed: 0 });
    expect(tx.job.updateMany).not.toHaveBeenCalled();
    await expect(service.reactivate(OWNER)).resolves.toMatchObject({ deactivatedAt: null });
    // Reactivating also calls off any scheduled deletion.
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deactivatedAt: null, deactivatedById: null, deletesAt: null, deletionRequestedById: null },
    }));
  });

  it('is the owner\'s alone, as LinkedIn keeps it to super admins', async () => {
    for (const role of [CompanyRole.ADMIN, CompanyRole.RECRUITER]) {
      const { service, tx } = harness(role);
      await expect(service.deactivate(OWNER)).rejects.toThrow(ForbiddenException);
      await expect(service.reactivate(OWNER)).rejects.toThrow("Only the company's owner");
      expect(tx.company.update).not.toHaveBeenCalled();
      await expect(service.status(OWNER)).resolves.toMatchObject({ canManage: false });
    }
  });

  it('answers visitors and followers with "not found" while it is down', async () => {
    const PAGE = '22222222-2222-4222-8222-222222222222';
    const prisma = {
      employerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: PAGE, userId: 'owner', companyId: 'company-a', visibility: 'public', allowFollow: true,
          pageOf: { id: 'company-a', deactivatedAt: new Date() }, company: { domain: null },
        }),
      },
    };
    const { EmployersService } = await import('../../../src/employers/employers.service');
    const employers = new EmployersService(collaborator(prisma), collaborator({}), collaborator({}));
    await expect(employers.getCompanyById(PAGE)).rejects.toThrow('Company profile not found');
    await expect(employers.followCompany('visitor', PAGE)).rejects.toThrow('Company profile not found');
  });

  it('stops anyone at the company posting jobs or contacting candidates while it is down', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          employerProfile: null,
          companyMemberships: [{ company: { page: { verificationStatus: 'verified', pageOf: { deactivatedAt: new Date() } } } }],
        }),
      },
    };
    await expect(new EmployerVerificationService(collaborator(prisma)).assertCanReachCandidates('recruiter'))
      .rejects.toThrow("Your company's page is deactivated");
  });
});

describe("Deleting an account that holds a company's page", () => {
  /** A company where `leaver` holds the page, with the given teammates. */
  function db(opts: {
    leaverRole?: CompanyRole;
    teammates?: Array<{ userId: string; role: CompanyRole; ownRow?: { id: string; jobTitle: string; isOtherPage?: boolean } }>;
  }) {
    const teammates = opts.teammates ?? [];
    return {
      companyMember: {
        findMany: jest.fn().mockImplementation(async ({ where }) => where.userId === 'leaver'
          ? [{ companyId: 'company-a', role: opts.leaverRole ?? CompanyRole.OWNER, company: { name: 'Acme', pageId: 'page-a', deactivatedAt: null } }]
          : teammates.map((t) => ({
              userId: t.userId,
              role: t.role,
              user: {
                firstName: t.userId, lastName: null, displayName: null,
                employerProfile: t.ownRow ? { id: t.ownRow.id, jobTitle: t.ownRow.jobTitle, pageOf: t.ownRow.isOtherPage ? { id: 'other-co' } : null } : null,
              },
            }))),
        update: jest.fn().mockResolvedValue({}),
      },
      company: { update: jest.fn().mockResolvedValue({}) },
      employerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'page-a' }),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      job: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
  }

  it('hands the page, ownership and their jobs to an admin, before a recruiter who joined earlier', async () => {
    const store = db({
      teammates: [
        { userId: 'recruiter', role: CompanyRole.RECRUITER },
        { userId: 'admin', role: CompanyRole.ADMIN, ownRow: { id: 'admin-copy', jobTitle: 'Head of People' } },
      ],
    });
    const outcomes = await handOverCompanies(collaborator(store), 'leaver');
    expect(outcomes).toEqual([{ companyId: 'company-a', companyName: 'Acme', outcome: 'handed_over', successorName: 'admin' }]);
    expect(store.companyMember.update).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: 'company-a', userId: 'admin' } }, data: { role: CompanyRole.OWNER },
    });
    // The page row itself changes hands, so its followers and address stay.
    expect(store.employerProfile.delete).toHaveBeenCalledWith({ where: { id: 'admin-copy' } });
    expect(store.employerProfile.update).toHaveBeenCalledWith({
      where: { id: 'page-a' },
      data: { userId: 'admin', jobTitle: 'Head of People', isRecruiter: false, isHiringManager: false, isAdmin: false },
    });
    expect(store.job.updateMany).toHaveBeenCalledWith({ where: { postedById: 'leaver' }, data: { postedById: 'admin' } });
    expect(describeDeparture(outcomes)).toBe('Acme passed to admin');
  });

  it('passes over a teammate whose own row is another company\'s page', async () => {
    const store = db({
      teammates: [
        { userId: 'busy-owner', role: CompanyRole.OWNER, ownRow: { id: 'busy-row', jobTitle: '', isOtherPage: true } },
        { userId: 'recruiter', role: CompanyRole.RECRUITER },
      ],
    });
    await expect(handOverCompanies(collaborator(store), 'leaver')).resolves.toMatchObject([{ successorName: 'recruiter' }]);
    expect(store.employerProfile.delete).not.toHaveBeenCalled();
  });

  it('deactivates the company when nobody else is left, instead of leaving half a page', async () => {
    const store = db({ teammates: [] });
    const outcomes = await handOverCompanies(collaborator(store), 'leaver');
    expect(outcomes).toEqual([{ companyId: 'company-a', companyName: 'Acme', outcome: 'deactivated' }]);
    expect(store.company.update).toHaveBeenCalledWith({
      where: { id: 'company-a' }, data: { deactivatedAt: expect.any(Date), deactivatedById: null },
    });
    expect(store.job.updateMany).not.toHaveBeenCalled();
    expect(describeDeparture(outcomes)).toBe('Acme deactivated (no one else on the team)');
  });

  it('leaves alone an account in no company', async () => {
    const store = db({});
    store.companyMember.findMany.mockResolvedValue([]);
    await expect(handOverCompanies(collaborator(store), 'leaver')).resolves.toEqual([]);
    expect(store.employerProfile.findUnique).not.toHaveBeenCalled();
    // Only the leaver's own memberships were asked about.
    expect(store.companyMember.findMany.mock.calls[0][0].where.status.in)
      .toEqual([CompanyMemberStatus.ACTIVE, CompanyMemberStatus.SUSPENDED]);
  });
});
