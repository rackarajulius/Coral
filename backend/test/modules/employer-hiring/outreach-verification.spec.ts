import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyMemberStatus, CompanyRole, UserRole } from '@prisma/client';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { CompanyCapabilityGuard } from '../../../src/company/company-capability.guard';
import { User } from '../../../src/common/types/user.types';
import { AiScreenService } from '../../../src/employer-hiring/ai-screen.service';
import { InviteScreenDto } from '../../../src/employer-hiring/dto/invite-screen.dto';
import { SendOutreachDto } from '../../../src/employer-hiring/dto/send-outreach.dto';
import { HiringController } from '../../../src/employer-hiring/hiring.controller';
import { OutreachService } from '../../../src/employer-hiring/outreach.service';
import { EmployerVerificationService } from '../../../src/employers/employer-verification.service';

function collaborator<T>(value: unknown): T { return value as T; }

const employer = (role: UserRole = UserRole.EMPLOYER) => ({ id: 'employer-a', role } as User);
const activeSeat = (role: CompanyRole = CompanyRole.OWNER) => ({ role, status: CompanyMemberStatus.ACTIVE });
const draft: SendOutreachDto = {
  candidateId: 'candidate-a', subject: 'A software opportunity', message: 'Would you like to discuss this role?',
};

function harness(
  level: string | null = 'unverified',
  seat: { role: CompanyRole; status: CompanyMemberStatus } = activeSeat(),
) {
  const prisma = {
    employerProfile: {
      findUnique: jest.fn().mockImplementation(async ({ select }) => select.verificationStatus
        ? (level === null ? null : { verificationStatus: level })
        : { companyName: 'Synthetic QA company' }),
    },
    jobSeekerProfile: {
      findUnique: jest.fn().mockResolvedValue({
        discoverable: true, privacySettings: {}, skills: [], experiences: [], timezone: null,
        user: { email: 'candidate@example.test', displayName: 'Synthetic candidate' },
      }),
    },
    outreachMessage: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'outreach-a', ...data })),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ id: 'scheduled-a', employerId: 'employer-a', status: 'scheduled' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    aiScreen: {
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'screen-a', jobId: null, overallScore: null, recommendation: null, evaluation: null,
        createdAt: new Date(), completedAt: null, ...data,
      })),
    },
  };
  const companyContext = {
    membershipFor: jest.fn().mockResolvedValue(seat),
    memberUserIds: jest.fn().mockResolvedValue(['employer-a', 'colleague-a']),
  };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const email = { sendPlainText: jest.fn().mockResolvedValue(undefined) };
  const outreach = new OutreachService(
    collaborator(prisma), collaborator({}), collaborator(notifications), collaborator(email), collaborator(companyContext),
  );
  const send = jest.spyOn(outreach, 'send');
  const ai = { generateInterviewPlan: jest.fn().mockResolvedValue({ questions: [{ question: 'Describe your software work.' }] }) };
  const screens = new AiScreenService(
    collaborator(prisma), collaborator(ai), collaborator(notifications), collaborator({}), collaborator({}),
    collaborator({}), collaborator(companyContext),
  );
  const invite = jest.spyOn(screens, 'invite');
  const verification = new EmployerVerificationService(collaborator(prisma));
  const verify = jest.spyOn(verification, 'assertCanReachCandidates');
  const controller = new HiringController(
    collaborator({}), outreach, collaborator({}), screens, collaborator({}), collaborator({}),
    collaborator({}), verification, collaborator({}), collaborator({}),
  );
  const reflector = new Reflector();
  const roles = new RolesGuard(reflector);
  const capabilities = new CompanyCapabilityGuard(reflector, collaborator(companyContext));

  async function authorize(user: User, handler: 'sendOutreach' | 'cancelScheduledOutreach' | 'inviteScreen') {
    const context = {
      getClass: () => HiringController,
      getHandler: () => controller[handler],
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    roles.canActivate(context);
    await capabilities.canActivate(context);
  }

  async function dispatch(dto: SendOutreachDto = draft, user = employer()) {
    // Exercise the real route role/seat metadata, verification and sending service.
    // Persistence and delivery are in-memory mocks; no database or email is contacted.
    await authorize(user, 'sendOutreach');
    return controller.sendOutreach(user, dto);
  }

  async function cancel(user = employer()) {
    await authorize(user, 'cancelScheduledOutreach');
    return controller.cancelScheduledOutreach(user, 'scheduled-a');
  }

  async function dispatchInvite(dto: InviteScreenDto, user = employer()) {
    await authorize(user, 'inviteScreen');
    return controller.inviteScreen(user, dto);
  }

  return { prisma, companyContext, notifications, email, ai, send, invite, verify, dispatch, cancel, dispatchInvite };
}

