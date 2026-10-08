import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExternalApplicationsService } from '../../../src/applications/external-applications.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';

describe('ExternalApplicationsService', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const upsert = jest.fn();
  const update = jest.fn();
  const deleteMany = jest.fn();
  const updateMany = jest.fn();
  const notify = jest.fn();
  const service = new ExternalApplicationsService({
    externalApplication: { findMany, findFirst, upsert, update, deleteMany, updateMany },
  } as unknown as PrismaService, { create: notify } as unknown as NotificationsService);

  beforeEach(() => jest.clearAllMocks());

  it('saves a link without claiming the seeker applied, and leaves existing progress intact', async () => {
    upsert.mockResolvedValue({ id: 'record-1', status: 'saved' });
    await service.create('user-1', {
      sourceKey: 'match:greenhouse:42', title: ' Engineer ', company: 'Acme ', url: 'https://acme.test/jobs/42',
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_sourceKey: { userId: 'user-1', sourceKey: expect.stringMatching(/^url:/) } },
      create: expect.objectContaining({ title: 'Engineer', company: 'Acme', status: 'saved', appliedAt: null }),
      update: {},
    }));
    await service.create('user-1', {
      title: 'Engineer', company: 'Acme', url: 'https://acme.test/jobs/42',
    });
    expect(upsert.mock.calls[1][0].where).toEqual(upsert.mock.calls[0][0].where);
  });

  it('only updates records owned by the seeker and dates an explicit applied status', async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'record-1', status: 'saved', appliedAt: null });
    await expect(service.update('other-user', 'record-1', { status: 'applied' })).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
    update.mockResolvedValue({ id: 'record-1', status: 'applied' });
    await service.update('user-1', 'record-1', { status: 'applied' });
    expect(findFirst).toHaveBeenLastCalledWith({ where: { id: 'record-1', userId: 'user-1' } });
    expect(update.mock.calls[0][0].data).toMatchObject({ status: 'applied', appliedAt: expect.any(Date) });
  });

  it('rejects unsafe job links', async () => {
    await expect(service.create('user-1', {
      title: 'Engineer', company: 'Acme', url: 'javascript:alert(1)',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('scopes deletion to the owner', async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('user-1', 'record-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'record-1', userId: 'user-1' } });
  });

  it('sends a due reminder once after claiming the row', async () => {
    findMany.mockResolvedValue([{ id: 'record-1', userId: 'user-1', title: 'Engineer', company: 'Acme' }]);
    updateMany.mockResolvedValue({ count: 1 });
    notify.mockResolvedValue({ id: 'notification-1' });
    await service.dispatchFollowUps();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'record-1', remindedAt: null }),
    }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', link: '/activity?tab=external',
    }));
  });
});
