import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  POPULAR_FOLLOWERS,
  PersonSignals,
  companyReason,
  personReason,
  professionalReason,
  rankProfessionals,
  rankWhoToFollow,
  samePlace,
} from '../../../src/community/follow-suggestions';
import { FollowSuggestionsService } from '../../../src/community/follow-suggestions.service';

/**
 * "Who to follow" and "Professionals for you" on the Following page, as X's
 * connect_people: one honest reason per suggestion, and ✕ that holds.
 */

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADA = 'aaaaaaaa-0000-4000-8000-0000000000ad';
const BEN = 'aaaaaaaa-0000-4000-8000-0000000000be';
const PAGE = 'cccccccc-0000-4000-8000-0000000000c0';

const person = (over: Partial<PersonSignals> & { id: string }): PersonSignals => ({
  followedBy: 0, followsYou: false, spaceId: null, spaceActivity: 0, followers: 0, recentPosts: 0, ...over,
});

describe('the reason on a suggestion', () => {
  it('gives the strongest true thing, best first', () => {
    expect(personReason(person({ id: ADA, followedBy: 1, followsYou: true, spaceId: 's' }))).toBe('followed_by');
    expect(personReason(person({ id: ADA, followsYou: true, spaceId: 's' }))).toBe('follows_you');
    expect(personReason(person({ id: ADA, spaceId: 's', followers: 50 }))).toBe('space');
    expect(personReason(person({ id: ADA, followers: POPULAR_FOLLOWERS }))).toBe('popular');
    expect(personReason(person({ id: ADA, recentPosts: 2 }))).toBe('posting');
  });

  it('says nothing rather than overstate: two followers is not "popular"', () => {
    expect(personReason(person({ id: ADA, followers: POPULAR_FOLLOWERS - 1 }))).toBeNull();
    expect(companyReason({ id: PAGE, followedBy: 0, followers: 1, recentPosts: 0 })).toBeNull();
    expect(professionalReason({ id: ADA, followedBy: 0, followsYou: false, nearYou: false, followers: 900 })).toBeNull();
  });
});

describe('ranking', () => {
  it('puts people your follows follow, and people who follow you, above the merely popular', () => {
    const ranked = rankWhoToFollow(
      [
        person({ id: 'popular', followers: 500 }),
        person({ id: 'fan', followsYou: true }),
        person({ id: 'friend-of-friend', followedBy: 2 }),
      ],
      [],
    );
    expect(ranked.map((r) => r.id)).toEqual(['friend-of-friend', 'fan', 'popular']);
  });

  it('mixes company pages in on the same scale', () => {
    const ranked = rankWhoToFollow(
      [person({ id: 'quiet', recentPosts: 1 })],
      [{ id: PAGE, followedBy: 1, followers: 4, recentPosts: 0 }],
    );
    expect(ranked[0]).toEqual(expect.objectContaining({ kind: 'company', id: PAGE, reason: 'followed_by' }));
    expect(ranked[1]).toEqual(expect.objectContaining({ kind: 'person', id: 'quiet', reason: 'posting' }));
  });

  it('keeps the same order between visits when everything ties', () => {
    const a = rankWhoToFollow([person({ id: BEN }), person({ id: ADA })], []);
    expect(a.map((r) => r.id)).toEqual([ADA, BEN]);
  });

  it('places professionals near you after social reasons', () => {
    const ranked = rankProfessionals([
      { id: 'near', followedBy: 0, followsYou: false, nearYou: true, followers: 0 },
      { id: 'friend', followedBy: 1, followsYou: false, nearYou: false, followers: 0 },
      { id: 'stranger', followedBy: 0, followsYou: false, nearYou: false, followers: 2 },
    ]);
    expect(ranked.map((r) => [r.id, r.reason])).toEqual([['friend', 'followed_by'], ['near', 'near_you'], ['stranger', null]]);
  });
});

describe('the same place', () => {
  it('matches a city however it was typed', () => {
    expect(samePlace({ city: ' Montréal ', country: 'Canada' }, { city: 'montreal', country: 'canada' })).toBe(true);
  });

  it('tells two Londons apart by country, code with code', () => {
    expect(samePlace({ city: 'London', country: null, countryCode: 'CA' }, { city: 'London', country: null, countryCode: 'GB' })).toBe(false);
    expect(samePlace({ city: 'London', country: 'Canada' }, { city: 'London', country: 'United Kingdom' })).toBe(false);
  });

  it('is never true without a city', () => {
    expect(samePlace({ city: null, country: 'Canada' }, { city: null, country: 'Canada' })).toBe(false);
    expect(samePlace(null, { city: 'Toronto', country: null })).toBe(false);
  });
});