describe('Employer outreach initiation: company verification boundary', () => {
  it.each(['unverified', 'unknown-level', null])('denies %s before persistence or candidate delivery', async (level) => {
    const { dispatch, prisma, notifications, email, send } = harness(level);

    await expect(dispatch()).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.jobSeekerProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.outreachMessage.create).not.toHaveBeenCalled();
    expect(prisma.outreachMessage.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.sendPlainText).not.toHaveBeenCalled();
  });

  it('does not let an unverified employer queue a new scheduled approach', async () => {
    const { dispatch, prisma, send, notifications, email } = harness();
    await expect(dispatch({ ...draft, scheduledFor: new Date(Date.now() + 3_600_000).toISOString() }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.outreachMessage.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.sendPlainText).not.toHaveBeenCalled();
  });

  it.each(['domain_verified', 'verified'])('keeps immediate sending available at level %s', async (level) => {
    const { dispatch, prisma, verify, notifications, email } = harness(level, activeSeat(CompanyRole.RECRUITER));
    await expect(dispatch()).resolves.toMatchObject({ success: true, data: { id: 'outreach-a', channel: 'both' } });
    expect(verify).toHaveBeenCalledWith('employer-a');
    expect(prisma.employerProfile.findUnique.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.outreachMessage.create.mock.invocationCallOrder[0]);
    expect(prisma.outreachMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ employerId: 'employer-a', candidateId: 'candidate-a', status: 'sent' }),
    });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(email.sendPlainText).toHaveBeenCalledTimes(1);
  });

  it.each([CompanyRole.OWNER, CompanyRole.ADMIN, CompanyRole.RECRUITER, CompanyRole.HIRING_MANAGER])(
    'preserves messaging permission for a verified active %s seat', async (role) => {
      const { dispatch, send } = harness('verified', activeSeat(role));
      await expect(dispatch()).resolves.toMatchObject({ success: true });
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it.each([CompanyRole.INTERVIEWER, CompanyRole.VIEWER])('does not grant a verified %s seat messaging rights', async (role) => {
    const { dispatch, verify, send, prisma } = harness('verified', activeSeat(role));
    await expect(dispatch()).rejects.toBeInstanceOf(ForbiddenException);
    expect(verify).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(prisma.outreachMessage.create).not.toHaveBeenCalled();
  });

  it.each([CompanyMemberStatus.SUSPENDED, CompanyMemberStatus.REMOVED, CompanyMemberStatus.PENDING])(
    'keeps a verified %s seat blocked before outreach', async (status) => {
      const { dispatch, verify, send } = harness('verified', { role: CompanyRole.OWNER, status });
      await expect(dispatch()).rejects.toBeInstanceOf(ForbiddenException);
      expect(verify).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('keeps candidate accounts off the employer initiation route', async () => {
    const { dispatch, verify, send } = harness('verified');
    await expect(dispatch(draft, employer(UserRole.JOB_SEEKER))).rejects.toBeInstanceOf(ForbiddenException);
    expect(verify).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('preserves the existing platform admin exemption', async () => {
    const { dispatch, verify, send, companyContext } = harness();
    await expect(dispatch(draft, employer(UserRole.ADMIN))).resolves.toMatchObject({ success: true });
    expect(verify).not.toHaveBeenCalled();
    expect(companyContext.membershipFor).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('allows verified scheduling without delivering before its due time', async () => {
    const { dispatch, prisma, notifications, email } = harness('verified');
    const scheduledFor = new Date(Date.now() + 3_600_000).toISOString();
    await expect(dispatch({ ...draft, scheduledFor })).resolves.toMatchObject({
      success: true, data: { id: 'outreach-a', channel: null, scheduledFor },
    });
    expect(prisma.outreachMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'scheduled', scheduledFor: new Date(scheduledFor) }),
    });
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.sendPlainText).not.toHaveBeenCalled();
  });

  it('still lets an unverified authorized seat cancel an already scheduled approach', async () => {
    const { cancel, verify, prisma, notifications, email } = harness();
    await expect(cancel()).resolves.toEqual({ success: true, data: { id: 'scheduled-a', status: 'cancelled' } });
    expect(verify).not.toHaveBeenCalled();
    expect(prisma.outreachMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'scheduled-a', status: 'scheduled' }, data: { status: 'cancelled' },
    });
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.sendPlainText).not.toHaveBeenCalled();
  });
});

