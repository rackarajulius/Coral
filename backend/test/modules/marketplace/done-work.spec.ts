import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { MarketplaceRequestsService } from '../../../src/marketplace/marketplace-requests.service';
import { MarketplaceService } from '../../../src/marketplace/marketplace.service';
import { MarketplaceActivityService } from '../../../src/marketplace/marketplace-activity.service';
import { doneWorkFor, doneWorkWhere } from '../../../src/marketplace/done-work';

/**
 * Work done through Coral: one side marks a request done, the other
 * confirms, and only then does it show — with the client's name only if the
 * client agrees.
 */

const CLIENT = '11111111-1111-4111-8111-111111111111';
const PROVIDER = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
const SERVICE = '44444444-4444-4444-8444-444444444444';

type Work = { id: string; proposedById: string; proposedAt: Date; confirmedAt: Date | null; shownByProvider: boolean; clientNamed: boolean };

/** A service enquiry: the client asked, the provider (recipient) does the work. */
function request(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST, kind: 'service', status: 'accepted', source: 'direct',
    requesterId: CLIENT, recipientId: PROVIDER, requesterCompanyId: null, recipientCompanyId: null,
    serviceListingId: SERVICE, projectBriefId: null, completedWork: null as Work | null,
    ...overrides,
  };
}

