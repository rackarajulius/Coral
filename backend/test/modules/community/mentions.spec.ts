import { BadRequestException } from '@nestjs/common';
import {
  announceMentions,
  MAX_MENTIONS,
  MENTION_NOTIFICATION,
  parseMentions,
  plainText,
  resolveMentions,
  suggestMentions,
  withoutMentions,
} from '../../../src/community/mentions';
import { CommentsService } from '../../../src/community/comments/comments.service';

/**
 * @mentions: who can be named, what is saved, and who hears about it.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const ADA = '11111111-1111-4111-8111-111111111111';
const GRACE = '22222222-2222-4222-8222-222222222222';
const BANNED = '33333333-3333-4333-8333-333333333333';
const WRITER = '44444444-4444-4444-8444-444444444444';
const ACME_PAGE = '55555555-5555-4555-8555-555555555555';
const SECRET_PAGE = '66666666-6666-4666-8666-666666666666';
const SOLO_PAGE = '77777777-7777-4777-8777-777777777777';
const ACME = 'company-acme';
const ACME_OWNER = '88888888-8888-4888-8888-888888888888';
const ACME_ADMIN = '99999999-9999-4999-8999-999999999999';

const person = (id: string, label = 'x') => `@[${label}](person:${id})`;
const company = (id: string, label = 'x') => `@[${label}](company:${id})`;

/** People who have a community page, and company pages that are not private. */
function db() {
  const people = [
    { id: ADA, displayName: null, firstName: 'Ada', lastName: 'Lovelace', avatarUrl: null },
    { id: GRACE, displayName: 'Grace H', firstName: null, lastName: null, avatarUrl: 'https://cdn.example/g.png' },
    { id: WRITER, displayName: null, firstName: 'Wendy', lastName: 'Writer', avatarUrl: null },
  ];
  const pages = [
    { id: ACME_PAGE, userId: ACME_OWNER, companyId: ACME, companyName: 'acme old name', companyLogo: null, company: { name: 'Acme' } },
    { id: SOLO_PAGE, userId: 'solo-owner', companyId: null, companyName: 'Solo Studio', companyLogo: 'data:image/png;base64,AAA', company: null },
  ];
  return {
    user: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.id?.in ? people.filter((p) => where.id.in.includes(p.id)) : people.filter((p) => p.id !== WRITER)),
      findUnique: jest.fn().mockImplementation(async ({ where }) => people.find((p) => p.id === where.id) ?? null),
    },
    employerProfile: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.id?.in ? pages.filter((p) => where.id.in.includes(p.id)) : pages),
    },
    companyMember: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.companyId.in.includes(ACME)
          ? [{ companyId: ACME, userId: ACME_OWNER }, { companyId: ACME, userId: ACME_ADMIN }]
          : []),
    },
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme' }) },
    userFollow: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where.followerId === WRITER && where.followingId.in.includes(GRACE) ? [{ followingId: GRACE }] : []),
    },
  };
}

function bell() {
  return { create: jest.fn().mockResolvedValue(undefined) };
}

describe('Reading mentions out of text', () => {
  it('finds each person or company once, and shows them as plain @Names', () => {
    const text = `Thanks ${person(ADA, 'Ada')} and ${company(ACME_PAGE, 'Acme')}, again ${person(ADA, 'Ada')}!`;
    expect(parseMentions(text)).toEqual([
      { kind: 'person', id: ADA },
      { kind: 'company', id: ACME_PAGE },
    ]);
    expect(plainText(text)).toBe('Thanks @Ada and @Acme, again @Ada!');
  });

  it('never reads a name as a hashtag', () => {
    expect(withoutMentions(`hi ${company(ACME_PAGE, 'C#Corner')} #hiring`)).not.toContain('#Corner');
    expect(withoutMentions(`hi ${company(ACME_PAGE, 'C#Corner')} #hiring`)).toContain('#hiring');
  });

  it('leaves text that only looks like a mention alone', () => {
    expect(parseMentions('@[Ada](person:not-an-id) and @ada')).toEqual([]);
  });
});