describe('Individual AI-screen invitation: company verification boundary', () => {
  it.each(['unverified', 'unknown-level', null])('denies %s before generating or delivering an invitation', async (level) => {
    for (const mode of ['text', 'video'] as const) {
      const { dispatchInvite, invite, prisma, ai, notifications } = harness(level);
      await expect(dispatchInvite({ candidateId: 'candidate-a', mode })).rejects.toBeInstanceOf(ForbiddenException);
      expect(invite).not.toHaveBeenCalled();
      expect(prisma.jobSeekerProfile.findUnique).not.toHaveBeenCalled();
      expect(ai.generateInterviewPlan).not.toHaveBeenCalled();
      expect(prisma.aiScreen.create).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    }
  });

  it.each(['domain_verified', 'verified'])('preserves text and video invitations at level %s', async (level) => {
    for (const mode of ['text', 'video'] as const) {
      const { dispatchInvite, verify, prisma, notifications } = harness(level, activeSeat(CompanyRole.RECRUITER));
      await expect(dispatchInvite({ candidateId: 'candidate-a', mode })).resolves.toMatchObject({
        success: true, data: { id: 'screen-a', candidateId: 'candidate-a', status: 'invited', mode },
      });
      expect(verify).toHaveBeenCalledWith('employer-a');
      expect(prisma.employerProfile.findUnique.mock.invocationCallOrder[0])
        .toBeLessThan(prisma.aiScreen.create.mock.invocationCallOrder[0]);
      expect(prisma.aiScreen.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'candidate-a', type: 'ai_screen' }));
    }
  });

  it.each([CompanyRole.OWNER, CompanyRole.ADMIN, CompanyRole.RECRUITER, CompanyRole.HIRING_MANAGER])(
    'preserves invitation permission for a verified active %s seat', async (role) => {
      const { dispatchInvite, invite } = harness('verified', activeSeat(role));
      await expect(dispatchInvite({ candidateId: 'candidate-a' })).resolves.toMatchObject({ success: true });
      expect(invite).toHaveBeenCalledTimes(1);
    },
  );

  it.each([CompanyRole.INTERVIEWER, CompanyRole.VIEWER])('does not grant a verified %s seat invitation rights', async (role) => {
    const { dispatchInvite, verify, invite, prisma, notifications } = harness('verified', activeSeat(role));
    await expect(dispatchInvite({ candidateId: 'candidate-a' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(verify).not.toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
    expect(prisma.aiScreen.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('keeps candidate accounts off the employer invitation route', async () => {
    const { dispatchInvite, verify, invite } = harness('verified');
    await expect(dispatchInvite({ candidateId: 'candidate-a' }, employer(UserRole.JOB_SEEKER)))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(verify).not.toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
  });

  it('preserves the existing platform admin exemption for individual invitations', async () => {
    const { dispatchInvite, verify, invite } = harness();
    await expect(dispatchInvite({ candidateId: 'candidate-a' }, employer(UserRole.ADMIN)))
      .resolves.toMatchObject({ success: true });
    expect(verify).not.toHaveBeenCalled();
    expect(invite).toHaveBeenCalledTimes(1);
  });
});
