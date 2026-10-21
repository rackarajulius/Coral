import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CompanyRole, PostPurpose, UserRole } from '@prisma/client';
import { PostsService } from '../../../src/community/posts/posts.service';
import { AnnouncementReferenceType, CommunityPostPurpose, CommunityPostType } from '../../../src/community/posts/dto/create-post.dto';
import { User } from '../../../src/common/types/user.types';

const cast = <T>(value: unknown): T => value as T;
const user = { id: 'author', role: UserRole.JOB_SEEKER } as User;
const reference = { type: AnnouncementReferenceType.SERVICE, id: 'service-a' };
const card = { ...reference, title: 'Design service', description: 'Current public description', category: 'design', status: 'published', url: '/services/service-a', owner: { id: user.id, displayName: 'Designer', avatarUrl: null, profileUrl: '/providers/author' }, company: null };

function harness() {
  const record = { id: 'post-a', authorId: user.id, companyId: null as string | null, content: 'Original', hashtags: [], mediaUrls: [], removedAt: null, purpose: PostPurpose.GENERAL, postType: 'TEXT', linkedServiceListingId: null as string | null, linkedGigId: null as string | null, linkedJobId: null as string | null };
  const prisma = {
    post: {
      findUnique: jest.fn().mockResolvedValue(record), findMany: jest.fn().mockResolvedValue([record]), count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation(async ({ data }) => ({ ...record, ...data })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...record, ...data })),
    },
    postLike: { findMany: jest.fn().mockResolvedValue([]) }, postBookmark: { findMany: jest.fn().mockResolvedValue([]) },
    companyMember: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  const marketplace = {
    isListingWritesEnabled: jest.fn().mockReturnValue(true), assertListingWritesEnabled: jest.fn(),
    validateAnnouncementReference: jest.fn().mockResolvedValue({ linkedServiceListingId: reference.id }),
    projectAnnouncementReference: jest.fn().mockResolvedValue(card),
    getAnnouncementOptions: jest.fn().mockResolvedValue({ services: [card], projects: [], jobs: [] }),
  };
  const context = { forUser: jest.fn().mockResolvedValue(null) };
  const service = new PostsService(cast(prisma), cast({ assertPostable: jest.fn(), joinOnPost: jest.fn() }), cast({ resolve: jest.fn().mockResolvedValue(new Map()) }), cast({ assertOwnMedia: jest.fn() }), cast({}), cast({ firstUrl: jest.fn().mockReturnValue(null) }), cast(context), cast({}), cast(marketplace));
  return { service, prisma, record, marketplace, context };
}

