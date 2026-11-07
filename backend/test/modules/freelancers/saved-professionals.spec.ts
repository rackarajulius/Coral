import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FreelancersService } from '../../../src/freelancers/freelancers.service';
import { CitiesService } from '../../../src/locations/cities.service';

const readyProfile = (userId: string, overrides: Record<string, unknown> = {}) => ({
  id: `profile-${userId}`, userId, category: 'design', headline: 'Product designer', title: 'Designer',
  summary: 'I design accessible interfaces and practical products for growing companies.',
  skills: ['Product design'], expertise: [], hourlyRate: null, currency: 'CAD', country: 'Canada', city: 'Toronto',
  timezone: null, availableForRemote: true, availability: 'available', hoursPerWeek: null,
  portfolioUrl: 'https://example.com/work', githubUrl: null, linkedinUrl: null, workPreferences: [],
  createdAt: new Date('2026-10-07T00:00:00Z'), updatedAt: new Date('2026-10-07T00:00:00Z'),
  user: { id: userId, displayName: 'Pro', firstName: 'Pro', lastName: 'Member', avatarUrl: null, email: 'private@example.com' },
  ...overrides,
});
const savedRow = (profile: unknown) => ({ professional: { freelancerProfile: profile } });

function harness() {
  const saved = {
    findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const profiles = { findFirst: jest.fn().mockResolvedValue(readyProfile('pro')) };
  const prisma = { savedProfessional: saved, freelancerProfile: profiles };
  const service = new FreelancersService(prisma as unknown as PrismaService, new CitiesService());
  return { service, saved, profiles };
}

describe('saving a professional', () => {
  it('saves someone public, and saving again changes nothing', async () => {
    const { service, saved } = harness();
    await service.save('client', 'pro');
    expect(saved.upsert).toHaveBeenCalledWith({
      where: { userId_professionalId: { userId: 'client', professionalId: 'pro' } },
      create: { userId: 'client', professionalId: 'pro' },
      update: {},
    });
  });

  it('refuses saving yourself', async () => {
    const { service, saved } = harness();
    await expect(service.save('pro', 'pro')).rejects.toThrow(BadRequestException);
    expect(saved.upsert).not.toHaveBeenCalled();
  });

  it('answers as the profile does for anyone not public, so it reveals no private account', async () => {
    const { service, saved, profiles } = harness();
    profiles.findFirst.mockResolvedValue(null);
    await expect(service.save('client', 'private')).rejects.toThrow(NotFoundException);

    // Public on paper, but too thin to be listed.
    profiles.findFirst.mockResolvedValue(readyProfile('thin', { summary: 'Too short' }));
    await expect(service.save('client', 'thin')).rejects.toThrow(NotFoundException);
    expect(saved.upsert).not.toHaveBeenCalled();
  });

  it('keeps the list bounded', async () => {
    const { service, saved } = harness();
    saved.count.mockResolvedValue(500);
    await expect(service.save('client', 'pro')).rejects.toThrow('You can save up to 500 professionals');
    expect(saved.upsert).not.toHaveBeenCalled();
  });

  it('only ever removes from your own list', async () => {
    const { service, saved } = harness();
    await service.unsave('client', 'pro');
    expect(saved.deleteMany).toHaveBeenCalledWith({ where: { userId: 'client', professionalId: 'pro' } });
  });
});

describe('the saved list', () => {
  it('asks only for your rows, for people public now, newest first', async () => {
    const { service, saved } = harness();
    await service.listSaved('client');
    const query = saved.findMany.mock.calls[0][0];
    expect(query.where.userId).toBe('client');
    expect(query.where.professional.is.freelancerProfile.is).toMatchObject({ providerEnabled: true, publicPreviewEnabled: true });
    expect(query.orderBy[0]).toEqual({ createdAt: 'desc' });
  });

  it('leaves out someone no longer complete, and never sends private fields', async () => {
    const { service, saved } = harness();
    saved.findMany.mockResolvedValue([savedRow(readyProfile('pro')), savedRow(readyProfile('thin', { skills: [] }))]);
    const { items } = await service.listSaved('client');
    expect(items.map((item) => item.userId)).toEqual(['pro']);
    expect(JSON.stringify(items)).not.toContain('private@example.com');
  });

  it('pages by twelve, and offers a next page only when there is one', async () => {
    const { service, saved } = harness();
    saved.findMany.mockResolvedValue(Array.from({ length: 13 }, (_, i) => savedRow(readyProfile(`pro-${i}`))));
    const first = await service.listSaved('client');
    expect(first.items).toHaveLength(12);
    expect(first.nextPage).toBe(2);

    saved.findMany.mockResolvedValue([savedRow(readyProfile('pro-12'))]);
    const second = await service.listSaved('client', 2);
    expect(saved.findMany.mock.calls[1][0].skip).toBe(12);
    expect(second.nextPage).toBeNull();
  });

  it('refuses a page that cannot exist', async () => {
    const { service } = harness();
    await expect(service.listSaved('client', 0)).rejects.toThrow(BadRequestException);
  });

  it('gives the Save buttons a bounded list of ids', async () => {
    const { service, saved } = harness();
    saved.findMany.mockResolvedValue([{ professionalId: 'pro' }]);
    await expect(service.savedIds('client')).resolves.toEqual(['pro']);
    expect(saved.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'client' }, take: 500 });
  });
});
