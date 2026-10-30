import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyMemberStatus, CompanyRole, UserRole, UserStatus } from '@prisma/client';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { Roles } from '../../../src/common/decorators/roles.decorator';
import { User } from '../../../src/common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from '../../../src/company/company-capability.guard';
import { CompanyContextService } from '../../../src/company/company-context.service';
import { CompanyEnrolmentService } from '../../../src/company/company-enrolment.service';
import { AboutCandidate, SelfReviewGuard } from '../../../src/company/self-review.guard';
import { CandidateSourcingService } from '../../../src/employer-hiring/candidate-sourcing.service';
import { OutreachService } from '../../../src/employer-hiring/outreach.service';
import { JobSeekersService } from '../../../src/job-seekers/job-seekers.service';
import { MessagingService } from '../../../src/messaging/messaging.service';
import { OnboardingService } from '../../../src/employers/onboarding.service';
import { AuthController } from '../../../src/auth/auth.controller';

/**
 * One account, as on LinkedIn: company powers follow a seat, not the account
 * type — and the privacy walls that has to bring with it.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const ME = '11111111-1111-4111-8111-111111111111';
const COLLEAGUE = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const APPLICATION = '44444444-4444-4444-8444-444444444444';

const person = (role: UserRole, status: UserStatus = UserStatus.ACTIVE) =>
  ({ id: ME, role, status }) as User;
const seat = (role: CompanyRole = CompanyRole.RECRUITER, status: CompanyMemberStatus = CompanyMemberStatus.ACTIVE) =>
  ({ companyId: 'company-a', role, status, company: { id: 'company-a', name: 'Acme' } });

class Routes {
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  companyRead() {}

  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @RequiresCapability('candidates:write')
  companyWrite() {}

  @Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
  personal() {}

  @Roles(UserRole.EMPLOYER, UserRole.JOB_SEEKER, UserRole.ADMIN)
  @RequiresCapability('messaging:write')
  shared() {}

  @AboutCandidate('candidate', 'params.candidateId')
  aboutCandidate() {}

  @AboutCandidate('application', 'body.applicationIds')
  bulk() {}

  unmarked() {}
}

function context(handler: keyof Routes, user: User, request: Record<string, unknown> = {}) {
  const req = { user, params: {}, body: {}, ...request };
  return {
    getClass: () => Routes,
    getHandler: () => Routes.prototype[handler],
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function companyContext(membership: ReturnType<typeof seat> | null, colleagues = [ME, COLLEAGUE]) {
  return {
    membershipFor: jest.fn().mockResolvedValue(membership),
    memberUserIds: jest.fn().mockResolvedValue(colleagues),
    colleagueIds: jest.fn().mockResolvedValue(colleagues),
  };
}

describe('Roles: what you can do follows what you are', () => {
  const guard = (membership: ReturnType<typeof seat> | null) => {
    const ctx = companyContext(membership);
    return { roles: new RolesGuard(new Reflector(), collaborator(ctx)), ctx };
  };

  it('lets a job seeker act for a company only through an active seat', async () => {
    await expect(guard(seat()).roles.canActivate(context('companyRead', person(UserRole.JOB_SEEKER)))).resolves.toBe(true);
    await expect(guard(null).roles.canActivate(context('companyRead', person(UserRole.JOB_SEEKER))))
      .rejects.toBeInstanceOf(ForbiddenException);
    for (const status of [CompanyMemberStatus.SUSPENDED, CompanyMemberStatus.REMOVED]) {
      await expect(
        guard(seat(CompanyRole.OWNER, status)).roles.canActivate(context('companyRead', person(UserRole.JOB_SEEKER))),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('gives an employer account its personal side', async () => {
    await expect(guard(null).roles.canActivate(context('personal', person(UserRole.EMPLOYER)))).resolves.toBe(true);
  });

  it('leaves employers, admins and freelancers where they were', async () => {
    await expect(guard(null).roles.canActivate(context('companyRead', person(UserRole.EMPLOYER)))).resolves.toBe(true);
    await expect(guard(null).roles.canActivate(context('companyRead', person(UserRole.ADMIN)))).resolves.toBe(true);
    await expect(guard(seat()).roles.canActivate(context('companyRead', person(UserRole.FREELANCER))))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard(null).roles.canActivate(context('personal', person(UserRole.FREELANCER))))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('looks the seat up once per request, though the guard runs twice', async () => {
    const { roles, ctx } = guard(seat());
    const once = context('companyRead', person(UserRole.JOB_SEEKER));
    await roles.canActivate(once);
    await roles.canActivate(once);
    expect(ctx.membershipFor).toHaveBeenCalledTimes(1);
  });
});

describe('Company capabilities for a person with a seat', () => {
  const guard = (membership: ReturnType<typeof seat> | null) =>
    new CompanyCapabilityGuard(new Reflector(), collaborator(companyContext(membership)));

  it('enforces the seat for a job seeker exactly as for an employer', async () => {
    await expect(guard(seat(CompanyRole.RECRUITER)).canActivate(context('companyWrite', person(UserRole.JOB_SEEKER))))
      .resolves.toBe(true);
    await expect(guard(seat(CompanyRole.VIEWER)).canActivate(context('companyWrite', person(UserRole.JOB_SEEKER))))
      .rejects.toThrow('Viewer');
  });

  it('never grants the one-person-company fallback to anyone but an employer account', async () => {
    await expect(guard(null).canActivate(context('companyWrite', person(UserRole.EMPLOYER)))).resolves.toBe(true);
    await expect(guard(null).canActivate(context('companyWrite', person(UserRole.JOB_SEEKER))))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('leaves shared routes to the service, which knows which side the caller is on', async () => {
    // A viewer seat must still be able to answer a company they applied to.
    await expect(guard(seat(CompanyRole.VIEWER)).canActivate(context('shared', person(UserRole.EMPLOYER))))
      .resolves.toBe(true);
  });
});

describe('Nobody reviews their own application', () => {
  const guard = (applicantOf: Record<string, string> = {}) => {
    const prisma = {
      application: {
        findUnique: jest.fn().mockImplementation(async ({ where }) =>
          applicantOf[where.id] ? { applicantId: applicantOf[where.id] } : null),
      },
    };
    return { guard: new SelfReviewGuard(new Reflector(), collaborator(prisma)), prisma };
  };

  it('refuses a company-side action on the caller themselves', async () => {
    const { guard: g } = guard();
    await expect(g.canActivate(context('aboutCandidate', person(UserRole.EMPLOYER), { params: { candidateId: ME } })))
      .rejects.toThrow('your own application');
    await expect(g.canActivate(context('aboutCandidate', person(UserRole.EMPLOYER), { params: { candidateId: STRANGER } })))
      .resolves.toBe(true);
  });

  it('finds the caller inside a bulk list of application ids', async () => {
    const { guard: g } = guard({ [APPLICATION]: ME });
    await expect(
      g.canActivate(context('bulk', person(UserRole.JOB_SEEKER), { body: { applicationIds: [APPLICATION] } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('leaves malformed ids to the route, unmarked routes alone, and admins through', async () => {
    const { guard: g, prisma } = guard({ [APPLICATION]: ME });
    await g.canActivate(context('bulk', person(UserRole.EMPLOYER), { body: { applicationIds: ['not-a-uuid'] } }));
    expect(prisma.application.findUnique).not.toHaveBeenCalled();
    await expect(g.canActivate(context('unmarked', person(UserRole.EMPLOYER), { params: { candidateId: ME } })))
      .resolves.toBe(true);
    await expect(
      g.canActivate(context('aboutCandidate', { ...person(UserRole.ADMIN) }, { params: { candidateId: ME } })),
    ).resolves.toBe(true);
  });
});

describe('Messaging an internal applicant', () => {
  const conversation = { id: 'convo-a', employerId: COLLEAGUE, candidateId: ME, jobId: null };

  function harness(membership: ReturnType<typeof seat> | null, convo = conversation) {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(convo), update: jest.fn().mockResolvedValue({}) },
      message: { create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'm', createdAt: new Date(), ...data })) },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace' }) },
      employerProfile: { findUnique: jest.fn().mockResolvedValue({ companyName: 'Acme' }) },
    };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new MessagingService(
      collaborator(prisma), collaborator(notifications), collaborator({}), collaborator({}),
      collaborator(companyContext(membership)),
    );
    return { service, prisma, notifications };
  }

  it('treats the applicant as the candidate in their own thread, though a colleague is the employer', async () => {
    // A viewer seat: if they were counted as the company side, this would be refused.
    const { service, prisma, notifications } = harness(seat(CompanyRole.VIEWER));
    await service.sendMessage(person(UserRole.JOB_SEEKER), 'convo-a', { body: 'Thanks!' } as never);
    expect(prisma.conversation.update.mock.calls[0][0].data).toHaveProperty('candidateLastReadAt');
    expect(notifications.create.mock.calls[0][0]).toMatchObject({ userId: COLLEAGUE, link: '/employers/chat?c=convo-a' });
  });

  it('checks the seat when they write for the company', async () => {
    const companyThread = { ...conversation, candidateId: STRANGER };
    await expect(
      harness(seat(CompanyRole.VIEWER), companyThread).service
        .sendMessage(person(UserRole.JOB_SEEKER), 'convo-a', { body: 'Hello' } as never),
    ).rejects.toThrow('Viewer');
    await expect(
      harness(seat(CompanyRole.RECRUITER), companyThread).service
        .sendMessage(person(UserRole.JOB_SEEKER), 'convo-a', { body: 'Hello' } as never),
    ).resolves.toMatchObject({ from: 'me' });
  });
});

describe('Joining a company from the account you have', () => {
  function harness(user: User) {
    const tx = {
      companyMember: { upsert: jest.fn().mockResolvedValue({}) },
      employerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      companyMember: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(tx)),
    };
    const input = {
      companyId: 'company-a', companyName: 'Acme', role: CompanyRole.RECRUITER,
      status: CompanyMemberStatus.ACTIVE, pendingReason: null, invitedById: COLLEAGUE,
    };
    return { run: () => new CompanyEnrolmentService(collaborator(prisma)).enrol(user, input), tx };
  }

  it('lets an established job seeker join and keeps their account as it is', async () => {
    const { run, tx } = harness(person(UserRole.JOB_SEEKER));
    await expect(run()).resolves.toMatchObject({ companyId: 'company-a' });
    expect(tx.companyMember.upsert).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('still lands a brand-new account on the company side', async () => {
    const { run, tx } = harness(person(UserRole.JOB_SEEKER, UserStatus.PENDING_ONBOARDING));
    await run();
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: UserStatus.ACTIVE, role: UserRole.EMPLOYER },
    }));
  });

  it('keeps freelancers out for now', async () => {
    await expect(harness(person(UserRole.FREELANCER)).run()).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('A company never sees its own people looking', () => {
  it('leaves colleagues out of candidate search and saved-search alerts', async () => {
    const prisma = { jobSeekerProfile: { findMany: jest.fn().mockResolvedValue([]) } };
    const sourcing = new CandidateSourcingService(collaborator(prisma), collaborator({}), collaborator(companyContext(seat())));
    await sourcing.matchingIds({ query: 'react' }, ME);
    expect(prisma.jobSeekerProfile.findMany.mock.calls[0][0].where.userId).toEqual({ notIn: [ME, COLLEAGUE] });
  });

  it('sends no recruiting approach to a colleague', async () => {
    const outreach = new OutreachService(
      collaborator({}), collaborator({}), collaborator({}), collaborator({}), collaborator(companyContext(seat())),
    );
    await expect(outreach.send(person(UserRole.EMPLOYER), { candidateId: COLLEAGUE, subject: 'Hi', message: 'Hello' }))
      .rejects.toThrow('someone you work with');
  });

  it("hides a colleague's Open to Work on their profile, but not a stranger's", async () => {
    const profile = (userId: string) => ({
      userId, discoverable: true, privacySettings: null, openToWork: true, skills: [], languages: [],
      user: { displayName: 'Someone', firstName: null, lastName: null, avatarUrl: null },
      experiences: [], educations: [], certifications: [], portfolioItems: [], recommendations: [], projects: [],
    });
    const prisma = {
      jobSeekerProfile: { findUnique: jest.fn().mockImplementation(async ({ where }) => profile(where.userId)) },
      application: { findFirst: jest.fn().mockResolvedValue(null) },
      completedWork: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    const seekers = new JobSeekersService(
      collaborator(prisma), collaborator({}), collaborator({}), collaborator(companyContext(seat())),
      collaborator({}), collaborator({ record: jest.fn().mockResolvedValue(undefined) }),
    );
    const viewer = person(UserRole.EMPLOYER);
    await expect(seekers.getPublicProfile(COLLEAGUE, viewer)).resolves.toMatchObject({ openToWork: false });
    await expect(seekers.getPublicProfile(STRANGER, viewer)).resolves.toMatchObject({ openToWork: true });
  });
});

describe('A personal profile made on first use', () => {
  function seekersFor(role: UserRole) {
    const prisma = {
      jobSeekerProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => data),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role }) },
    };
    return {
      prisma,
      seekers: new JobSeekersService(
        collaborator(prisma), collaborator({}), collaborator({}), collaborator({}), collaborator({}), collaborator({}),
      ),
    };
  }

  it('starts out of search for a recruiter, and in it for a job seeker', async () => {
    for (const [role, discoverable] of [[UserRole.EMPLOYER, false], [UserRole.JOB_SEEKER, true]] as const) {
      const { seekers, prisma } = seekersFor(role);
      await seekers.getMyProfile(ME);
      expect(prisma.jobSeekerProfile.create.mock.calls[0][0].data.discoverable).toBe(discoverable);
    }
  });
});

describe('Creating a company page from your own account', () => {
  function harness(opts: { seated?: boolean; user?: Partial<User> } = {}) {
    const prisma = {
      user: { update: jest.fn().mockResolvedValue({}) },
      companyMember: {
        findFirst: jest.fn().mockResolvedValue(opts.seated ? { id: 'm', companyId: 'company-a', role: CompanyRole.OWNER } : null),
      },
      company: {
        create: jest.fn().mockResolvedValue({ id: 'company-new' }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      employerProfile: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null) },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new OnboardingService(collaborator(prisma), collaborator(audit));
    const user = {
      ...person(UserRole.JOB_SEEKER), email: 'ada@gmail.com', emailVerified: true,
      firstName: null, lastName: null, ...opts.user,
    } as User;
    const step = { companyName: 'Acme', industry: 'Technology', companySize: '1-10' };
    return { service, prisma, audit, user, step };
  }

  it('asks for your name, and stores what you type', async () => {
    const { service, prisma, user, step } = harness();
    await expect(service.saveCompany(user, { ...step, authorizedRepresentative: true }))
      .rejects.toThrow('first and last name');
    expect(prisma.company.create).not.toHaveBeenCalled();

    await service.saveCompany(user, { ...step, firstName: 'Ada', lastName: 'Lovelace', authorizedRepresentative: true });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: ME }, data: { firstName: 'Ada', lastName: 'Lovelace' } });
    expect(prisma.company.create).toHaveBeenCalled();
  });

  it('asks for your word that you may represent the organization, and records it', async () => {
    const { service, prisma, audit, user, step } = harness({ user: { firstName: 'Ada', lastName: 'Lovelace' } });
    await expect(service.saveCompany(user, step)).rejects.toThrow('authorized to represent');
    expect(prisma.company.create).not.toHaveBeenCalled();

    await service.saveCompany(user, { ...step, authorizedRepresentative: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-new',
      category: 'COMPANY',
      summary: 'Ada Lovelace created the company page and confirmed they are authorized to represent Acme.',
    }));
  });

  it('asks neither when editing the company you already have', async () => {
    const { service, prisma, audit, user, step } = harness({ seated: true });
    await expect(service.saveCompany(user, step)).resolves.toBeDefined();
    expect(prisma.company.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('Who you are, as the app sees it', () => {
  it('carries the company you act for, and only through an active seat', async () => {
    const controller = (membership: ReturnType<typeof seat> | null) =>
      new AuthController(collaborator({}), collaborator({}), collaborator(companyContext(membership)));
    const me = person(UserRole.JOB_SEEKER);

    await expect(controller(seat(CompanyRole.RECRUITER)).getCurrentUser(me)).resolves.toMatchObject({
      data: { user: { company: { id: 'company-a', name: 'Acme', role: CompanyRole.RECRUITER } } },
    });
    await expect(controller(seat(CompanyRole.OWNER, CompanyMemberStatus.SUSPENDED)).getCurrentUser(me))
      .resolves.toMatchObject({ data: { user: { company: null } } });
    await expect(controller(null).getCurrentUser(me)).resolves.toMatchObject({ data: { user: { company: null } } });
  });
});

describe('Colleagues, as the walls see them', () => {
  it('are the current team — active, waiting, or suspended — but not anyone who left', async () => {
    const prisma = {
      companyMember: {
        findFirst: jest.fn().mockResolvedValue(seat()),
        findMany: jest.fn().mockResolvedValue([{ userId: COLLEAGUE }]),
      },
    };
    const ctx = new CompanyContextService(collaborator(prisma));
    await expect(ctx.colleagueIds(ME)).resolves.toEqual([ME, COLLEAGUE]);
    expect(prisma.companyMember.findMany.mock.calls[0][0].where.status.in).toEqual([
      CompanyMemberStatus.ACTIVE, CompanyMemberStatus.PENDING, CompanyMemberStatus.SUSPENDED,
    ]);
  });

  it('are just yourself without a company', async () => {
    const prisma = { companyMember: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn() } };
    await expect(new CompanyContextService(collaborator(prisma)).colleagueIds(ME)).resolves.toEqual([ME]);
  });
});
