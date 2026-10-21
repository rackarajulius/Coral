import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WRITE_TRANSACTION } from '../common/database-transaction';
import { isPublicProviderReady } from '../freelancers/provider-profile-policy';
import { LIVE_JOB_STATUSES } from '../jobs/job-lifecycle.service';
import { CATEGORIES, CURRENCIES, ListingReportDto, MarketplaceQueryDto } from './dto/marketplace.dto';
import { defaults, ListingKind, ListingReference, normalizedLabels, PROJECT_FIELDS, safeWorkUrl, SERVICE_FIELDS, validateFields, validateTransition } from './marketplace-policy';

type Database = Prisma.TransactionClient | PrismaService;
const OWNER_SELECT = {
  id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, status: true, role: true,
  freelancerProfile: { select: { providerEnabled: true, publicPreviewEnabled: true, category: true, headline: true, summary: true, skills: true, portfolioUrl: true, githubUrl: true } },
} satisfies Prisma.UserSelect;
const SHARED_SELECT = {
  id: true, ownerUserId: true, companyId: true, title: true, description: true, category: true, skills: true,
  workMode: true, country: true, city: true, currency: true, publicConsent: true, status: true, removedAt: true,
  publishedAt: true, createdAt: true, updatedAt: true,
  owner: { select: OWNER_SELECT }, company: { select: { id: true, name: true } },
};
const SERVICE_SELECT = { ...SHARED_SELECT, deliverables: true, workSamples: true, availability: true, pricingMode: true, amountMinor: true } satisfies Prisma.ServiceListingSelect;
const PROJECT_SELECT = { ...SHARED_SELECT, scope: true, budgetMode: true, minBudgetMinor: true, maxBudgetMinor: true, deadline: true } satisfies Prisma.ProjectBriefSelect;
type ServiceRecord = Prisma.ServiceListingGetPayload<{ select: typeof SERVICE_SELECT }>;
type ProjectRecord = Prisma.ProjectBriefGetPayload<{ select: typeof PROJECT_SELECT }>;
type RecordValue = ServiceRecord | ProjectRecord;

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}
  isListingWritesEnabled() { return process.env.MARKETPLACE_LISTING_WRITES_ENABLED === 'true'; }
  assertListingWritesEnabled() {
    if (!this.isListingWritesEnabled()) throw new ForbiddenException('Marketplace publishing is not enabled yet. Existing listings can still be paused or closed.');
  }
  async capabilities(userId?: string) {
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: OWNER_SELECT }) : null;
    const companies = user?.status === 'ACTIVE' ? await this.publisherCompanies(this.prisma, user.id) : [];
    return { listingWritesEnabled: this.isListingWritesEnabled(), categories: CATEGORIES, currencies: CURRENCIES,
      canCreateService: !!user && user.status === 'ACTIVE' && ['JOB_SEEKER', 'FREELANCER'].includes(user.role) && !!user.freelancerProfile?.providerEnabled,
      canCreateProject: !!user && user.status === 'ACTIVE' && (['JOB_SEEKER', 'FREELANCER'].includes(user.role) || companies.length > 0), companies };
  }
  async list(kind: ListingKind, query: MarketplaceQueryDto, userId?: string) {
    this.validateQuery(query);
    if (kind !== 'service' && query.availability) throw new BadRequestException('Availability filters apply to services');
    if (!userId) return this.listPublic(kind, query);
    const page = query.page ?? 1, limit = query.limit ?? 12;
    let where: any;
    if (userId) {
      await this.assertActive(this.prisma, userId);
      const companies = await this.publisherCompanies(this.prisma, userId);
      where = { OR: [{ ownerUserId: userId, companyId: null }, { companyId: { in: companies.map(c => c.id) } }] };
    } else where = this.publicWhere(kind);
    where = { AND: [where, {
      ...(query.category ? { category: query.category } : {}),
      ...(query.skill?.trim() ? { normalizedSkills: { has: query.skill.trim().toLocaleLowerCase('en') } } : {}),
      ...(query.workMode ? { workMode: query.workMode } : {}),
      ...(query.country?.trim() ? { country: { equals: query.country.trim(), mode: 'insensitive' } } : {}),
      ...(query.city?.trim() ? { city: { equals: query.city.trim(), mode: 'insensitive' } } : {}),
      ...(query.availability ? { availability: query.availability } : {}),
      ...(query.q?.trim() ? { OR: [{ title: { contains: query.q.trim(), mode: 'insensitive' } }, { description: { contains: query.q.trim(), mode: 'insensitive' } }] } : {}),
    }] };
    const [total, records] = kind === 'service'
      ? await this.prisma.$transaction([this.prisma.serviceListing.count({ where }), this.prisma.serviceListing.findMany({ where, select: SERVICE_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit })])
      : await this.prisma.$transaction([this.prisma.projectBrief.count({ where }), this.prisma.projectBrief.findMany({ where, select: PROJECT_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit })]);
    return { data: records.map(record => this.serialize(kind, record, true)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  private async listPublic(kind: ListingKind, query: MarketplaceQueryDto) {
    const page = query.page ?? 1, limit = query.limit ?? 12;
    const table = Prisma.raw(kind === 'service' ? 'service_listings' : 'project_briefs');
    const pattern = query.q?.trim() ? `%${query.q.trim().replace(/[\\%_]/g, value => `\\${value}`)}%` : null;
    const escape = '\\';
    // Visibility is filtered before LIMIT and COUNT, including current company
    // seats and provider readiness. Hidden records cannot create empty pages.
    const predicate = Prisma.sql`
      listing.status = ${kind === 'service' ? 'published' : 'open'}
      AND listing.public_consent = true AND listing.removed_at IS NULL AND account.status = 'ACTIVE'
      AND (listing.company_id IS NULL OR EXISTS (
        SELECT 1 FROM company_members AS seat WHERE seat.company_id = listing.company_id
        AND seat.user_id = listing.owner_user_id AND seat.status = 'ACTIVE' AND seat.role IN ('OWNER', 'ADMIN')
      ))
      ${kind === 'service' ? Prisma.sql`AND account.role IN ('JOB_SEEKER', 'FREELANCER')
        AND profile.provider_enabled = true AND profile.public_preview_enabled = true
        AND profile.category IN (${Prisma.join([...CATEGORIES])})
        AND length(btrim(coalesce(profile.headline, ''))) >= 3
        AND length(btrim(coalesce(profile.summary, ''))) >= 30
        AND EXISTS (SELECT 1 FROM unnest(profile.skills) AS label WHERE length(btrim(label)) > 0)
        AND (profile.portfolio_url ~* '^https?://[^/@[:space:]]+([/:?#]|$)' OR profile.github_url ~* '^https?://[^/@[:space:]]+([/:?#]|$)')`
        : Prisma.sql`AND (listing.deadline IS NULL OR listing.deadline > now())`}
      ${query.category ? Prisma.sql`AND listing.category = ${query.category}` : Prisma.empty}
      ${query.skill?.trim() ? Prisma.sql`AND ${query.skill.trim().toLocaleLowerCase('en')} = ANY(listing.normalized_skills)` : Prisma.empty}
      ${query.workMode ? Prisma.sql`AND listing.work_mode = ${query.workMode}` : Prisma.empty}
      ${query.country?.trim() ? Prisma.sql`AND lower(listing.country) = lower(${query.country.trim()})` : Prisma.empty}
      ${query.city?.trim() ? Prisma.sql`AND lower(listing.city) = lower(${query.city.trim()})` : Prisma.empty}
      ${kind === 'service' && query.availability ? Prisma.sql`AND listing.availability = ${query.availability}` : Prisma.empty}
      ${pattern ? Prisma.sql`AND (listing.title ILIKE ${pattern} ESCAPE ${escape} OR listing.description ILIKE ${pattern} ESCAPE ${escape})` : Prisma.empty}
    `;
    const joins = Prisma.sql`FROM ${table} AS listing JOIN users AS account ON account.id = listing.owner_user_id
      ${kind === 'service' ? Prisma.sql`JOIN freelancer_profiles AS profile ON profile.user_id = account.id` : Prisma.empty}`;
    const [count, ids] = await this.prisma.$transaction([
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT count(*) AS total ${joins} WHERE ${predicate}`),
      this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT listing.id ${joins} WHERE ${predicate}
        ORDER BY listing.created_at DESC, listing.id ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    ]);
    const total = Number(count[0]?.total ?? 0);
    const records = kind === 'service'
      ? await this.prisma.serviceListing.findMany({ where: { id: { in: ids.map(value => value.id) } }, select: SERVICE_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
      : await this.prisma.projectBrief.findMany({ where: { id: { in: ids.map(value => value.id) } }, select: PROJECT_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    const visible: RecordValue[] = [];
    for (const record of records) if (await this.isPublic(kind, record, this.prisma)) visible.push(record);
    return { data: visible.map(record => this.serialize(kind, record)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async getManaged(kind: ListingKind, id: string, userId: string) { return this.serialize(kind, await this.requireManaged(this.prisma, kind, id, userId), true); }
  async getPublic(kind: ListingKind, id: string, database: Database = this.prisma) {
    const record = await this.find(kind, id, database);
    if (!record || !await this.isPublic(kind, record, database)) throw new NotFoundException('Listing not available');
    return this.serialize(kind, record);
  }
  async create(kind: ListingKind, userId: string, dto: Record<string, any>) {
    this.assertListingWritesEnabled();
    const data = this.writable(kind, dto, true), companyId = dto.companyId ?? null;
    const candidate = { ...defaults(kind), ...data }; validateFields(kind, candidate);
    return this.prisma.$transaction(async tx => {
      await this.lockActor(tx, userId); await this.assertCreator(tx, kind, userId, companyId);
      const record = kind === 'service'
        ? await tx.serviceListing.create({ data: { ...candidate, ownerUserId: userId, companyId } as Prisma.ServiceListingUncheckedCreateInput, select: SERVICE_SELECT })
        : await tx.projectBrief.create({ data: { ...candidate, ownerUserId: userId, companyId } as Prisma.ProjectBriefUncheckedCreateInput, select: PROJECT_SELECT });
      return this.serialize(kind, record, true);
    }, WRITE_TRANSACTION);
  }
  async update(kind: ListingKind, id: string, userId: string, dto: Record<string, any>) {
    this.assertListingWritesEnabled(); const data = this.writable(kind, dto);
    return this.prisma.$transaction(async tx => {
      await this.lockRecord(tx, kind, id); const existing = await this.requireManaged(tx, kind, id, userId);
      if (existing.status === 'archived' || existing.removedAt) throw new BadRequestException('Archived or removed records cannot be edited');
      await this.assertCreator(tx, kind, userId, existing.companyId);
      const candidate = { ...existing, ...data };
      if (data.publicConsent === false && ['published', 'open'].includes(existing.status)) data.status = 'paused';
      validateFields(kind, candidate, data.status !== 'paused' && ['published', 'open'].includes(existing.status));
      if (data.status !== 'paused' && existing.status === 'published') await this.assertProviderPublic(tx, existing.ownerUserId);
      const record = kind === 'service' ? await tx.serviceListing.update({ where: { id }, data, select: SERVICE_SELECT }) : await tx.projectBrief.update({ where: { id }, data, select: PROJECT_SELECT });
      return this.serialize(kind, record, true);
    }, WRITE_TRANSACTION);
  }
  async transition(kind: ListingKind, id: string, userId: string, next: string) {
    const publishing = next === (kind === 'service' ? 'published' : 'open'); if (publishing) this.assertListingWritesEnabled();
    return this.prisma.$transaction(async tx => {
      await this.lockRecord(tx, kind, id); const existing = await this.requireManaged(tx, kind, id, userId);
      validateTransition(kind, existing.status, next);
      if (existing.removedAt && next !== 'archived') throw new BadRequestException('Removed records cannot be republished');
      if (publishing) {
        await this.assertCreator(tx, kind, userId, existing.companyId);
        if (existing.ownerUserId !== userId) await this.assertCreator(tx, kind, existing.ownerUserId, existing.companyId);
        validateFields(kind, existing, true); if (kind === 'service') await this.assertProviderPublic(tx, existing.ownerUserId);
      }
      const data = { status: next, ...(publishing ? { publishedAt: new Date() } : {}) };
      const record = kind === 'service' ? await tx.serviceListing.update({ where: { id }, data, select: SERVICE_SELECT }) : await tx.projectBrief.update({ where: { id }, data, select: PROJECT_SELECT });
      return this.serialize(kind, record, true);
    }, WRITE_TRANSACTION);
  }
  async report(kind: ListingKind, id: string, userId: string, dto: ListingReportDto) {
    if (Object.keys(dto).some(k => !['reason', 'details'].includes(k)) || !['spam', 'fraud', 'harassment', 'inappropriate', 'other'].includes(dto.reason)
      || (dto.details !== undefined && (typeof dto.details !== 'string' || dto.details.length > 1000))) throw new BadRequestException('Invalid report');
    return this.prisma.$transaction(async tx => {
      await this.lockRecord(tx, kind, id); await this.lockActor(tx, userId); await this.assertActive(tx, userId); await this.getPublic(kind, id, tx);
      const target = kind === 'service' ? { serviceListingId: id } : { projectBriefId: id };
      const unique = kind === 'service' ? { reporterId_serviceListingId: { reporterId: userId, serviceListingId: id } } : { reporterId_projectBriefId: { reporterId: userId, projectBriefId: id } };
      const details = dto.details?.trim() || null;
      const existing = await tx.marketplaceReport.findUnique({ where: unique, select: { reason: true, details: true } });
      const changed = !!existing && (existing.reason !== dto.reason || existing.details !== details);
      await tx.marketplaceReport.upsert({ where: unique, create: { reporterId: userId, ...target, reason: dto.reason, details },
        update: { reason: dto.reason, details, ...(changed ? { status: 'open', reviewedAt: null, reviewedById: null } : {}) } });
      return { reported: true };
    }, WRITE_TRANSACTION);
  }
  async validateAnnouncementReference(userId: string, reference: ListingReference, companyId?: string | null, database: Database = this.prisma) {
    this.assertListingWritesEnabled();
    if (!reference || !['service', 'project', 'job'].includes(reference.type) || typeof reference.id !== 'string') throw new BadRequestException('Invalid listing reference');
    if (reference.type === 'job') {
      if (database !== this.prisma) await database.$queryRaw(Prisma.sql`SELECT id FROM jobs WHERE id = ${reference.id} FOR UPDATE`);
      const job = await database.job.findUnique({ where: { id: reference.id }, select: { id: true, postedById: true, postedBy: { select: { status: true, employerProfile: { select: { companyId: true } } } }, status: true, applicationDeadline: true } });
      if (!job || !this.publicJob(job)) throw new BadRequestException('Choose a currently public job');
      const canonicalCompanyId = job.postedBy.employerProfile?.companyId ?? null;
      await this.assertAttribution(database, userId, job.postedById, canonicalCompanyId, companyId ?? null);
      return { linkedJobId: job.id };
    }
    if (database !== this.prisma) await this.lockRecord(database, reference.type, reference.id);
    const record = await this.find(reference.type, reference.id, database);
    if (!record || !await this.isPublic(reference.type, record, database)) throw new BadRequestException('Choose a currently public listing');
    await this.assertAttribution(database, userId, record.ownerUserId, record.companyId, companyId ?? null);
    return reference.type === 'service' ? { linkedServiceListingId: record.id } : { linkedGigId: record.id };
  }
  async projectAnnouncementReference(reference: ListingReference, database: Database = this.prisma) {
    if (reference.type === 'job') {
      const job = await database.job.findUnique({ where: { id: reference.id }, select: { id: true, title: true, description: true, category: true, status: true, applicationDeadline: true, postedById: true, postedBy: { select: { ...OWNER_SELECT, employerProfile: { select: { companyId: true, company: { select: { id: true, name: true } } } } } } } });
      if (!job || !this.publicJob(job)) return null;
      const company = job.postedBy.employerProfile?.company ?? null;
      // Job publishing already has its own company-seat policy (including
      // recruiters). Community company voice is checked on the announcing
      // actor, not by promoting the job's historical author to OWNER/ADMIN.
      return { type: 'job', id: job.id, title: job.title, description: job.description.slice(0, 240), category: job.category, status: job.status, url: `/jobs?job=${encodeURIComponent(job.id)}`, owner: this.publicOwner(job.postedBy), company };
    }
    const record = await this.find(reference.type, reference.id, database);
    if (!record || !await this.isPublic(reference.type, record, database)) return null;
    const card = this.serialize(reference.type, record);
    return { ...card, type: reference.type, description: card.description.slice(0, 240), url: reference.type === 'service' ? `/services/${card.id}` : `/projects/${card.id}` };
  }
  async getAnnouncementOptions(userId: string, companyId?: string | null) {
    await this.assertActive(this.prisma, userId); if (companyId) await this.assertPublisher(this.prisma, userId, companyId);
    const where = companyId ? { companyId } : { companyId: null, ownerUserId: userId };
    const [services, projects, jobs] = await Promise.all([
      this.prisma.serviceListing.findMany({ where: { AND: [where, this.publicWhere('service')] }, select: { id: true }, take: 50, orderBy: { createdAt: 'desc' } }),
      this.prisma.projectBrief.findMany({ where: { AND: [where, this.publicWhere('project')] }, select: { id: true }, take: 50, orderBy: { createdAt: 'desc' } }),
      this.prisma.job.findMany({ where: { status: { in: LIVE_JOB_STATUSES }, ...(companyId ? { postedBy: { employerProfile: { companyId } } } : { postedById: userId, postedBy: { employerProfile: { companyId: null } } }) }, select: { id: true }, take: 50, orderBy: { createdAt: 'desc' } }),
    ]);
    const cards = async (type: ListingReference['type'], ids: Array<{ id: string }>) => (await Promise.all(ids.map(record => this.projectAnnouncementReference({ type, id: record.id })))).filter(Boolean);
    const [serviceCards, projectCards, jobCards] = await Promise.all([cards('service', services), cards('project', projects), cards('job', jobs)]);
    return { services: serviceCards, projects: projectCards, jobs: jobCards };
  }
  private publicWhere(kind: ListingKind): any {
    const base = { publicConsent: true, removedAt: null, status: kind === 'service' ? 'published' : 'open', owner: { status: 'ACTIVE', ...(kind === 'service' ? { role: { in: ['JOB_SEEKER', 'FREELANCER'] }, freelancerProfile: { is: { providerEnabled: true, publicPreviewEnabled: true, category: { in: [...CATEGORIES] }, headline: { not: '' }, summary: { not: '' }, skills: { isEmpty: false }, OR: [{ portfolioUrl: { not: '' } }, { githubUrl: { not: '' } }] } } } : {}) } };
    return { AND: [base, ...(kind === 'project' ? [{ OR: [{ deadline: null }, { deadline: { gt: new Date() } }] }] : [])] };
  }
  private async isPublic(kind: ListingKind, record: RecordValue, database: Database) {
    if (record.status !== (kind === 'service' ? 'published' : 'open') || !record.publicConsent || record.removedAt || record.owner.status !== 'ACTIVE') return false;
    if (kind === 'service' && !isPublicProviderReady(record.owner.freelancerProfile, record.owner)) return false;
    if (kind === 'project' && (record as ProjectRecord).deadline && (record as ProjectRecord).deadline! <= new Date()) return false;
    return !record.companyId || await this.isPublisher(database, record.ownerUserId, record.companyId);
  }
  private find(kind: ListingKind, id: string, database: Database): Promise<RecordValue | null> {
    return kind === 'service' ? database.serviceListing.findUnique({ where: { id }, select: SERVICE_SELECT }) : database.projectBrief.findUnique({ where: { id }, select: PROJECT_SELECT });
  }
  private async assertActive(database: Database, userId: string) {
    const user = await database.user.findUnique({ where: { id: userId }, select: OWNER_SELECT });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('An active account is required'); return user;
  }
  private async assertCreator(database: Database, kind: ListingKind, userId: string, companyId: string | null) {
    const user = await this.assertActive(database, userId); if (companyId) await this.assertPublisher(database, userId, companyId);
    if (kind === 'service' && (!['JOB_SEEKER', 'FREELANCER'].includes(user.role) || !user.freelancerProfile?.providerEnabled)) throw new ForbiddenException('Enable offering services on your personal account first');
    if (kind === 'project' && !companyId && !['JOB_SEEKER', 'FREELANCER'].includes(user.role)) throw new ForbiddenException('Choose a company you can publish for');
  }
  private async assertProviderPublic(database: Database, userId: string) {
    await this.lockActor(database, userId); const user = await this.assertActive(database, userId);
    if (!isPublicProviderReady(user.freelancerProfile, user)) throw new BadRequestException('Publish a complete provider preview before publishing services');
  }
  private async publisherCompanies(database: Database, userId: string) {
    const seats = await database.companyMember.findMany({ where: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } }, select: { company: { select: { id: true, name: true } } }, orderBy: { companyId: 'asc' } }); return seats.map(seat => seat.company);
  }
  private async isPublisher(database: Database, userId: string, companyId: string) {
    const seat = await database.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } }, select: { status: true, role: true, user: { select: { status: true } } } });
    return !!seat && seat.status === 'ACTIVE' && ['OWNER', 'ADMIN'].includes(seat.role) && seat.user.status === 'ACTIVE';
  }
  private async assertPublisher(database: Database, userId: string, companyId: string) {
    if (database !== this.prisma) await database.$queryRaw(Prisma.sql`SELECT id FROM company_members WHERE company_id = ${companyId} AND user_id = ${userId} FOR UPDATE`);
    if (!await this.isPublisher(database, userId, companyId)) throw new ForbiddenException('Current company owner or admin authority is required');
  }
  private async requireManaged(database: Database, kind: ListingKind, id: string, userId: string) {
    await this.lockActor(database, userId); await this.assertActive(database, userId); const record = await this.find(kind, id, database);
    if (!record) throw new NotFoundException('Listing not available');
    if (record.companyId) await this.assertPublisher(database, userId, record.companyId); else if (record.ownerUserId !== userId) throw new NotFoundException('Listing not available'); return record;
  }
  private async assertAttribution(database: Database, actorId: string, ownerId: string, canonicalCompanyId: string | null, companyId: string | null) {
    await this.lockActor(database, actorId); await this.assertActive(database, actorId);
    if (canonicalCompanyId !== companyId) throw new BadRequestException('Listing attribution must match its canonical owner');
    if (companyId) await this.assertPublisher(database, actorId, companyId); else if (ownerId !== actorId) throw new ForbiddenException('Only the listing owner can announce it');
  }
  private publicJob(job: { status: string; applicationDeadline: Date | null; postedBy: { status: string } }) { return LIVE_JOB_STATUSES.includes(job.status) && job.postedBy.status === 'ACTIVE' && (!job.applicationDeadline || job.applicationDeadline > new Date()); }
  private async lockActor(database: Database, userId: string) { if (database !== this.prisma) await database.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`); }
  private async lockRecord(database: Database, kind: ListingKind, id: string) {
    if (kind === 'service') await database.$queryRaw(Prisma.sql`SELECT id FROM service_listings WHERE id = ${id} FOR UPDATE`); else await database.$queryRaw(Prisma.sql`SELECT id FROM project_briefs WHERE id = ${id} FOR UPDATE`);
  }
  private validateQuery(query: MarketplaceQueryDto) {
    const page = query.page ?? 1, limit = query.limit ?? 12;
    if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 50 || (query.q?.length ?? 0) > 100 || (query.skill?.length ?? 0) > 60
      || (query.country?.length ?? 0) > 100 || (query.city?.length ?? 0) > 100
      || (query.availability && !['available', 'limited', 'unavailable'].includes(query.availability))
      || (query.category && !CATEGORIES.includes(query.category as any)) || (query.workMode && !['remote', 'hybrid', 'onsite'].includes(query.workMode))) throw new BadRequestException('Invalid marketplace search');
  }
  private writable(kind: ListingKind, dto: Record<string, any>, creating = false): Record<string, any> {
    const allowed = kind === 'service' ? SERVICE_FIELDS : PROJECT_FIELDS;
    if (Object.keys(dto).some(key => !allowed.includes(key) && !(creating && key === 'companyId'))) throw new BadRequestException('Only listing fields may be edited');
    if (creating && dto.companyId !== undefined && (typeof dto.companyId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(dto.companyId))) throw new BadRequestException('Invalid company context');
    const data: Record<string, any> = {};
    for (const key of allowed) if (dto[key] !== undefined) data[key] = typeof dto[key] === 'string' ? dto[key].trim() : dto[key];
    if (data.skills) { data.skills = normalizedLabels(data.skills); data.normalizedSkills = data.skills.map((value: string) => value.toLocaleLowerCase('en')); }
    if (data.deliverables) data.deliverables = normalizedLabels(data.deliverables);
    if (data.workSamples) data.workSamples = data.workSamples.map((sample: any) => ({ ...sample, label: typeof sample.label === 'string' ? sample.label.trim() : sample.label }));
    if (data.deadline !== undefined) data.deadline = data.deadline === null || data.deadline === '' ? null : new Date(data.deadline); return data;
  }
  private publicOwner(owner: RecordValue['owner']) {
    return { id: owner.id, displayName: owner.displayName || `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || 'Coral member', avatarUrl: safeWorkUrl(owner.avatarUrl), profileUrl: isPublicProviderReady(owner.freelancerProfile, owner) ? `/providers/${owner.id}` : null };
  }
  private serialize(kind: ListingKind, record: RecordValue, managed = false) {
    const common = { id: record.id, title: record.title, description: record.description, category: record.category, skills: record.skills, workMode: record.workMode, country: record.country, city: record.city, currency: record.currency, status: record.status,
      publishedAt: record.publishedAt, createdAt: record.createdAt, updatedAt: record.updatedAt, owner: this.publicOwner(record.owner), company: record.company };
    const fields = kind === 'service' ? { deliverables: (record as ServiceRecord).deliverables, workSamples: Array.isArray((record as ServiceRecord).workSamples) ? ((record as ServiceRecord).workSamples as any[]).filter(sample => safeWorkUrl(sample?.url)).map(sample => ({ label: sample.label, url: safeWorkUrl(sample.url) })) : [], availability: (record as ServiceRecord).availability, pricingMode: (record as ServiceRecord).pricingMode, amountMinor: (record as ServiceRecord).amountMinor }
      : { scope: (record as ProjectRecord).scope, budgetMode: (record as ProjectRecord).budgetMode, minBudgetMinor: (record as ProjectRecord).minBudgetMinor, maxBudgetMinor: (record as ProjectRecord).maxBudgetMinor, deadline: (record as ProjectRecord).deadline };
    return { ...common, ...fields, ...(managed ? { ownerUserId: record.ownerUserId, companyId: record.companyId, publicConsent: record.publicConsent, removed: !!record.removedAt,
      permissions: { canEdit: this.isListingWritesEnabled() && record.status !== 'archived' && !record.removedAt, canPublish: this.isListingWritesEnabled() && record.status !== 'archived' && !record.removedAt,
        canPause: ['published', 'open'].includes(record.status), canClose: kind === 'project' && ['open', 'paused'].includes(record.status), canArchive: record.status !== 'archived' } } : {}) };
  }
}