describe('What is saved', () => {
  it("rewrites each mention to the person's or company's own name", async () => {
    const saved = await resolveMentions(collaborator(db()), `${person(ADA, 'The CEO')} at ${company(ACME_PAGE, 'Big Corp')}`);
    expect(saved).toBe(`@[Ada Lovelace](person:${ADA}) at @[Acme](company:${ACME_PAGE})`);
  });

  it('turns a mention it cannot vouch for back into plain words', async () => {
    // Banned, or no community page: not returned by the lookup. A private page likewise.
    const saved = await resolveMentions(collaborator(db()), `${person(BANNED, 'Bob')} ${company(SECRET_PAGE, 'Hidden Inc')}`);
    expect(saved).toBe('@Bob @Hidden Inc');
  });

  it('asks the database only when there is something to check', async () => {
    const store = db();
    await expect(resolveMentions(collaborator(store), 'no mentions here')).resolves.toBe('no mentions here');
    expect(store.user.findMany).not.toHaveBeenCalled();
    expect(store.employerProfile.findMany).not.toHaveBeenCalled();
  });

  it(`refuses more than ${MAX_MENTIONS} rather than dropping some`, async () => {
    const many = Array.from({ length: MAX_MENTIONS + 1 }, (_, i) =>
      person(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)).join(' ');
    await expect(resolveMentions(collaborator(db()), many)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Who hears about it', () => {
  const announce = (input: Partial<Parameters<typeof announceMentions>[2]>, store = db(), notifications = bell()) =>
    announceMentions(collaborator(store), notifications, {
      actorId: WRITER,
      where: 'post',
      postId: 'post-1',
      content: '',
      ...input,
    }).then(() => notifications.create.mock.calls.map(([n]) => n));

  it('a person, by name, with a link to the post', async () => {
    const sent = await announce({ content: `Great work ${person(ADA, 'Ada Lovelace')}` });
    expect(sent).toEqual([{
      userId: ADA,
      type: MENTION_NOTIFICATION,
      title: 'Wendy Writer mentioned you in a post',
      message: 'Great work @Ada Lovelace',
      link: '/community/posts/post-1',
    }]);
  });

  it("a company, through its page's owners and admins", async () => {
    const sent = await announce({ where: 'comment', content: company(ACME_PAGE, 'Acme') });
    expect(sent.map((n) => n.userId)).toEqual([ACME_OWNER, ACME_ADMIN]);
    expect(sent[0].title).toBe('Wendy Writer mentioned Acme in a comment');
  });

  it('a page that is not yet part of a company, through its owner', async () => {
    const sent = await announce({ content: company(SOLO_PAGE, 'Solo Studio') });
    expect(sent.map((n) => n.userId)).toEqual(['solo-owner']);
  });

  it('never the writer, and never a company about its own post', async () => {
    await expect(announce({ content: person(WRITER) })).resolves.toEqual([]);
    await expect(announce({ actorId: ACME_ADMIN, voiceCompanyId: ACME, content: company(ACME_PAGE) })).resolves.toEqual([]);
  });

  it("names the company, not whoever pressed Post, when a post speaks for one", async () => {
    const sent = await announce({ actorId: ACME_ADMIN, voiceCompanyId: ACME, content: person(ADA) });
    expect(sent[0].title).toBe('Acme mentioned you in a post');
  });

  it('nobody twice: the personal line wins over the company one', async () => {
    const store = db();
    store.user.findMany.mockImplementation(async () => [{ id: ACME_OWNER, displayName: 'Owen', firstName: null, lastName: null }]);
    const sent = await announce({ content: `${company(ACME_PAGE)} ${person(ACME_OWNER)}` }, store);
    expect(sent.filter((n) => n.userId === ACME_OWNER)).toEqual([
      expect.objectContaining({ title: 'Wendy Writer mentioned you in a post' }),
    ]);
  });

  it('after an edit, only someone newly mentioned', async () => {
    const sent = await announce({ previous: person(ADA), content: `${person(ADA)} ${person(GRACE)}` });
    expect(sent.map((n) => n.userId)).toEqual([GRACE]);
  });

  it('skips people this write already told another way', async () => {
    const sent = await announce({ content: `${person(ADA)} ${person(GRACE)}`, alreadyTold: [ADA] });
    expect(sent.map((n) => n.userId)).toEqual([GRACE]);
  });

  it('never fails the post it is about', async () => {
    const store = db();
    store.user.findMany.mockRejectedValue(new Error('database away'));
    await expect(announce({ content: person(ADA) }, store)).resolves.toEqual([]);
  });
});

describe('The "@" menu', () => {
  it('asks only for people with a community page, not the writer, matching every word', async () => {
    const store = db();
    await suggestMentions(collaborator(store), WRITER, 'ada  lo');
    const { where } = store.user.findMany.mock.calls[0][0];
    expect(where.AND).toEqual(expect.arrayContaining([
      { id: { not: WRITER } },
      expect.objectContaining({ status: expect.anything(), OR: expect.any(Array) }),
    ]));
    // One name clause per word typed.
    const nameClauses = where.AND.filter((c: { OR?: Array<Record<string, unknown>> }) => c.OR?.some((o) => 'firstName' in o));
    expect(nameClauses).toHaveLength(2);
  });

  it('finds only public pages by name, unless the writer follows or works for one', async () => {
    const store = db();
    await suggestMentions(collaborator(store), WRITER, 'acme');
    const { where } = store.employerProfile.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ visibility: { not: 'private' } });
    // A company's page, or a sole operator's own profile — never a member's
    // copy of their company, which would offer one company twice — and never
    // a page its company has deactivated.
    expect(where.AND[1]).toEqual({
      AND: [
        { OR: [{ pageOf: { isNot: null } }, { companyId: null }] },
        { NOT: { pageOf: { is: { deactivatedAt: { not: null } } } } },
      ],
    });
    expect(where.AND[2].OR).toEqual([
      { visibility: 'public' },
      { followers: { some: { userId: WRITER } } },
      expect.objectContaining({ company: expect.anything() }),
    ]);
  });

  it('puts people the writer follows first, and never sends inline images', async () => {
    const { people, companies } = await suggestMentions(collaborator(db()), WRITER, 'a');
    expect(people[0]).toEqual({ id: GRACE, name: 'Grace H', avatarUrl: 'https://cdn.example/g.png' });
    expect(companies.find((c) => c.id === SOLO_PAGE)?.logoUrl).toBeNull();
    expect(companies.find((c) => c.id === ACME_PAGE)?.name).toBe('Acme');
  });

  it('asks nothing for an empty query', async () => {
    const store = db();
    await expect(suggestMentions(collaborator(store), WRITER, '   ')).resolves.toEqual({ people: [], companies: [] });
    expect(store.user.findMany).not.toHaveBeenCalled();
  });
});

describe('Mentions in a comment', () => {
  it("the post's author, named in a comment on their post, hears about it once", async () => {
    const notifications = bell();
    const service = new CommentsService(collaborator(db()), collaborator({}), collaborator(notifications));
    await (service as unknown as { announce(input: unknown): Promise<void> }).announce({
      postId: 'post-1',
      postAuthorId: ADA,
      parentAuthorId: null,
      commenterId: WRITER,
      comment: `${person(ADA, 'Ada Lovelace')} ${person(GRACE, 'Grace H')} agreed`,
    });
    expect(notifications.create.mock.calls.map(([n]) => [n.userId, n.title, n.message])).toEqual([
      [ADA, 'Wendy Writer commented on your post', '@Ada Lovelace @Grace H agreed'],
      [GRACE, 'Wendy Writer mentioned you in a comment', '@Ada Lovelace @Grace H agreed'],
    ]);
  });
});
