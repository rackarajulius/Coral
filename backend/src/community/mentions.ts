import { BadRequestException, Logger } from '@nestjs/common';
import { CompanyMemberStatus, CompanyRole, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { personName } from '../common/person-name';
import { HIDDEN_STATUSES } from './people-follow.service';

/** A picture fit to send in a list: a web address, never an inline data URI. */
function webImage(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * @mentions of people and companies in posts and comments.
 *
 * A mention is stored in the text itself as `@[Name](person:<user id>)` or
 * `@[Name](company:<company page id>)`, so it survives editing, searching and
 * resharing with nothing to keep in step beside it. The id decides who is
 * meant; the name in the brackets is only what readers see.
 *
 * Who can be mentioned is who the community already shows:
 *
 * - **a person with a community page** — someone who has posted or replied,
 *   the rule `PeopleFollowService.card` uses. Anyone else has no page to link
 *   to, and finding them by name here would put a name to an account the
 *   community has never shown.
 * - **a company page that is not private.** Any such page can be mentioned;
 *   only public ones are found by typing a name, because an unlisted page is
 *   kept out of directories, and the suggestions are one. A page the writer
 *   follows or works for is found either way.
 *
 * The server never takes the name it is sent: every mention is rewritten to
 * the person's or company's own name before it is saved, so `@[The CEO]` with
 * a stranger's id cannot be published. One it cannot vouch for — gone,
 * suspended, private, or never there — is saved as plain `@Name` text.
 */

/** Most people and companies one post or comment may mention. */
export const MAX_MENTIONS = 20;

/** The notification type the bell and the notifications page label "Mention". */
export const MENTION_NOTIFICATION = 'mention';

export type MentionKind = 'person' | 'company';

export interface MentionRef {
  kind: MentionKind;
  id: string;
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
/** Global, so always used through `replace`/`matchAll`, which start from the beginning. */
const TOKEN = new RegExp(`@\\[([^\\[\\]\\n]{1,120})\\]\\((person|company):(${UUID})\\)`, 'g');

const keyOf = (ref: MentionRef) => `${ref.kind}:${ref.id}`;

/** Each person or company mentioned, once, in the order they first appear. */
export function parseMentions(text: string | null | undefined): MentionRef[] {
  const seen = new Map<string, MentionRef>();
  for (const match of (text ?? '').matchAll(TOKEN)) {
    const ref = { kind: match[2] as MentionKind, id: match[3].toLowerCase() };
    if (!seen.has(keyOf(ref))) seen.set(keyOf(ref), ref);
  }
  return [...seen.values()];
}

/** The words as a reader sees them, each mention as "@Name": for notification lines and other plain text. */
export function plainText(text: string | null | undefined): string {
  return (text ?? '').replace(TOKEN, (_whole, label: string) => `@${label}`);
}

/** The words with the mentions taken out: a name is never a hashtag or a link. */
export function withoutMentions(text: string | null | undefined): string {
  return (text ?? '').replace(TOKEN, ' ');
}

/** A name as it may stand between the brackets. */
function bracketSafe(name: string): string {
  return name.replace(/[[\]\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Someone';
}

function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + String.fromCharCode(8230) : flat;
}

/** People the community shows a page for: not closed or barred, and has posted or replied as themselves. */
const HAS_COMMUNITY_PAGE: Prisma.UserWhereInput = {
  status: { notIn: HIDDEN_STATUSES },
  OR: [
    { posts: { some: { removedAt: null, companyId: null } } },
    { postComments: { some: { removedAt: null } } },
  ],
};

type MentionReader = Pick<PrismaService, 'user' | 'employerProfile' | 'companyMember' | 'company' | 'userFollow'>;

interface Mentioned {
  kind: MentionKind;
  id: string;
  name: string;
  /** For a company page: the company whose team hears about it. */
  companyId?: string | null;
  /** For a page that belongs to no company yet: the one person who runs it. */
  ownerId?: string;
}

/** The mentions that may stand, with their own names. */
async function lookup(db: MentionReader, refs: MentionRef[]): Promise<Map<string, Mentioned>> {
  const personIds = refs.filter((r) => r.kind === 'person').map((r) => r.id);
  const pageIds = refs.filter((r) => r.kind === 'company').map((r) => r.id);
  const [people, pages] = await Promise.all([
    personIds.length
      ? db.user.findMany({
          where: { id: { in: personIds }, ...HAS_COMMUNITY_PAGE },
          select: { id: true, displayName: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    pageIds.length
      ? db.employerProfile.findMany({
          where: { id: { in: pageIds }, visibility: { not: 'private' } },
          select: { id: true, userId: true, companyId: true, companyName: true, company: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const found = new Map<string, Mentioned>();
  for (const p of people) {
    found.set(`person:${p.id}`, { kind: 'person', id: p.id, name: personName(p, 'Someone') });
  }
  for (const page of pages) {
    found.set(`company:${page.id}`, {
      kind: 'company',
      id: page.id,
      name: page.company?.name?.trim() || page.companyName,
      companyId: page.companyId,
      ownerId: page.userId,
    });
  }
  return found;
}

/**
 * The text as it will be saved: every mention checked and given its own name,
 * and any that cannot stand turned back into plain words.
 *
 * Refuses more than `MAX_MENTIONS` rather than dropping the rest: someone who
 * named twenty-five people should not find out later that five were not told.
 */
export async function resolveMentions(db: MentionReader, text: string): Promise<string>;
export async function resolveMentions(db: MentionReader, text: string | undefined): Promise<string | undefined>;
export async function resolveMentions(db: MentionReader, text: string | undefined): Promise<string | undefined> {
  if (!text) return text;
  const refs = parseMentions(text);
  if (refs.length === 0) return text;
  if (refs.length > MAX_MENTIONS) {
    throw new BadRequestException(`You can mention up to ${MAX_MENTIONS} people and companies at once.`);
  }
  const known = await lookup(db, refs);
  return text.replace(TOKEN, (_whole, label: string, kind: string, id: string) => {
    const found = known.get(`${kind}:${id.toLowerCase()}`);
    return found ? `@[${bracketSafe(found.name)}](${found.kind}:${found.id})` : `@${label}`;
  });
}

export interface MentionAnnouncement {
  /** Who wrote it. Never told about their own mentions. */
  actorId: string;
  /**
   * The company a post speaks for, when it does: the line names the company
   * rather than whoever pressed Post, and a company is not told it mentioned
   * itself.
   */
  voiceCompanyId?: string | null;
  where: 'post' | 'comment';
  postId: string;
  /** The words as saved, after `resolveMentions`. */
  content: string;
  /** The words before an edit: only someone newly mentioned is news. */
  previous?: string | null;
  /** People this same post or comment already notified, who are not told twice. */
  alreadyTold?: Iterable<string>;
}

const logger = new Logger('CommunityMentions');

/**
 * Tells everyone newly mentioned.
 *
 * A person hears it themselves. A company hears it through the people who run
 * its page — its active owners and admins, the same people who may post in
 * its name — or, for a page not yet part of a company, through its owner.
 * Nobody hears it twice from one write, the writer never hears it at all, and
 * a person named and also running a named company gets the personal line,
 * the more specific of the two.
 *
 * Never fails the post or comment it is about: it runs after the write, and
 * anything that goes wrong is logged, not thrown.
 */
export async function announceMentions(
  db: MentionReader,
  notifications: Pick<NotificationsService, 'create'>,
  input: MentionAnnouncement,
): Promise<void> {
  try {
    const before = new Set(parseMentions(input.previous).map(keyOf));
    const fresh = parseMentions(input.content).filter((ref) => !before.has(keyOf(ref)));
    if (fresh.length === 0) return;
    const known = await lookup(db, fresh);
    if (known.size === 0) return;

    const mentioned = [...known.values()];
    const companyIds = [
      ...new Set(
        mentioned.flatMap((m) => (m.kind === 'company' && m.companyId && m.companyId !== input.voiceCompanyId ? [m.companyId] : [])),
      ),
    ];
    const [who, admins] = await Promise.all([
      writerName(db, input.actorId, input.voiceCompanyId),
      companyIds.length
        ? db.companyMember.findMany({
            where: {
              companyId: { in: companyIds },
              status: CompanyMemberStatus.ACTIVE,
              role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] },
              user: { status: UserStatus.ACTIVE },
            },
            select: { companyId: true, userId: true },
          })
        : Promise.resolve([] as Array<{ companyId: string; userId: string }>),
    ]);

    const told = new Set<string>([input.actorId, ...(input.alreadyTold ?? [])]);
    const place = input.where === 'post' ? 'a post' : 'a comment';
    const message = excerpt(plainText(input.content));
    const link = `/community/posts/${input.postId}`;
    const tell = async (userId: string, title: string) => {
      if (told.has(userId)) return;
      told.add(userId);
      await notifications.create({ userId, type: MENTION_NOTIFICATION, title, message, link });
    };

    for (const m of mentioned) {
      if (m.kind === 'person') await tell(m.id, `${who} mentioned you in ${place}`);
    }
    for (const m of mentioned) {
      if (m.kind !== 'company') continue;
      if (m.companyId && m.companyId === input.voiceCompanyId) continue;
      const runners = m.companyId
        ? admins.filter((a) => a.companyId === m.companyId).map((a) => a.userId)
        : m.ownerId ? [m.ownerId] : [];
      for (const userId of runners) await tell(userId, `${who} mentioned ${m.name} in ${place}`);
    }
  } catch (err) {
    logger.warn(`Mention notifications for post ${input.postId} failed: ${(err as Error).message}`);
  }
}

async function writerName(db: MentionReader, actorId: string, voiceCompanyId?: string | null): Promise<string> {
  if (voiceCompanyId) {
    const company = await db.company.findUnique({ where: { id: voiceCompanyId }, select: { name: true } });
    if (company?.name?.trim()) return company.name.trim();
  }
  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  return personName(user, 'Someone');
}

export interface MentionSuggestions {
  people: Array<{ id: string; name: string; avatarUrl: string | null }>;
  companies: Array<{ id: string; name: string; logoUrl: string | null }>;
}

/** How many of each kind the "@" menu offers. */
const SUGGESTIONS = 6;

/**
 * People and companies whose name matches what was typed after "@".
 *
 * Every word has to match some part of the name, so "ada lo" finds Ada
 * Lovelace. People the writer follows come first, then names that start with
 * what was typed. The writer is left out: there is no one to tell.
 */
export async function suggestMentions(db: MentionReader, viewerId: string, query: string): Promise<MentionSuggestions> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 4).map((w) => w.slice(0, 50));
  if (words.length === 0) return { people: [], companies: [] };
  const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

  const [people, pages] = await Promise.all([
    db.user.findMany({
      where: {
        AND: [
          HAS_COMMUNITY_PAGE,
          { id: { not: viewerId } },
          ...words.map((w) => ({ OR: [{ firstName: contains(w) }, { lastName: contains(w) }, { displayName: contains(w) }] })),
        ],
      },
      select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
      take: 25,
    }),
    db.employerProfile.findMany({
      where: {
        AND: [
          { visibility: { not: 'private' } },
          {
            OR: [
              { visibility: 'public' },
              { followers: { some: { userId: viewerId } } },
              { company: { members: { some: { userId: viewerId, status: CompanyMemberStatus.ACTIVE } } } },
            ],
          },
          ...words.map((w) => ({ OR: [{ companyName: contains(w) }, { company: { name: contains(w) } }] })),
        ],
      },
      select: { id: true, companyId: true, companyName: true, companyLogo: true, company: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 25,
    }),
  ]);

  const followed = people.length
    ? new Set(
        (await db.userFollow.findMany({
          where: { followerId: viewerId, followingId: { in: people.map((p) => p.id) } },
          select: { followingId: true },
        })).map((f) => f.followingId),
      )
    : new Set<string>();
  const first = words[0].toLowerCase();
  const rank = (name: string, isFollowed = false) =>
    (isFollowed ? 0 : 2) + (name.toLowerCase().startsWith(first) ? 0 : 1);

  const named = people
    .map((p) => ({ id: p.id, name: personName(p, 'Someone'), avatarUrl: webImage(p.avatarUrl), followed: followed.has(p.id) }))
    .sort((a, b) => rank(a.name, a.followed) - rank(b.name, b.followed) || a.name.localeCompare(b.name))
    .slice(0, SUGGESTIONS)
    .map(({ followed: _followed, ...person }) => person);

  // One entry per company, even when several of its pages match.
  const byCompany = new Map<string, MentionSuggestions['companies'][number]>();
  for (const page of pages) {
    const key = page.companyId ?? page.id;
    if (byCompany.has(key)) continue;
    byCompany.set(key, { id: page.id, name: page.company?.name?.trim() || page.companyName, logoUrl: webImage(page.companyLogo) });
  }
  const companies = [...byCompany.values()]
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .slice(0, SUGGESTIONS);

  return { people: named, companies };
}