describe('dismissing a suggestion', () => {
  const service = (found: unknown = { id: ADA }) => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(found) },
      employerProfile: { findUnique: jest.fn().mockResolvedValue(found) },
      followSuggestionDismissal: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { svc: new FollowSuggestionsService(prisma as never, {} as never), prisma };
  };

  it('is kept per person and kind, and twice is the same as once', async () => {
    const { svc, prisma } = service();
    await expect(svc.dismiss(ME, 'person', ADA)).resolves.toEqual({ kind: 'person', id: ADA, dismissed: true });
    expect(prisma.followSuggestionDismissal.createMany).toHaveBeenCalledWith({
      data: [{ userId: ME, kind: 'person', targetId: ADA }],
      skipDuplicates: true,
    });
  });

  it('looks a company up as a page', async () => {
    const { svc, prisma } = service({ id: PAGE });
    await svc.dismiss(ME, 'company', PAGE);
    expect(prisma.employerProfile.findUnique).toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an unknown kind, or someone who is not there', async () => {
    await expect(service().svc.dismiss(ME, 'space', ADA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service(null).svc.dismiss(ME, 'person', ADA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('can be undone', async () => {
    const { svc, prisma } = service();
    await expect(svc.undismiss(ME, 'company', PAGE)).resolves.toEqual({ kind: 'company', id: PAGE, dismissed: false });
    expect(prisma.followSuggestionDismissal.deleteMany).toHaveBeenCalledWith({ where: { userId: ME, kind: 'company', targetId: PAGE } });
  });
});

describe('Professionals for you', () => {
  const ready = (userId: string, over: Record<string, unknown> = {}) => ({
    userId, providerEnabled: true, publicPreviewEnabled: true,
    category: 'design', headline: 'Brand designer', summary: 'I design brands for small companies in Toronto.',
    skills: ['Figma'], portfolioUrl: 'https://example.com', githubUrl: null,
    city: 'Toronto', country: 'Canada', placeCity: 'Toronto', placeCountryCode: 'CA',
    user: { id: userId, displayName: 'Ada Lovelace', firstName: null, lastName: null, avatarUrl: null, role: 'JOB_SEEKER', status: 'ACTIVE' },
    ...over,
  });

  const service = (profiles: unknown[], dismissed: string[] = []) => {
    const prisma = {
      freelancerProfile: { findMany: jest.fn().mockResolvedValue(profiles) },
      followSuggestionDismissal: { findMany: jest.fn().mockResolvedValue(dismissed.map((targetId) => ({ targetId }))) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          freelancerProfile: null,
          jobSeekerProfile: { city: 'toronto', country: 'Canada' },
        }),
      },
      userFollow: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockImplementation(() =>
        Promise.resolve(profiles.map((p) => ({ id: (p as { userId: string }).userId, followedBy: 0, followsYou: false, followers: 3 })))),
    };
    return { svc: new FollowSuggestionsService(prisma as never, {} as never), prisma };
  };

  it('offers only public, complete provider pages you do not follow, never your own', async () => {
    const { svc, prisma } = service([ready(ADA)]);
    await svc.professionals(ME);
    const { where } = prisma.freelancerProfile.findMany.mock.calls[0][0];
    expect(where).toEqual(expect.objectContaining({
      providerEnabled: true,
      publicPreviewEnabled: true,
      userId: { not: ME },
      user: { is: expect.objectContaining({ status: 'ACTIVE', followers: { none: { followerId: ME } } }) },
    }));
  });

  it('leaves out an incomplete page, and one you closed', async () => {
    const { svc } = service([ready(ADA, { portfolioUrl: null }), ready(BEN)], [BEN]);
    await expect(svc.professionals(ME)).resolves.toEqual([]);
  });

  it('says where, with the category by its label', async () => {
    const { svc } = service([ready(ADA)]);
    const [row] = await svc.professionals(ME);
    expect(row).toEqual(expect.objectContaining({
      id: ADA,
      name: 'Ada Lovelace',
      headline: 'Brand designer',
      category: 'Design',
      location: 'Toronto, Canada',
      followerCount: 3,
      reason: { kind: 'near_you', place: 'Toronto' },
    }));
  });
});