function harness(record = request()) {
  const tx = {
    completedWork: {
      create: jest.fn().mockResolvedValue({ id: 'work-1' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = { $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  const activity = { record: jest.fn().mockResolvedValue('event-1'), notify: jest.fn() };
  const service = new MarketplaceRequestsService(
    prisma as unknown as PrismaService, {} as MarketplaceService, activity as unknown as MarketplaceActivityService,
  );
  // The locking and participant checks are the existing request machinery; here they hand back the request.
  const internals = service as unknown as Record<string, unknown>;
  internals.lockRequest = jest.fn().mockResolvedValue(record);
  internals.communicable = jest.fn().mockResolvedValue(true);
  internals.find = jest.fn().mockResolvedValue(record);
  internals.serialize = jest.fn().mockResolvedValue({ serialized: true });
  return { service, tx, activity };
}

const proposal = (by: string, confirmedAt: Date | null = null): Work => ({
  id: 'work-1', proposedById: by, proposedAt: new Date(), confirmedAt, shownByProvider: true, clientNamed: false,
});

describe('Saying the work is done', () => {
  it('either side proposes it; the provider is who did the work, and the other side hears', async () => {
    const { service, tx, activity } = harness();
    await service.markDone(CLIENT, REQUEST);
    expect(tx.completedWork.create).toHaveBeenCalledWith({ data: { requestId: REQUEST, providerId: PROVIDER, clientId: CLIENT, proposedById: CLIENT } });
    expect(activity.record).toHaveBeenCalledWith(tx, expect.objectContaining({ type: 'marketplace_work_marked_done' }));
    expect(activity.notify).toHaveBeenCalledWith(tx, 'event-1', REQUEST, PROVIDER);
  });

  it('on a project response the responder is the provider', async () => {
    // The responder (requester) offered to do the client's project.
    const { service, tx } = harness(request({ kind: 'project', serviceListingId: null, projectBriefId: 'brief-1' }));
    await service.markDone(PROVIDER, REQUEST);
    expect(tx.completedWork.create).toHaveBeenCalledWith({ data: expect.objectContaining({ providerId: CLIENT, clientId: PROVIDER }) });
  });

  it('the other side saying so confirms it; saying it twice yourself changes nothing', async () => {
    const theirs = harness(request({ completedWork: proposal(PROVIDER) }));
    await theirs.service.markDone(CLIENT, REQUEST);
    expect(theirs.tx.completedWork.update).toHaveBeenCalledWith({ where: { id: 'work-1' }, data: { confirmedAt: expect.any(Date) } });
    expect(theirs.activity.notify).toHaveBeenCalledWith(theirs.tx, 'event-1', REQUEST, PROVIDER);

    const mine = harness(request({ completedWork: proposal(CLIENT) }));
    await mine.service.markDone(CLIENT, REQUEST);
    expect(mine.tx.completedWork.update).not.toHaveBeenCalled();
    expect(mine.tx.completedWork.create).not.toHaveBeenCalled();
  });

  it('only in an open conversation, and never for work done as a company page', async () => {
    await expect(harness(request({ status: 'pending' })).service.markDone(CLIENT, REQUEST)).rejects.toBeInstanceOf(ConflictException);
    await expect(harness(request({ status: 'declined' })).service.markDone(CLIENT, REQUEST)).rejects.toBeInstanceOf(ConflictException);
    await expect(harness(request({ recipientCompanyId: 'company-1' })).service.markDone(CLIENT, REQUEST)).rejects.toThrow('company page');
  });

  it('"not yet" takes a proposal back, and tells whoever made it', async () => {
    const { service, tx, activity } = harness(request({ completedWork: proposal(PROVIDER) }));
    await service.unmarkDone(CLIENT, REQUEST);
    expect(tx.completedWork.delete).toHaveBeenCalledWith({ where: { id: 'work-1' } });
    expect(activity.record).toHaveBeenCalledWith(tx, expect.objectContaining({ type: 'marketplace_work_not_done' }));
    expect(activity.notify).toHaveBeenCalledWith(tx, 'event-1', REQUEST, PROVIDER);
  });

  it('confirmed work is not undone, only hidden', async () => {
    const { service, tx } = harness(request({ completedWork: proposal(PROVIDER, new Date()) }));
    await expect(service.unmarkDone(CLIENT, REQUEST)).rejects.toThrow('hidden, not undone');
    expect(tx.completedWork.delete).not.toHaveBeenCalled();
  });
});

describe('Who chooses what shows', () => {
  const confirmed = () => harness(request({ completedWork: proposal(PROVIDER, new Date()) }));

  it('the provider shows or hides it; the client names themselves or not', async () => {
    const a = confirmed();
    await a.service.workSettings(PROVIDER, REQUEST, { shown: false });
    expect(a.tx.completedWork.update).toHaveBeenCalledWith({ where: { id: 'work-1' }, data: { shownByProvider: false } });
    const b = confirmed();
    await b.service.workSettings(CLIENT, REQUEST, { named: true });
    expect(b.tx.completedWork.update).toHaveBeenCalledWith({ where: { id: 'work-1' }, data: { clientNamed: true } });
  });

  it("neither decides the other's choice", async () => {
    await expect(confirmed().service.workSettings(CLIENT, REQUEST, { shown: false })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(confirmed().service.workSettings(PROVIDER, REQUEST, { named: true })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nothing to choose before both have confirmed', async () => {
    await expect(harness(request({ completedWork: proposal(PROVIDER) })).service.workSettings(PROVIDER, REQUEST, { shown: false }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});

describe('What visitors see', () => {
  function rows(overrides: Record<string, unknown>[] = [{}]) {
    return overrides.map((row, i) => ({
      id: `work-${i}`, confirmedAt: new Date('2026-10-15T00:00:00Z'), clientNamed: false,
      client: { displayName: null, firstName: 'Ada', lastName: 'Lovelace' },
      request: {
        kind: 'service', serviceListingId: SERVICE, serviceListing: { title: 'Logo design' }, projectBrief: null,
        requesterCompany: null, recipientCompany: null,
      },
      ...row,
    }));
  }
  function prisma(found: unknown[], publicServices: string[] = [SERVICE]) {
    return {
      completedWork: { count: jest.fn().mockResolvedValue(found.length), findMany: jest.fn().mockResolvedValue(found) },
      serviceListing: { findMany: jest.fn().mockResolvedValue(publicServices.map((id) => ({ id }))) },
    };
  }

  it('only confirmed work the provider shows, for clients still active', () => {
    expect(doneWorkWhere(PROVIDER)).toEqual({ providerId: PROVIDER, confirmedAt: { not: null }, shownByProvider: true, client: { status: 'ACTIVE' } });
    expect(doneWorkWhere(PROVIDER, SERVICE)).toMatchObject({ request: { serviceListingId: SERVICE } });
  });

  it('the service and the month, and no client name unless the client agreed', async () => {
    const result = await doneWorkFor(prisma(rows()) as never, PROVIDER);
    expect(result).toEqual({ total: 1, items: [{ id: 'work-0', kind: 'service', title: 'Logo design', serviceId: SERVICE, month: '2026-10', client: null }] });
  });

  it("a named client shows as their company, or themselves", async () => {
    const { items } = await doneWorkFor(prisma(rows([
      { clientNamed: true },
      { clientNamed: true, request: { kind: 'service', serviceListingId: SERVICE, serviceListing: { title: 'Logo design' }, projectBrief: null, requesterCompany: { name: 'Acme Ltd' }, recipientCompany: null } },
    ])) as never, PROVIDER);
    expect(items.map((item) => item.client)).toEqual(['Ada Lovelace', 'Acme Ltd']);
  });

  it("a client's project is named only with their agreement", async () => {
    const project = { kind: 'project', serviceListingId: null, serviceListing: null, projectBrief: { title: 'Bakery ordering site' }, requesterCompany: null, recipientCompany: null };
    const { items } = await doneWorkFor(prisma(rows([{ request: project }, { request: project, clientNamed: true }])) as never, PROVIDER);
    expect(items.map((item) => item.title)).toEqual([null, 'Bakery ordering site']);
  });

  it('links the service only while its page is public', async () => {
    const { items } = await doneWorkFor(prisma(rows(), []) as never, PROVIDER);
    expect(items[0]).toMatchObject({ title: 'Logo design', serviceId: null });
  });
});