describe('Phase 2 linked community participation', () => {
  it('preserves legacy and ordinary posts, including format, while listing writes are disabled', async () => {
    const { service, prisma, marketplace } = harness();
    marketplace.assertListingWritesEnabled.mockImplementation(() => { throw new ForbiddenException('Paused'); });
    const result = await service.create(user.id, { spaceId: 'space-a', content: 'A useful question', purpose: CommunityPostPurpose.QUESTION, postType: CommunityPostType.IMAGE });
    expect(result.data).toMatchObject({ purpose: 'question', postType: 'IMAGE', linkedRecord: null });
    expect(marketplace.assertListingWritesEnabled).not.toHaveBeenCalled();
    expect((await service.list({})).data[0].purpose).toBe('general');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('publishes a service using canonical validation inside the creation transaction', async () => {
    const { service, prisma, marketplace } = harness();
    const result = await service.create(user.id, { spaceId: 'space-a', content: 'I offer design', purpose: CommunityPostPurpose.SERVICE_ANNOUNCEMENT, reference });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(marketplace.validateAnnouncementReference).toHaveBeenCalledWith(user.id, reference, null, prisma);
    expect(result.data).toMatchObject({ purpose: 'service_announcement', linkedServiceListingId: reference.id, linkedRecord: card });
  });

  it('refuses a stale or foreign listing before saving any announcement', async () => {
    const { service, prisma, marketplace } = harness();
    marketplace.validateAnnouncementReference.mockRejectedValue(new ForbiddenException('Not your public service'));
    await expect(service.create(user.id, { spaceId: 'space-a', content: 'Foreign listing', purpose: CommunityPostPurpose.SERVICE_ANNOUNCEMENT, reference })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it.each([
    { purpose: CommunityPostPurpose.SERVICE_ANNOUNCEMENT, reference: undefined },
    { purpose: CommunityPostPurpose.SERVICE_ANNOUNCEMENT, reference: { type: AnnouncementReferenceType.JOB, id: 'job-a' } },
    { purpose: CommunityPostPurpose.OPPORTUNITY, reference },
    { purpose: CommunityPostPurpose.GENERAL, reference },
    { purpose: CommunityPostPurpose.QUESTION, reference },
  ])('refuses a mismatched or missing reference for $purpose', async (structured) => {
    const { service, prisma } = harness();
    await expect(service.create(user.id, { spaceId: 'space-a', content: 'Structured post', ...structured })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('prevents commercial announcements while the writes flag is off', async () => {
    const { service, prisma, marketplace } = harness();
    marketplace.assertListingWritesEnabled.mockImplementation(() => { throw new ForbiddenException('Paused'); });
    await expect(service.create(user.id, { spaceId: 'space-a', content: 'My service', purpose: CommunityPostPurpose.SERVICE_ANNOUNCEMENT, reference })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('re-reads canonical state and erases stale preview data for top-level cards and reshares', async () => {
    const { service, prisma, record, marketplace } = harness();
    const linked = { ...record, linkedServiceListingId: reference.id, purpose: PostPurpose.SERVICE_ANNOUNCEMENT, linkPreview: { title: 'Withdrawn private title' } };
    prisma.post.findMany.mockResolvedValue([linked, { ...record, id: 'reshare', resharedFrom: linked }]);
    const live = await service.list({});
    expect(live.data[0].linkedRecord).toEqual(card);
    expect(marketplace.projectAnnouncementReference).toHaveBeenCalledTimes(1);
    marketplace.projectAnnouncementReference.mockResolvedValue(null);
    const withdrawn = await service.list({});
    expect(withdrawn.data[0]).toMatchObject({ linkedRecord: null, linkedRecordUnavailable: true, linkPreview: null });
    expect(withdrawn.data[1].resharedFrom).toMatchObject({ linkedRecord: null, linkedRecordUnavailable: true, linkPreview: null });
    expect(JSON.stringify(withdrawn)).not.toContain('Withdrawn private title');
    expect(JSON.stringify(withdrawn)).not.toContain(card.description);
  });

  it('keeps removed source posts redacted before resolving canonical records', async () => {
    const { service, prisma, record, marketplace } = harness();
    prisma.post.findMany.mockResolvedValue([{ ...record, resharedFrom: { ...record, removedAt: new Date(), linkedServiceListingId: reference.id } }]);
    const result = await service.list({});
    expect(result.data[0].resharedFrom).toBeNull();
    expect(marketplace.projectAnnouncementReference).not.toHaveBeenCalled();
  });

  it('revalidates retained references on body edits and permits explicit conversion to a general post', async () => {
    const { service, prisma, record, marketplace } = harness();
    prisma.post.findUnique.mockResolvedValue({ ...record, linkedServiceListingId: reference.id, purpose: PostPurpose.SERVICE_ANNOUNCEMENT });
    marketplace.validateAnnouncementReference.mockRejectedValue(new ForbiddenException('Listing withdrawn'));
    await expect(service.update(record.id, user, { content: 'New announcement text' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.update).not.toHaveBeenCalled();
    await service.update(record.id, user, { content: 'General update', purpose: CommunityPostPurpose.GENERAL, reference: null });
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ purpose: PostPurpose.GENERAL, linkedServiceListingId: null, linkedGigId: null, linkedJobId: null }) }));
  });

  it('uses the existing job as the opportunity destination without a second application lifecycle', async () => {
    const { service, marketplace } = harness();
    const jobReference = { type: AnnouncementReferenceType.JOB, id: 'job-a' };
    const jobCard = { ...card, ...jobReference, url: '/jobs?job=job-a', title: 'Designer job' };
    marketplace.validateAnnouncementReference.mockResolvedValue({ linkedJobId: jobReference.id });
    marketplace.projectAnnouncementReference.mockResolvedValue(jobCard);
    expect((await service.create(user.id, { spaceId: 'space-a', content: 'We are hiring', purpose: CommunityPostPurpose.OPPORTUNITY, reference: jobReference })).data.linkedRecord).toEqual(jobCard);
  });

  it('derives announcement selection company identity and refuses an unauthorized company voice', async () => {
    const { service, context, marketplace } = harness();
    await expect(service.announcementOptions(user.id, true)).rejects.toBeInstanceOf(ForbiddenException);
    context.forUser.mockResolvedValue({ companyId: 'company-a', companyName: 'Company A', role: CompanyRole.OWNER });
    await service.announcementOptions(user.id, true);
    expect(marketplace.getAnnouncementOptions).toHaveBeenCalledWith(user.id, 'company-a');
    marketplace.isListingWritesEnabled.mockReturnValue(false);
    expect(await service.announcementOptions(user.id)).toEqual({ services: [], projects: [], jobs: [] });
  });

  it('leaves the existing Tide identity and private join-link path intact', async () => {
    const { service, prisma, record, marketplace } = harness();
    prisma.post.findMany.mockResolvedValue([{ ...record, postType: 'TIDE', tideId: 'tide-a' }]);
    expect((await service.list({})).data[0]).toMatchObject({ postType: 'TIDE', tideId: 'tide-a', purpose: 'general', linkedRecord: null });
    expect(marketplace.projectAnnouncementReference).not.toHaveBeenCalled();
  });
});
