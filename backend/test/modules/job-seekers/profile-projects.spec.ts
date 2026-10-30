import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { MarketplaceService } from '../../../src/marketplace/marketplace.service';
import { MAX_PROJECTS, ProfileProjectsService } from '../../../src/job-seekers/profile-projects.service';
import { ProjectRecord, publicProjects } from '../../../src/job-seekers/profile-projects';
import { COMMUNITY_BUCKET } from '../../../src/storage/storage.service';

/**
 * Projects on a profile: what the owner may save, and what visitors see.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROFILE = 'profile-1';
const JOB = '33333333-3333-4333-8333-333333333333';
const SERVICE = '44444444-4444-4444-8444-444444444444';
const STORAGE = `https://example.supabase.co/storage/v1/object/public/${COMMUNITY_BUCKET}`;
const upload = (owner: string, n: number, ext: string) => `${STORAGE}/posts/${owner}/00000000-0000-4000-8000-00000000000${n}.${ext}`;

function record(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'project-1', title: 'Livestock tracker', description: 'Low-cost tags for farmers',
    startDate: new Date('2022-05-01T00:00:00Z'), endDate: null, current: true,
    skills: ['IoT', 'C++'], projectUrl: 'https://example.com/tracker', mediaUrls: [upload(OWNER, 1, 'jpg')],
    experienceId: null, serviceListingId: null, experience: null, serviceListing: null,
    ...overrides,
  } as ProjectRecord;
}

function harness() {
  const prisma = {
    jobSeekerProfile: { findUnique: jest.fn().mockResolvedValue({ id: PROFILE }) },
    profileProject: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(record()),
      create: jest.fn().mockImplementation(async ({ data }) => record({ ...data, experience: null, serviceListing: null })),
      update: jest.fn().mockImplementation(async ({ data }) => record({ ...data, experience: null, serviceListing: null })),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    experience: { findFirst: jest.fn().mockResolvedValue({ id: JOB }) },
    serviceListing: { findFirst: jest.fn().mockResolvedValue({ id: SERVICE }), findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new ProfileProjectsService(prisma as unknown as PrismaService) };
}

describe('Saving a project', () => {
  it('keeps months, tidied skills, a link with its scheme, and its own pictures', async () => {
    const { service, prisma } = harness();
    await service.create(OWNER, {
      title: '  Livestock   tracker ', startMonth: '2022-05', endMonth: '2023-01',
      skills: [' IoT ', 'iot', 'C++'], projectUrl: 'example.com/tracker',
      mediaUrls: [upload(OWNER, 1, 'jpg'), upload(OWNER, 2, 'mp4')],
    });
    expect(prisma.profileProject.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        profileId: PROFILE, title: 'Livestock tracker',
        startDate: new Date('2022-05-01T00:00:00Z'), endDate: new Date('2023-01-01T00:00:00Z'),
        skills: ['IoT', 'C++'], projectUrl: 'https://example.com/tracker',
      }),
    }));
  });

  it('an ongoing project has no end date', async () => {
    const { service, prisma } = harness();
    await service.create(OWNER, { title: 'Tracker', startMonth: '2022-05', endMonth: '2023-01', current: true });
    expect(prisma.profileProject.create.mock.calls[0][0].data).toMatchObject({ current: true, endDate: null });
  });

  it.each([
    [{ title: '   ' }, 'name'],
    [{ title: 'T', startMonth: '2023-05', endMonth: '2023-01' }, 'end before it starts'],
    [{ title: 'T', projectUrl: 'javascript:alert(1)' }, 'web address'],
    [{ title: 'T', mediaUrls: ['https://tracker.example/pixel.jpg'] }, 'uploaded here, by you'],
    [{ title: 'T', mediaUrls: [upload(OTHER, 1, 'jpg')] }, 'uploaded here, by you'],
    [{ title: 'T', mediaUrls: [upload(OWNER, 1, 'mp4'), upload(OWNER, 2, 'webm')] }, 'one video'],
    [{ title: 'T', experienceId: JOB, serviceListingId: SERVICE }, 'not both'],
  ])('refuses %o', async (dto, message) => {
    const { service, prisma } = harness();
    await expect(service.create(OWNER, dto as never)).rejects.toThrow(message);
    expect(prisma.profileProject.create).not.toHaveBeenCalled();
  });

  it('links only their own job, and only a service they offer as themselves', async () => {
    const { service, prisma } = harness();
    prisma.experience.findFirst.mockResolvedValue(null);
    await expect(service.create(OWNER, { title: 'T', experienceId: JOB })).rejects.toThrow('isn’t on your profile');
    expect(prisma.experience.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: JOB, profileId: PROFILE } }));

    prisma.serviceListing.findFirst.mockResolvedValue(null);
    await expect(service.create(OWNER, { title: 'T', serviceListingId: SERVICE })).rejects.toThrow('isn’t one of yours');
    expect(prisma.serviceListing.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: SERVICE, ownerUserId: OWNER, companyId: null },
    }));
  });

  it(`keeps at most ${MAX_PROJECTS}`, async () => {
    const { service, prisma } = harness();
    prisma.profileProject.count.mockResolvedValue(MAX_PROJECTS);
    await expect(service.create(OWNER, { title: 'One more' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('an edit changes only what it sends, checked as a whole', async () => {
    const { service, prisma } = harness();
    await service.update(OWNER, 'project-1', { endMonth: '2023-02', current: false });
    expect(prisma.profileProject.update.mock.calls[0][0].data).toMatchObject({
      title: 'Livestock tracker', startDate: new Date('2022-05-01T00:00:00Z'),
      endDate: new Date('2023-02-01T00:00:00Z'), current: false, skills: ['IoT', 'C++'],
    });
    await expect(service.update(OWNER, 'project-1', { current: false, endMonth: '2021-01' })).rejects.toThrow('end before it starts');
  });

  it("someone else's project is not found, to edit or to delete", async () => {
    const { service, prisma } = harness();
    prisma.profileProject.findFirst.mockResolvedValue(null);
    await expect(service.update(OWNER, 'theirs', { title: 'Mine now' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.profileProject.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'theirs', profileId: PROFILE } }));
    prisma.profileProject.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(OWNER, 'theirs')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('What a visitor sees of a project', () => {
  const prisma = (publicIds: string[]) => ({
    serviceListing: { findMany: jest.fn().mockResolvedValue(publicIds.map((id) => ({ id }))) },
  });

  it('months, skills, its link, and the job it was done in', async () => {
    const [shown] = await publicProjects(prisma([]) as never, [record({
      current: false, endDate: new Date('2023-01-01T00:00:00Z'),
      experienceId: JOB, experience: { title: 'Engineer', company: 'Acme' },
    })], OWNER);
    expect(shown).toEqual({
      id: 'project-1', title: 'Livestock tracker', description: 'Low-cost tags for farmers',
      startMonth: '2022-05', endMonth: '2023-01', current: false, skills: ['IoT', 'C++'],
      link: 'https://example.com/tracker', mediaUrls: [upload(OWNER, 1, 'jpg')],
      associatedWith: { kind: 'job', title: 'Engineer', company: 'Acme' },
    });
  });

  it('names the service only while it is public, so the link never leads nowhere', async () => {
    const linked = record({ serviceListingId: SERVICE, serviceListing: { id: SERVICE, title: 'Logo design' } });
    const [publicNow] = await publicProjects(prisma([SERVICE]) as never, [linked], OWNER);
    expect(publicNow.associatedWith).toEqual({ kind: 'service', id: SERVICE, title: 'Logo design' });
    const [paused] = await publicProjects(prisma([]) as never, [linked], OWNER);
    expect(paused.associatedWith).toBeNull();
  });

  it("shows none of someone else's uploads, even if one got stored", async () => {
    const [shown] = await publicProjects(prisma([]) as never, [record({ mediaUrls: [upload(OTHER, 1, 'jpg'), upload(OWNER, 2, 'png')] })], OWNER);
    expect(shown.mediaUrls).toEqual([upload(OWNER, 2, 'png')]);
  });
});

describe("A service's page shows the projects done as it", () => {
  function marketplace(profile: unknown) {
    const prisma = {
      jobSeekerProfile: { findUnique: jest.fn().mockResolvedValue(profile) },
      serviceListing: { findMany: jest.fn().mockResolvedValue([{ id: SERVICE }]) },
      completedWork: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MarketplaceService(prisma as unknown as PrismaService);
    jest.spyOn(service, 'getPublic').mockResolvedValue({ id: SERVICE, owner: { id: OWNER } } as never);
    return { service, prisma };
  }

  it("lists the owner's projects linked to it", async () => {
    const linked = record({ serviceListingId: SERVICE, serviceListing: { id: SERVICE, title: 'Logo design' } });
    const { service, prisma } = marketplace({ privacySettings: {}, projects: [linked] });
    const page = await service.getPublicService(SERVICE);
    expect(page.projects).toEqual([expect.objectContaining({ title: 'Livestock tracker' })]);
    expect(prisma.jobSeekerProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: OWNER },
      select: expect.objectContaining({ projects: expect.objectContaining({ where: { serviceListingId: SERVICE } }) }),
    }));
  });

  it('none while the owner has hidden their profile', async () => {
    const { service } = marketplace({ privacySettings: { profileVisible: false }, projects: [record()] });
    await expect(service.getPublicService(SERVICE)).resolves.toMatchObject({ projects: [] });
  });
});
