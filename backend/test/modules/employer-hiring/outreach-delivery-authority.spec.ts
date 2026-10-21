import { CompanyRole, UserRole, UserStatus } from '@prisma/client';
import { OutreachService } from '../../../src/employer-hiring/outreach.service';

function collaborator<T>(value: unknown): T { return value as T; }
function harness() {
  const row = { id: 'queued', employerId: 'sender', candidateId: 'candidate', status: 'scheduled', subject: 'QA', message: 'QA message' };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'EMPLOYER', status: 'ACTIVE' }) },
    employerProfile: { findUnique: jest.fn().mockResolvedValue({ verificationStatus: 'verified' }) },
    outreachMessage: { findMany: jest.fn().mockResolvedValue([row]), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({}) },
    jobSeekerProfile: { findUnique: jest.fn().mockResolvedValue({ discoverable: true, privacySettings: {}, skills: [], experiences: [], user: { email: null, displayName: 'Candidate' } }) },
  };
  const company = { membershipFor: jest.fn().mockResolvedValue({ status: 'ACTIVE', role: 'RECRUITER' }), forUser: jest.fn().mockResolvedValue({ companyName: 'QA company' }) };
  const notifications = { create: jest.fn().mockResolvedValue({}) }, email = { sendPlainText: jest.fn().mockResolvedValue({}) };
  const service = new OutreachService(collaborator(prisma), collaborator({}), collaborator(notifications), collaborator(email), collaborator(company));
  return { service, prisma, company, notifications, email };
}
describe('Scheduled outreach rechecks current authority before delivery', () => {
  it.each(['unverified', 'unknown', null])('cancels revoked verification %s without notifying the candidate', async verificationStatus => {
    const h = harness(); h.prisma.employerProfile.findUnique.mockResolvedValue(verificationStatus ? { verificationStatus } : null);
    await h.service.deliverScheduled();
    expect(h.prisma.outreachMessage.update).toHaveBeenCalledWith({ where: { id: 'queued' }, data: { status: 'cancelled' } });
    expect(h.notifications.create).not.toHaveBeenCalled(); expect(h.email.sendPlainText).not.toHaveBeenCalled();
  });
  it.each(['SUSPENDED', 'REMOVED', 'PENDING'])('cancels a %s company seat', async status => {
    const h = harness(); h.company.membershipFor.mockResolvedValue({ status, role: 'OWNER' });
    await h.service.deliverScheduled();
    expect(h.prisma.jobSeekerProfile.findUnique).not.toHaveBeenCalled(); expect(h.notifications.create).not.toHaveBeenCalled();
    expect(h.prisma.outreachMessage.update).toHaveBeenCalledWith({ where: { id: 'queued' }, data: { status: 'cancelled' } });
  });
  it.each([CompanyRole.VIEWER, CompanyRole.INTERVIEWER])('cancels loss of messaging capability to %s', async role => {
    const h = harness(); h.company.membershipFor.mockResolvedValue({ status: 'ACTIVE', role });
    await h.service.deliverScheduled(); expect(h.notifications.create).not.toHaveBeenCalled();
  });
  it.each([{ role: UserRole.EMPLOYER, status: UserStatus.SUSPENDED }, { role: UserRole.JOB_SEEKER, status: UserStatus.ACTIVE }, null])('cancels inactive, missing or ineligible senders', async sender => {
    const h = harness(); h.prisma.user.findUnique.mockResolvedValue(sender);
    await h.service.deliverScheduled(); expect(h.notifications.create).not.toHaveBeenCalled(); expect(h.email.sendPlainText).not.toHaveBeenCalled();
  });
  it('delivers for a currently verified active messaging seat', async () => {
    const h = harness(); await h.service.deliverScheduled();
    expect(h.notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'candidate' }));
  });
  it('retries an authority lookup outage without delivering or treating it as permission', async () => {
    const h = harness(); h.company.membershipFor.mockRejectedValueOnce(new Error('Synthetic lookup outage'));
    await h.service.deliverScheduled(); expect(h.notifications.create).not.toHaveBeenCalled();
    expect(h.prisma.outreachMessage.update).toHaveBeenCalledWith({ where: { id: 'queued' }, data: { status: 'scheduled' } });
  });
});
