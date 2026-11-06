import { CompanyMemberStatus, CompanyRole } from '@prisma/client';
import {
  canonicalPageId,
  companyPageId,
  postersByPage,
  shownProfile,
  withShownEmployer,
} from '../../../src/company/company-page';
import { EmployerVerificationService } from '../../../src/employers/employer-verification.service';
import { EmployersService } from '../../../src/employers/employers.service';
import { User } from '../../../src/common/types/user.types';

function collaborator<T>(value: unknown): T { return value as T; }

const OWNER = 'owner-user';
const ADMIN = 'admin-user';
const RECRUITER = 'recruiter-user';

/** How a user comes back when their company's page is selected beside their own row. */
const seated = <P>(own: P | null, page: P | null) => ({
  employerProfile: own,
  companyMemberships: page === undefined ? [] : [{ company: { page } }],
});

describe('Which profile a person is shown under', () => {
  it("is their company's page, not their own copy of it", () => {
    expect(shownProfile(seated({ companyName: 'My copy' }, { companyName: 'Acme' }))).toEqual({ companyName: 'Acme' });
  });

  it('is their own profile when they have no company, or their company has no page yet', () => {
    expect(shownProfile({ employerProfile: { companyName: 'Solo' }, companyMemberships: [] })).toEqual({ companyName: 'Solo' });
    expect(shownProfile(seated({ companyName: 'Mine' }, null))).toEqual({ companyName: 'Mine' });
    expect(shownProfile({ employerProfile: null, companyMemberships: [] })).toBeNull();
    expect(shownProfile(null)).toBeNull();
  });

  it("gives a job its company's page and drops the lookup, so clients read the field they always read", () => {
    const job = { id: 'job', postedBy: { id: RECRUITER, ...seated({ companyName: 'New Company' }, { companyName: 'Acme' }) } };
    const shown = withShownEmployer(job);
    expect(shown.postedBy).toEqual({ id: RECRUITER, employerProfile: { companyName: 'Acme' } });
    expect('companyMemberships' in shown.postedBy).toBe(false);
    // Records that never asked for the page pass through untouched.
    const plain = { id: 'job', postedBy: { id: OWNER, employerProfile: { companyName: 'Acme' } } };
    expect(withShownEmployer(plain)).toBe(plain);
    expect(withShownEmployer({ id: 'job' })).toEqual({ id: 'job' });
  });
});

describe("A company's page", () => {
  function db(pageId: string | null, linked: Array<{ id: string; visibility: string }> = []) {
    const company = {
      findUnique: jest.fn().mockImplementation(async ({ where }) => where.id === 'company-a' ? { pageId } : null),
      updateMany: jest.fn().mockImplementation(async () => { pageId = pageId ?? linked.find((p) => p.visibility !== 'private')?.id ?? linked[0]?.id ?? null; return { count: 1 }; }),
    };
    const employerProfile = {
      findMany: jest.fn().mockResolvedValue(linked),
      findUnique: jest.fn(),
    };
    return { company, employerProfile };
  }

  it('is the one the company points at', async () => {
    const store = db('page-a');
    await expect(companyPageId(collaborator(store), 'company-a')).resolves.toBe('page-a');
    expect(store.company.updateMany).not.toHaveBeenCalled();
  });

  it('is adopted when missing — the oldest linked profile that is not private — and only while still empty', async () => {
    const store = db(null, [{ id: 'private-old', visibility: 'private' }, { id: 'public-next', visibility: 'unlisted' }]);
    await expect(companyPageId(collaborator(store), 'company-a')).resolves.toBe('public-next');
    expect(store.employerProfile.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-a' }, select: { id: true, visibility: true }, orderBy: { createdAt: 'asc' },
    });
    expect(store.company.updateMany).toHaveBeenCalledWith({
      where: { id: 'company-a', pageId: null }, data: { pageId: 'public-next' },
    });
  });

  it('is nothing for a company that does not exist, or has nobody to adopt', async () => {
    await expect(companyPageId(collaborator(db('page-a')), 'company-z')).resolves.toBeNull();
    await expect(companyPageId(collaborator(db(null, [])), 'company-a')).resolves.toBeNull();
  });

  it("is what any member's profile stands for, so an old link lands on the company", async () => {
    const store = db('page-a');
    const rows: Record<string, unknown> = {
      'copy-of-recruiter': { id: 'copy-of-recruiter', companyId: 'company-a', pageOf: null },
      'page-a': { id: 'page-a', companyId: 'company-a', pageOf: { id: 'company-a' } },
      // A page whose person has left keeps standing for itself.
      'page-left': { id: 'page-left', companyId: null, pageOf: { id: 'company-b' } },
      'solo': { id: 'solo', companyId: null, pageOf: null },
    };
    store.employerProfile.findUnique.mockImplementation(async ({ where }) => rows[where.id] ?? null);
    await expect(canonicalPageId(collaborator(store), 'copy-of-recruiter')).resolves.toBe('page-a');
    await expect(canonicalPageId(collaborator(store), 'page-a')).resolves.toBe('page-a');
    await expect(canonicalPageId(collaborator(store), 'page-left')).resolves.toBe('page-left');
    await expect(canonicalPageId(collaborator(store), 'solo')).resolves.toBe('solo');
    await expect(canonicalPageId(collaborator(store), 'missing')).resolves.toBeNull();
  });

  it("shows everyone's jobs whose work is the company's, and a sole operator's own", async () => {
    const store = {
      company: { findMany: jest.fn().mockResolvedValue([{ id: 'company-a', pageId: 'page-a' }]) },
      companyMember: {
        findMany: jest.fn().mockResolvedValue([
          { companyId: 'company-a', userId: OWNER },
          { companyId: 'company-a', userId: RECRUITER },
          { companyId: 'company-a', userId: 'left-user' },
        ]),
      },
    };
    const posters = await postersByPage(collaborator(store), [
      { id: 'page-a', userId: OWNER },
      { id: 'solo', userId: 'solo-user' },
    ]);
    expect(posters.get('page-a')).toEqual([OWNER, RECRUITER, 'left-user']);
    expect(posters.get('solo')).toEqual(['solo-user']);
    // Removed and suspended members' jobs stay the company's (the fan-out rule).
    expect(store.companyMember.findMany.mock.calls[0][0].where.status.in).toEqual([
      CompanyMemberStatus.ACTIVE, CompanyMemberStatus.SUSPENDED, CompanyMemberStatus.REMOVED,
    ]);
  });
});

