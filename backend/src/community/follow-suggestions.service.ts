import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { personName } from '../common/person-name';
import { WORK_CATEGORIES } from '../common/work-categories';
import { isPublicProviderReady, PROVIDER_CATEGORIES } from '../freelancers/provider-profile-policy';
import { CommunityIdentityService } from './identity.service';
import { HIDDEN_STATUSES } from './people-follow.service';
import {
  CompanySignals,
  PersonSignals,
  Place,
  ProfessionalSignals,
  RECENT_DAYS,
  Ranked,
  SPACE_ACTIVITY_DAYS,
  rankProfessionals,
  rankWhoToFollow,
  samePlace,
} from './follow-suggestions';

export type SuggestionKind = 'person' | 'company';

export type SuggestionReason =
  | { kind: 'followed_by'; total: number; names: string[] }
  | { kind: 'follows_you' }
  | { kind: 'space'; name: string; slug: string }
  | { kind: 'near_you'; place: string }
  | { kind: 'popular' }
  | { kind: 'posting' };

export interface FollowSuggestion {
  kind: SuggestionKind;
  id: string;
  name: string;
  imageUrl: string | null;
  /** The line under the name: their byline label, or the company's industry. */
  headline: string | null;
  /** For the Follow button's first paint, so it does not ask for each row. */
  followerCount: number;
  reason: SuggestionReason | null;
  /** Professionals only. */
  category?: string | null;
  location?: string | null;
}

/** Accounts that are not followable, as text for raw SQL. */
const HIDDEN = HIDDEN_STATUSES.map(String);

/** How many of the most-followed and most-active are considered beside the viewer's own signals. */
const POPULAR_POOL = 200;
/** The most candidates read before ranking, whatever the signals. */
const CANDIDATES = 500;
/** "Followed by Ada and Ben": at most two names on a card. */
const NAMES_SHOWN = 2;

const CATEGORY_LABEL = new Map<string, string>(WORK_CATEGORIES.map((c) => [c.value, c.label]));

