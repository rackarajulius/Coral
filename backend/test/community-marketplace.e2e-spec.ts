import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PostsService } from '../src/community/posts/posts.service';
import { MarketplaceService } from '../src/marketplace/marketplace.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { AnnouncementReferenceType, CommunityPostPurpose } from '../src/community/posts/dto/create-post.dto';
import { createTestDatabase } from './support/database';

const cast = <T>(value: unknown): T => value as T;

// Production post + canonical listing services with PostgreSQL. Auth, uploads,
// identity badges and notifications are outside this isolated service suite.
describe('Community canonical marketplace links (PostgreSQL)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let prisma: PrismaClient;
  let marketplace: MarketplaceService;
  let posts: PostsService;
  let spaceId: string;
  const previousFlag = process.env.MARKETPLACE_LISTING_WRITES_ENABLED;

  beforeAll(async () => {
    process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true';
    database = await createTestDatabase();
    prisma = database.prisma;
    marketplace = new MarketplaceService(cast(prisma));
    posts = new PostsService(cast(prisma), cast({ assertPostable: jest.fn() }), cast({ resolve: jest.fn().mockResolvedValue(new Map()) }),
      cast({ assertOwnMedia: jest.fn() }), cast({}), cast({ firstUrl: jest.fn().mockReturnValue(null) }), new CompanyContextService(cast(prisma)), cast({ create: jest.fn().mockResolvedValue(undefined) }), marketplace);
    spaceId = (await prisma.space.create({ data: { name: 'Design work', slug: randomUUID() } })).id;
  }, 240_000);
  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.MARKETPLACE_LISTING_WRITES_ENABLED;
    else process.env.MARKETPLACE_LISTING_WRITES_ENABLED = previousFlag;
    if (database) await database.close();
  });

  async function provider() {
    const user = await prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: 'JOB_SEEKER', status: 'ACTIVE', displayName: 'Pilot designer' } });
    await prisma.freelancerProfile.create({ data: { userId: user.id, providerEnabled: true, publicPreviewEnabled: true, category: 'design', headline: 'Product designer', summary: 'Designing useful products for companies and professionals.', skills: ['Design'], expertise: [], portfolioUrl: 'https://example.test/work' } });
    return user;
  }
  async function service(ownerUserId: string) {
    return prisma.serviceListing.create({ data: { ownerUserId, title: 'Design your product interface', description: 'A canonical public service description with actual deliverables.', category: 'design', skills: ['Design'], deliverables: ['Interface designs'], publicConsent: true, status: 'published', publishedAt: new Date(), currency: 'CAD', pricingMode: 'fixed', amountMinor: 25000 } });
  }
  async function announcement(ownerId: string, serviceId: string) {
    return posts.create(ownerId, { spaceId, content: 'Take a look at my service', purpose: CommunityPostPurpose.SERVICE_ANNOUNCEMENT, reference: { type: AnnouncementReferenceType.SERVICE, id: serviceId } });
  }

  it('persists canonical foreign keys and reads current title and price rather than a snapshot', async () => {
    const author = await provider();
    const listing = await service(author.id);
    const post = (await announcement(author.id, listing.id)).data;
    const stored = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(stored).toMatchObject({ purpose: 'SERVICE_ANNOUNCEMENT', linkedServiceListingId: listing.id });
    expect(post.linkedRecord).toMatchObject({ id: listing.id, title: listing.title, amountMinor: 25000, url: `/services/${listing.id}` });
    await prisma.serviceListing.update({ where: { id: listing.id }, data: { title: 'An updated service title', amountMinor: 35000 } });
    expect((await posts.getById(post.id)).linkedRecord).toMatchObject({ title: 'An updated service title', amountMinor: 35000 });
  });

  it('denies announcing a foreign service without creating a post', async () => {
    const owner = await provider(), stranger = await provider();
    const listing = await service(owner.id);
    const before = await prisma.post.count({ where: { authorId: stranger.id } });
    await expect(announcement(stranger.id, listing.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.post.count({ where: { authorId: stranger.id } })).toBe(before);
  });

  it.each(['paused', 'closed', 'archived'])('removes %s service details and links from an existing post and reshare', async (status) => {
    const owner = await provider(), sharer = await provider();
    const listing = await service(owner.id);
    const post = (await announcement(owner.id, listing.id)).data;
    const share = (await posts.reshare(post.id, sharer.id, 'Useful work')).data;
    // Simulate a previously generated unfurl: it must never bypass privacy.
    await prisma.post.update({ where: { id: post.id }, data: { linkPreview: { title: 'Old canonical title', description: listing.description } } });
    await prisma.serviceListing.update({ where: { id: listing.id }, data: { status } });
    expect(await posts.getById(post.id, owner)).toMatchObject({ linkedRecord: null, linkedRecordUnavailable: true, linkPreview: null });
    const reshared = await posts.getById(share.id);
    expect(reshared.resharedFrom).toMatchObject({ linkedRecord: null, linkedRecordUnavailable: true, linkPreview: null });
    expect(JSON.stringify(reshared)).not.toContain(listing.description);
    expect(JSON.stringify(reshared)).not.toContain('Old canonical title');
    await expect(posts.update(post.id, owner, { content: 'Reannounce a closed listing' })).rejects.toBeInstanceOf(BadRequestException);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).content).toBe('Take a look at my service');
  });

  it.each(['listing consent', 'provider preview consent', 'moderation removal', 'owner suspension'])('honors %s withdrawal on the next read', async (reason) => {
    const owner = await provider(), listing = await service(owner.id);
    const post = (await announcement(owner.id, listing.id)).data;
    if (reason === 'listing consent') await prisma.serviceListing.update({ where: { id: listing.id }, data: { publicConsent: false } });
    if (reason === 'provider preview consent') await prisma.freelancerProfile.update({ where: { userId: owner.id }, data: { publicPreviewEnabled: false } });
    if (reason === 'moderation removal') await prisma.serviceListing.update({ where: { id: listing.id }, data: { removedAt: new Date() } });
    if (reason === 'owner suspension') await prisma.user.update({ where: { id: owner.id }, data: { status: 'SUSPENDED' } });
    const payload = await posts.getById(post.id);
    expect(payload).toMatchObject({ linkedRecord: null, linkedRecordUnavailable: true });
    expect(JSON.stringify(payload)).not.toContain(listing.title);
    expect(JSON.stringify(payload)).not.toContain(listing.description);
  });

  it('routes project opportunities to the canonical brief and removes closed brief actions', async () => {
    const owner = await provider();
    const project = await prisma.projectBrief.create({ data: { ownerUserId: owner.id, title: 'Design a website', description: 'We need a website for our pilot business.', scope: 'Five website pages', publicConsent: true, status: 'open' } });
    const post = (await posts.create(owner.id, { spaceId, content: 'A new project brief', purpose: CommunityPostPurpose.OPPORTUNITY, reference: { type: AnnouncementReferenceType.PROJECT, id: project.id } })).data;
    expect(post.linkedRecord).toMatchObject({ type: 'project', id: project.id, url: `/projects/${project.id}` });
    await marketplace.transition('project', project.id, owner.id, 'closed');
    expect((await posts.getById(post.id)).linkedRecord).toBeNull();
    expect((await posts.announcementOptions(owner.id)).projects).toHaveLength(0);
  });

  it('lets a current company owner announce a recruiter-created live job through the existing apply page', async () => {
    const [owner, recruiter] = await Promise.all(['OWNER', 'RECRUITER'].map((label) => prisma.user.create({ data: { supabaseId: randomUUID(), email: `${randomUUID()}@example.test`, role: 'EMPLOYER', status: 'ACTIVE', displayName: label } })));
    const company = await prisma.company.create({ data: { name: 'Pilot hiring company', members: { create: [{ userId: owner.id, role: 'OWNER' }, { userId: recruiter.id, role: 'RECRUITER' }] } } });
    await prisma.employerProfile.create({ data: { userId: recruiter.id, companyId: company.id, companyName: company.name, jobTitle: 'Recruiter', companyBenefits: [], verificationStatus: 'verified' } });
    const job = await prisma.job.create({ data: { postedById: recruiter.id, title: 'Product designer', slug: randomUUID(), description: 'Design products with our team.', employmentType: 'full-time', status: 'active', publishedAt: new Date(), applicationMethod: 'internal' } });
    const reference = { type: AnnouncementReferenceType.JOB, id: job.id };
    const post = (await posts.create(owner.id, { spaceId, asCompany: true, content: 'Join our design team', purpose: CommunityPostPurpose.OPPORTUNITY, reference })).data;
    expect(post.linkedRecord).toMatchObject({ type: 'job', id: job.id, url: `/jobs?job=${job.id}`, company: { id: company.id } });
    expect((await posts.announcementOptions(owner.id, true)).jobs).toEqual(expect.arrayContaining([expect.objectContaining({ id: job.id })]));
    expect(await prisma.application.count({ where: { jobId: job.id } })).toBe(0);
    await expect(posts.create(recruiter.id, { spaceId, asCompany: true, content: 'Not authorized for community company voice', purpose: CommunityPostPurpose.OPPORTUNITY, reference })).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.companyMember.update({ where: { companyId_userId: { companyId: company.id, userId: owner.id } }, data: { status: 'REMOVED' } });
    await expect(posts.update(post.id, owner, { content: 'Former owner edit' })).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.job.update({ where: { id: job.id }, data: { status: 'closed' } });
    expect((await posts.getById(post.id)).linkedRecord).toBeNull();
  });

  it('selects a current company explicitly after an older removed seat without changing legacy company voice', async () => {
    const owner = await provider();
    const olderCompany = await prisma.company.create({ data: { name: 'Previous company', members: { create: {
      userId: owner.id, role: 'OWNER', status: 'REMOVED', createdAt: new Date(Date.now() - 60_000),
    } } } });
    const currentCompany = await prisma.company.create({ data: { name: 'Current Canadian company', members: { create: { userId: owner.id, role: 'OWNER', status: 'ACTIVE' } } } });
    const project = await prisma.projectBrief.create({ data: { ownerUserId: owner.id, companyId: currentCompany.id,
      title: 'Build our current company website', description: 'A project brief published for our current Canadian company.',
      scope: 'Design and build our company website with accessible pages.', publicConsent: true, status: 'open' } });
    const reference = { type: AnnouncementReferenceType.PROJECT, id: project.id };
    expect(await posts.companyVoiceFor(owner.id)).toBeNull();
    await expect(posts.announcementOptions(owner.id, true)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await posts.announcementOptions(owner.id, true, currentCompany.id)).projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id })]));
    const post = (await posts.create(owner.id, { spaceId, asCompany: true, companyId: currentCompany.id,
      content: 'Our current company is looking for help', purpose: CommunityPostPurpose.OPPORTUNITY, reference })).data;
    expect(post).toMatchObject({ companyId: currentCompany.id, linkedRecord: { id: project.id, company: { id: currentCompany.id } } });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).companyId).not.toBe(olderCompany.id);
    await expect(posts.announcementOptions(owner.id, false, currentCompany.id)).rejects.toBeInstanceOf(BadRequestException);
    await expect(posts.create(owner.id, { spaceId, companyId: currentCompany.id, content: 'Company choice without company publishing',
      purpose: CommunityPostPurpose.OPPORTUNITY, reference })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['foreign', 'revoked', 'recruiter'] as const)('rejects an explicit %s company choice for options and publication', async (access) => {
    const publisher = await provider(), actor = await provider();
    const company = await prisma.company.create({ data: { name: `Company selection ${access}`, members: { create: { userId: publisher.id, role: 'OWNER', status: 'ACTIVE' } } } });
    if (access !== 'foreign') await prisma.companyMember.create({ data: { companyId: company.id, userId: actor.id,
      role: access === 'recruiter' ? 'RECRUITER' : 'OWNER', status: access === 'revoked' ? 'REMOVED' : 'ACTIVE' } });
    const project = await prisma.projectBrief.create({ data: { ownerUserId: publisher.id, companyId: company.id,
      title: 'A company-owned project', description: 'A public project with a currently authorized owner.', scope: 'Create and document a professional company website.',
      publicConsent: true, status: 'open' } });
    const before = await prisma.post.count({ where: { authorId: actor.id } });
    await expect(posts.announcementOptions(actor.id, true, company.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(posts.create(actor.id, { spaceId, asCompany: true, companyId: company.id, content: 'An unauthorized company announcement',
      purpose: CommunityPostPurpose.OPPORTUNITY, reference: { type: AnnouncementReferenceType.PROJECT, id: project.id } })).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.post.count({ where: { authorId: actor.id } })).toBe(before);
  });

  it('preserves old ordinary posts and keeps publishing general posts available when the marketplace flag is off', async () => {
    const owner = await provider();
    const old = await prisma.post.create({ data: { authorId: owner.id, content: 'Existing community discussion' } });
    process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'false';
    try {
      expect(await posts.getById(old.id)).toMatchObject({ purpose: 'general', linkedRecord: null });
      expect((await posts.create(owner.id, { spaceId, content: 'A professional question', purpose: CommunityPostPurpose.QUESTION })).data.purpose).toBe('question');
      const listing = await service(owner.id);
      await expect(announcement(owner.id, listing.id)).rejects.toBeInstanceOf(ForbiddenException);
      expect(await posts.announcementOptions(owner.id)).toEqual({ services: [], projects: [], jobs: [] });
    } finally { process.env.MARKETPLACE_LISTING_WRITES_ENABLED = 'true'; }
  });
});