describe("Verification is the company's", () => {
  function verificationFor(seat: { role: CompanyRole; status?: CompanyMemberStatus } | null, own: string | null, page: string | null) {
    const prisma = {
      companyMember: {
        findFirst: jest.fn().mockResolvedValue(seat && {
          role: seat.role, status: seat.status ?? CompanyMemberStatus.ACTIVE, company: { name: 'Acme', domain: null },
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(seated(
          own === null ? null : { id: 'own', companyName: 'New Company', companyWebsite: null, verificationStatus: own },
          seat && page !== null ? { id: 'page-a', companyName: 'Acme', companyWebsite: 'acme.com', verificationStatus: page } : null,
        )),
      },
      employerProfile: { update: jest.fn() },
    };
    return { prisma, service: new EmployerVerificationService(collaborator(prisma)) };
  }
  const recruiter = { id: RECRUITER, email: 'r@acme.com', emailVerified: true } as User;

  it('clears a recruiter at a verified company to hire, whatever their own row says', async () => {
    const { service } = verificationFor({ role: CompanyRole.RECRUITER }, 'unverified', 'verified');
    await expect(service.assertCanReachCandidates(RECRUITER)).resolves.toBeUndefined();
  });

  it("holds back everyone at an unverified company, even someone whose own row was verified", async () => {
    const { service } = verificationFor({ role: CompanyRole.RECRUITER }, 'verified', 'unverified');
    await expect(service.assertCanReachCandidates(RECRUITER)).rejects.toThrow('Verify your company');
  });

  it('tells a recruiter an owner or admin verifies the company, and offers them nothing they cannot do', async () => {
    const { service } = verificationFor({ role: CompanyRole.RECRUITER }, null, 'unverified');
    await expect(service.status(recruiter)).resolves.toMatchObject({
      level: 'unverified', canManage: false, canAutoVerify: false, needsDocuments: false,
      reason: "Acme isn't verified yet, so jobs can't be posted. An owner or admin can verify it.",
    });
    await expect(service.verifyDomain(recruiter)).rejects.toThrow('owner or admin');
  });

  it("lets an admin verify the company's page instantly when their address matches its website", async () => {
    const { prisma, service } = verificationFor({ role: CompanyRole.ADMIN }, null, 'unverified');
    const admin = { id: ADMIN, email: 'a@acme.com', emailVerified: true } as User;
    await expect(service.status(admin)).resolves.toMatchObject({ canManage: true, canAutoVerify: true });
    await service.verifyDomain(admin);
    expect(prisma.employerProfile.update).toHaveBeenCalledWith({
      where: { id: 'page-a' }, data: { verificationStatus: 'domain_verified' },
    });
  });

  it("offers the document route to anyone who can't verify instantly, not only free-mail addresses", async () => {
    const { service } = verificationFor({ role: CompanyRole.OWNER }, null, 'unverified');
    const owner = { id: OWNER, email: 'o@elsewhere.com', emailVerified: true } as User;
    await expect(service.status(owner)).resolves.toMatchObject({
      canAutoVerify: false, needsDocuments: true,
      reason: "Your email domain (elsewhere.com) doesn't match your website, so we need a document.",
    });
  });
});

describe("Editing and visiting the company's page", () => {
  // A teammate's own profile, by id — the address their jobs used to link to.
  const COPY = '11111111-1111-4111-8111-111111111111';
  const PAGE = {
    id: 'page-a', userId: OWNER, companyId: 'company-a', companyName: 'Acme', visibility: 'public',
    verificationStatus: 'verified', user: { id: OWNER, email: 'o@acme.com' }, company: { domain: null },
  };

  function employers() {
    const prisma = {
      companyMember: {
        findFirst: jest.fn().mockResolvedValue({ companyId: 'company-a', status: CompanyMemberStatus.ACTIVE, company: { name: 'Acme' } }),
        findMany: jest.fn().mockResolvedValue([{ companyId: 'company-a', userId: OWNER }, { companyId: 'company-a', userId: RECRUITER }]),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ pageId: 'page-a' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'company-a', pageId: 'page-a' }]),
      },
      employerProfile: {
        findUnique: jest.fn().mockImplementation(async ({ where }) =>
          where.id === 'page-a' ? PAGE
            : where.id === COPY ? { id: COPY, companyId: 'company-a', pageOf: null }
              : null),
        update: jest.fn().mockImplementation(async ({ data }) => ({ ...PAGE, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      job: { groupBy: jest.fn().mockResolvedValue([{ postedById: OWNER, _count: { _all: 1 } }, { postedById: RECRUITER, _count: { _all: 2 } }]) },
      companyFollow: { count: jest.fn().mockResolvedValue(5) },
    };
    const audit = { recordForUserId: jest.fn().mockResolvedValue(undefined) };
    return { prisma, service: new EmployersService(collaborator(prisma), collaborator({}), collaborator(audit)) };
  }

  it("puts an admin's edit on the page everyone sees, and their job title on their own row", async () => {
    const { prisma, service } = employers();
    await service.updateMyCompany({ id: ADMIN, email: 'a@acme.com' }, { tagline: 'We build things', jobTitle: 'Head of People' });
    const pageUpdate = prisma.employerProfile.update.mock.calls[0][0];
    expect(pageUpdate.where).toEqual({ id: 'page-a' });
    expect(pageUpdate.data).toMatchObject({ tagline: 'We build things' });
    expect(pageUpdate.data).not.toHaveProperty('jobTitle');
    expect(prisma.employerProfile.updateMany).toHaveBeenCalledWith({ where: { userId: ADMIN }, data: { jobTitle: 'Head of People' } });
  });

  it("answers a teammate's old link with the company's page, counting every member's live jobs", async () => {
    const { prisma, service } = employers();
    const page = await service.getCompanyById(COPY);
    expect(page).toMatchObject({ id: 'page-a', companyName: 'Acme', openJobs: 3, followerCount: 5 });
    // Live jobs are 'active'; counting 'published' showed 0 for every company.
    expect(prisma.job.groupBy.mock.calls[0][0].where).toEqual({
      postedById: { in: [OWNER, RECRUITER] }, status: { in: ['active'] },
    });
  });

  it('follows the page, whichever member profile the button was on', async () => {
    const { service } = employers();
    const follows: unknown[] = [];
    const store = (service as unknown as { prisma: Record<string, unknown> }).prisma;
    store.companyFollow = {
      upsert: jest.fn().mockImplementation(async (args) => { follows.push(args); return {}; }),
      findUnique: jest.fn().mockResolvedValue({ id: 'f' }),
      count: jest.fn().mockResolvedValue(1),
    };
    PAGE.userId = OWNER;
    (store.employerProfile as { findUnique: jest.Mock }).findUnique.mockImplementation(async ({ where }) =>
      where.id === 'page-a' ? { ...PAGE, allowFollow: true }
        : where.id === COPY ? { id: COPY, companyId: 'company-a', pageOf: null }
          : null);
    await service.followCompany('visitor', COPY);
    expect(follows[0]).toMatchObject({ create: { userId: 'visitor', companyId: 'page-a' } });
  });
});