/** A picture fit to send in a list: a web address, never an inline data URI. */
function webImage(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * "Who to follow" and "Professionals for you", on the community's Following
 * page — X's x.com/i/connect_people, with Coral's facts.
 *
 * Never suggests the viewer, anyone they already follow, a closed or
 * suspended account, or anything they closed with ✕. People are suggested
 * only once they have a community page (a post or a reply still up), so the
 * name always leads somewhere; company pages only when public and live.
 *
 * The ranking and the reasons are in `follow-suggestions.ts`; this gathers
 * the facts and puts names to them.
 */
@Injectable()
export class FollowSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: CommunityIdentityService,
  ) {}

  async whoToFollow(viewerId: string): Promise<FollowSuggestion[]> {
    const [people, companies] = await Promise.all([this.personSignals(viewerId), this.companySignals(viewerId)]);
    const ranked = rankWhoToFollow(people, companies);
    const personIds = ranked.filter((r) => r.kind === 'person').map((r) => r.id);
    const companyIds = ranked.filter((r) => r.kind === 'company').map((r) => r.id);
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const companiesById = new Map(companies.map((c) => [c.id, c]));

    const spaceIds = [...new Set(personIds.map((id) => peopleById.get(id)?.spaceId).filter((v): v is string => !!v))];
    const fofPeople = personIds.filter((id) => (peopleById.get(id)?.followedBy ?? 0) > 0);
    const fofCompanies = companyIds.filter((id) => (companiesById.get(id)?.followedBy ?? 0) > 0);

    const [users, identities, pages, spaces, personNames, companyNames] = await Promise.all([
      personIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: personIds } },
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
          })
        : Promise.resolve([]),
      this.identity.resolve(personIds),
      companyIds.length
        ? this.prisma.employerProfile.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, companyName: true, companyLogo: true, industry: true, pageOf: { select: { name: true } } },
          })
        : Promise.resolve([]),
      spaceIds.length
        ? this.prisma.space.findMany({ where: { id: { in: spaceIds }, archivedAt: null }, select: { id: true, name: true, slug: true } })
        : Promise.resolve([]),
      this.namesOfFollowsFollowingPeople(viewerId, fofPeople),
      this.namesOfFollowsFollowingCompanies(viewerId, fofCompanies),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const pageById = new Map(pages.map((p) => [p.id, p]));
    const spaceById = new Map(spaces.map((s) => [s.id, s]));

    return ranked.flatMap((r): FollowSuggestion[] => {
      if (r.kind === 'person') {
        const user = userById.get(r.id);
        const signals = peopleById.get(r.id);
        if (!user || !signals) return [];
        const space = signals.spaceId ? spaceById.get(signals.spaceId) : undefined;
        return [{
          kind: 'person',
          id: r.id,
          name: personName(user, 'Someone'),
          imageUrl: webImage(user.avatarUrl),
          headline: identities.get(r.id)?.label ?? null,
          followerCount: signals.followers,
          reason: this.reason(r, signals.followedBy, personNames.get(r.id), space),
        }];
      }
      const page = pageById.get(r.id);
      const signals = companiesById.get(r.id);
      if (!page || !signals) return [];
      return [{
        kind: 'company',
        id: r.id,
        name: page.pageOf?.name?.trim() || page.companyName,
        imageUrl: webImage(page.companyLogo),
        headline: page.industry?.trim() || null,
        followerCount: signals.followers,
        reason: this.reason(r, signals.followedBy, companyNames.get(r.id)),
      }];
    });
  }

  /**
   * People offering their work on Coral — a public provider page — that the
   * viewer does not follow yet: X's "Creators for you", with View services in
   * place of Subscribe.
   */
  async professionals(viewerId: string): Promise<FollowSuggestion[]> {
    const [profiles, dismissed, viewer] = await Promise.all([
      this.prisma.freelancerProfile.findMany({
        where: {
          providerEnabled: true,
          publicPreviewEnabled: true,
          category: { in: [...PROVIDER_CATEGORIES] },
          userId: { not: viewerId },
          user: {
            is: {
              status: UserStatus.ACTIVE,
              role: { in: [UserRole.JOB_SEEKER, UserRole.FREELANCER] },
              followers: { none: { followerId: viewerId } },
            },
          },
        },
        select: {
          userId: true, providerEnabled: true, publicPreviewEnabled: true,
          category: true, headline: true, summary: true, skills: true, portfolioUrl: true, githubUrl: true,
          city: true, country: true, placeCity: true, placeCountryCode: true,
          user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, role: true, status: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: CANDIDATES,
      }),
      this.prisma.followSuggestionDismissal.findMany({
        where: { userId: viewerId, kind: 'person' },
        select: { targetId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: viewerId },
        select: {
          freelancerProfile: { select: { city: true, country: true, placeCity: true, placeCountryCode: true } },
          jobSeekerProfile: { select: { city: true, country: true } },
        },
      }),
    ]);

    const hidden = new Set(dismissed.map((d) => d.targetId));
    // The same rule as the provider page and the directory card.
    const ready = profiles.filter((p) => !hidden.has(p.userId) && isPublicProviderReady(p, p.user));
    if (ready.length === 0) return [];

    const own = viewer?.freelancerProfile;
    const here: Place | null = own?.placeCity || own?.city
      ? { city: own.placeCity ?? own.city, country: own.country, countryCode: own.placeCountryCode }
      : viewer?.jobSeekerProfile?.city
        ? { city: viewer.jobSeekerProfile.city, country: viewer.jobSeekerProfile.country }
        : null;
    const placeOf = (p: (typeof ready)[number]): Place => ({ city: p.placeCity ?? p.city, country: p.country, countryCode: p.placeCountryCode });

    const ids = ready.map((p) => p.userId);
    const social = await this.socialSignals(viewerId, ids);
    const signals: ProfessionalSignals[] = ready.map((p) => ({
      id: p.userId,
      followedBy: social.get(p.userId)?.followedBy ?? 0,
      followsYou: social.get(p.userId)?.followsYou ?? false,
      nearYou: samePlace(here, placeOf(p)),
      followers: social.get(p.userId)?.followers ?? 0,
    }));
    const ranked = rankProfessionals(signals);
    const byId = new Map(ready.map((p) => [p.userId, p]));
    const signalsById = new Map(signals.map((s) => [s.id, s]));
    const names = await this.namesOfFollowsFollowingPeople(
      viewerId,
      ranked.filter((r) => r.reason === 'followed_by').map((r) => r.id),
    );

    return ranked.map((r) => {
      const p = byId.get(r.id)!;
      const s = signalsById.get(r.id)!;
      const location = [p.city?.trim(), p.country?.trim()].filter(Boolean).join(', ') || null;
      return {
        kind: 'person' as const,
        id: r.id,
        name: personName(p.user, 'Someone'),
        imageUrl: webImage(p.user.avatarUrl),
        headline: p.headline?.trim() || null,
        followerCount: s.followers,
        reason: r.reason === 'near_you' ? { kind: 'near_you' as const, place: (p.placeCity ?? p.city)?.trim() || location || '' } : this.reason(r, s.followedBy, names.get(r.id)),
        category: p.category ? CATEGORY_LABEL.get(p.category) ?? null : null,
        location,
      };
    });
  }

  /**
   * ✕ on a suggestion: not offered again, on any device. Idempotent, like
   * the space suggestions' dismissal.
   */
  async dismiss(viewerId: string, kind: string, targetId: string) {
    const k = this.kind(kind);
    const exists = k === 'person'
      ? await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } })
      : await this.prisma.employerProfile.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!exists) throw new NotFoundException(k === 'person' ? 'Person not found' : 'Company page not found');
    await this.prisma.followSuggestionDismissal.createMany({
      data: [{ userId: viewerId, kind: k, targetId }],
      skipDuplicates: true,
    });
    return { kind: k, id: targetId, dismissed: true };
  }

  /** Undo, from the toast that follows a dismissal. */
  async undismiss(viewerId: string, kind: string, targetId: string) {
    const k = this.kind(kind);
    await this.prisma.followSuggestionDismissal.deleteMany({ where: { userId: viewerId, kind: k, targetId } });
    return { kind: k, id: targetId, dismissed: false };
  }

  private kind(kind: string): SuggestionKind {
    if (kind !== 'person' && kind !== 'company') throw new BadRequestException('Unknown suggestion kind');
    return kind;
  }

  private reason(
    r: Ranked,
    followedBy: number,
    names: string[] | undefined,
    space?: { name: string; slug: string },
  ): SuggestionReason | null {
    switch (r.reason) {
      case 'followed_by':
        return { kind: 'followed_by', total: followedBy, names: names ?? [] };
      case 'follows_you':
        return { kind: 'follows_you' };
      case 'space':
        // The space went away between the two reads: say nothing rather than guess.
        return space ? { kind: 'space', name: space.name, slug: space.slug } : null;
      case 'popular':
        return { kind: 'popular' };
      case 'posting':
        return { kind: 'posting' };
      default:
        return null;
    }
  }

  /* -------------------------------- signals -------------------------------- */

  /**
   * Everyone worth considering, with what is known about each.
   *
   * The pool: people the viewer's follows follow, people who follow the
   * viewer, people active lately in the viewer's spaces, and the most
   * followed and most active in the community. Then the rules every
   * suggestion keeps (see the class comment). Counts are cast to int: a raw
   * COUNT is a BigInt, which JSON cannot carry.
   */
  private personSignals(me: string): Promise<PersonSignals[]> {
    return this.prisma.$queryRaw<PersonSignals[]>`
      WITH mine AS (
        SELECT following_id AS id FROM user_follows WHERE follower_id = ${me}
      ),
      my_spaces AS (
        SELECT m.space_id
          FROM space_members m JOIN spaces s ON s.id = m.space_id
         WHERE m.user_id = ${me} AND s.archived_at IS NULL
      ),
      fof AS (
        SELECT f.following_id AS id, COUNT(*)::int AS n
          FROM user_follows f
          JOIN mine ON mine.id = f.follower_id
          JOIN users fu ON fu.id = f.follower_id
         WHERE fu.status::text <> ALL(${HIDDEN}::text[])
         GROUP BY f.following_id
      ),
      fans AS (
        SELECT follower_id AS id FROM user_follows WHERE following_id = ${me}
      ),
      in_spaces AS (
        SELECT DISTINCT ON (x.id) x.id, x.space_id, x.n
          FROM (
            SELECT a.id, a.space_id, COUNT(*)::int AS n
              FROM (
                SELECT p.author_id AS id, p.space_id
                  FROM posts p JOIN my_spaces ms ON ms.space_id = p.space_id
                 WHERE p.removed_at IS NULL AND p.company_id IS NULL
                   AND p.created_at > now() - make_interval(days => ${SPACE_ACTIVITY_DAYS}::int)
                UNION ALL
                SELECT c.author_id, p.space_id
                  FROM post_comments c
                  JOIN posts p ON p.id = c.post_id
                  JOIN my_spaces ms ON ms.space_id = p.space_id
                 WHERE c.removed_at IS NULL AND p.removed_at IS NULL
                   AND c.created_at > now() - make_interval(days => ${SPACE_ACTIVITY_DAYS}::int)
              ) a
             GROUP BY a.id, a.space_id
          ) x
         ORDER BY x.id, x.n DESC, x.space_id
      ),
      reach AS (
        SELECT f.following_id AS id, COUNT(*)::int AS n
          FROM user_follows f JOIN users fu ON fu.id = f.follower_id
         WHERE fu.status::text <> ALL(${HIDDEN}::text[])
         GROUP BY f.following_id
      ),
      recent AS (
        SELECT p.author_id AS id, COUNT(*)::int AS n
          FROM posts p
         WHERE p.removed_at IS NULL AND p.company_id IS NULL
           AND p.created_at > now() - make_interval(days => ${RECENT_DAYS}::int)
         GROUP BY p.author_id
      ),
      pool AS (
        SELECT id FROM fof
        UNION SELECT id FROM fans
        UNION SELECT id FROM in_spaces
        UNION (SELECT id FROM reach ORDER BY n DESC, id LIMIT ${POPULAR_POOL}::int)
        UNION (SELECT id FROM recent ORDER BY n DESC, id LIMIT ${POPULAR_POOL}::int)
      )
      SELECT u.id,
             COALESCE(fof.n, 0)::int AS "followedBy",
             (fans.id IS NOT NULL) AS "followsYou",
             s.space_id AS "spaceId",
             COALESCE(s.n, 0)::int AS "spaceActivity",
             COALESCE(reach.n, 0)::int AS followers,
             COALESCE(recent.n, 0)::int AS "recentPosts"
        FROM pool
        JOIN users u ON u.id = pool.id
        LEFT JOIN fof ON fof.id = u.id
        LEFT JOIN fans ON fans.id = u.id
        LEFT JOIN in_spaces s ON s.id = u.id
        LEFT JOIN reach ON reach.id = u.id
        LEFT JOIN recent ON recent.id = u.id
       WHERE u.id <> ${me}
         AND u.status::text <> ALL(${HIDDEN}::text[])
         AND NOT EXISTS (SELECT 1 FROM mine WHERE mine.id = u.id)
         AND NOT EXISTS (
               SELECT 1 FROM follow_suggestion_dismissals d
                WHERE d.user_id = ${me} AND d.kind = 'person' AND d.target_id = u.id)
         -- A community page to go to: a post in their own voice, or a reply, still up.
         AND (EXISTS (SELECT 1 FROM posts p WHERE p.author_id = u.id AND p.company_id IS NULL AND p.removed_at IS NULL)
              OR EXISTS (SELECT 1 FROM post_comments c WHERE c.author_id = u.id AND c.removed_at IS NULL))
       ORDER BY "followedBy" DESC, "followsYou" DESC, followers DESC, u.id
       LIMIT ${CANDIDATES}::int`;
  }

  /**
   * Company pages: public, live, not the viewer's own company, not followed
   * yet — and with something to go on: followers, or posts lately.
   */
  private companySignals(me: string): Promise<CompanySignals[]> {
    return this.prisma.$queryRaw<CompanySignals[]>`
      WITH mine AS (
        SELECT following_id AS id FROM user_follows WHERE follower_id = ${me}
      ),
      my_companies AS (
        SELECT company_id FROM company_members WHERE user_id = ${me} AND status::text = 'ACTIVE'
      ),
      fof AS (
        SELECT cf.company_id AS id, COUNT(*)::int AS n
          FROM company_follows cf
          JOIN mine ON mine.id = cf.user_id
          JOIN users fu ON fu.id = cf.user_id
         WHERE fu.status::text <> ALL(${HIDDEN}::text[])
         GROUP BY cf.company_id
      ),
      reach AS (
        SELECT cf.company_id AS id, COUNT(*)::int AS n
          FROM company_follows cf JOIN users fu ON fu.id = cf.user_id
         WHERE fu.status::text <> ALL(${HIDDEN}::text[])
         GROUP BY cf.company_id
      ),
      recent AS (
        SELECT c.page_id AS id, COUNT(*)::int AS n
          FROM posts p JOIN companies c ON c.id = p.company_id
         WHERE p.removed_at IS NULL AND c.page_id IS NOT NULL
           AND p.created_at > now() - make_interval(days => ${RECENT_DAYS}::int)
         GROUP BY c.page_id
      )
      SELECT e.id,
             COALESCE(fof.n, 0)::int AS "followedBy",
             COALESCE(reach.n, 0)::int AS followers,
             COALESCE(recent.n, 0)::int AS "recentPosts"
        FROM employer_profiles e
        LEFT JOIN companies pc ON pc.page_id = e.id
        LEFT JOIN fof ON fof.id = e.id
        LEFT JOIN reach ON reach.id = e.id
        LEFT JOIN recent ON recent.id = e.id
       WHERE e.visibility = 'public'
         -- A page (IS_LIVE_PAGE): a company's page, or a sole operator's own
         -- profile; never a member's copy, never a deactivated page.
         AND (pc.id IS NOT NULL OR e.company_id IS NULL)
         AND pc.deactivated_at IS NULL
         AND e.user_id <> ${me}
         AND (pc.id IS NULL OR pc.id NOT IN (SELECT company_id FROM my_companies))
         AND (fof.n IS NOT NULL OR reach.n IS NOT NULL OR recent.n IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM company_follows f WHERE f.user_id = ${me} AND f.company_id = e.id)
         AND NOT EXISTS (
               SELECT 1 FROM follow_suggestion_dismissals d
                WHERE d.user_id = ${me} AND d.kind = 'company' AND d.target_id = e.id)
       ORDER BY "followedBy" DESC, followers DESC, e.id
       LIMIT ${CANDIDATES}::int`;
  }

  /** For people already chosen: how many of the viewer's follows follow them, whether they follow the viewer, and their reach. */
  private async socialSignals(me: string, ids: string[]) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; followedBy: number; followsYou: boolean; followers: number }>>`
      SELECT u.id,
             (SELECT COUNT(*)::int
                FROM user_follows f
                JOIN user_follows m ON m.following_id = f.follower_id AND m.follower_id = ${me}
                JOIN users fu ON fu.id = f.follower_id
               WHERE f.following_id = u.id AND fu.status::text <> ALL(${HIDDEN}::text[])) AS "followedBy",
             EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = u.id AND f.following_id = ${me}) AS "followsYou",
             (SELECT COUNT(*)::int
                FROM user_follows f JOIN users fu ON fu.id = f.follower_id
               WHERE f.following_id = u.id AND fu.status::text <> ALL(${HIDDEN}::text[])) AS followers
        FROM users u
       WHERE u.id = ANY(${ids}::text[])`;
    return new Map(rows.map((r) => [r.id, r]));
  }

  /**
   * "Followed by Ada and Ben": for each person, the most recent of the
   * viewer's follows to follow them. Only ever people the viewer chose to
   * follow, so it tells them nothing about strangers.
   */
  private async namesOfFollowsFollowingPeople(me: string, ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.userFollow.findMany({
      where: {
        followingId: { in: ids },
        followerId: { not: me },
        follower: { status: { notIn: HIDDEN_STATUSES }, followers: { some: { followerId: me } } },
      },
      orderBy: { createdAt: 'desc' },
      take: ids.length * 10,
      select: { followingId: true, follower: { select: { displayName: true, firstName: true, lastName: true } } },
    });
    return this.firstNames(rows.map((r) => [r.followingId, personName(r.follower, 'Someone')]));
  }

  private async namesOfFollowsFollowingCompanies(me: string, ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.companyFollow.findMany({
      where: {
        companyId: { in: ids },
        userId: { not: me },
        user: { status: { notIn: HIDDEN_STATUSES }, followers: { some: { followerId: me } } },
      },
      orderBy: { createdAt: 'desc' },
      take: ids.length * 10,
      select: { companyId: true, user: { select: { displayName: true, firstName: true, lastName: true } } },
    });
    return this.firstNames(rows.map((r) => [r.companyId, personName(r.user, 'Someone')]));
  }

  private firstNames(pairs: Array<[string, string]>): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [id, name] of pairs) {
      const list = out.get(id) ?? [];
      if (list.length < NAMES_SHOWN) out.set(id, [...list, name]);
    }
    return out;
  }
}
