import { ForbiddenException } from '@nestjs/common';
import { CommentPolicy, CompanyMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Who may comment on a post, as its author chose: anyone, followers only, or
 * nobody — LinkedIn's three comment settings.
 *
 * "Followers" follows the rule the Following feed already uses: a person is
 * followed for what they say as themselves, a company through its page. So on
 * a personal post it means the author's followers; on a company post, the
 * company page's followers, plus the company's own team, who speak for it. The
 * author may always comment, except when comments are off for everyone.
 *
 * One function decides, for the comment box and for the server alike, so the
 * box never offers what the server would refuse.
 */

/** The parts of a post the rule reads. A missing policy is the default, anyone. */
export interface PolicyPost {
  id: string;
  authorId: string;
  companyId?: string | null;
  commentPolicy?: CommentPolicy | null;
}

type PolicyReader = Pick<PrismaService, 'userFollow' | 'companyFollow' | 'companyMember'>;

/** May this viewer start a comment or a reply, per post. Signed out counts as nobody. */
export async function commentAccess(
  prisma: PolicyReader,
  posts: PolicyPost[],
  viewerId?: string,
): Promise<Map<string, boolean>> {
  const access = new Map<string, boolean>();
  const restricted: PolicyPost[] = [];
  for (const post of posts) {
    const policy = post.commentPolicy ?? CommentPolicy.ANYONE;
    if (policy === CommentPolicy.FOLLOWERS) restricted.push(post);
    else access.set(post.id, policy === CommentPolicy.ANYONE);
  }
  if (restricted.length === 0) return access;
  if (!viewerId) {
    for (const post of restricted) access.set(post.id, false);
    return access;
  }

  // One query of each kind for the whole page, not one per card.
  const authorIds = [...new Set(restricted.filter((p) => !p.companyId).map((p) => p.authorId))];
  const companyIds = [...new Set(restricted.flatMap((p) => (p.companyId ? [p.companyId] : [])))];
  const [people, pages, seats] = await Promise.all([
    authorIds.length
      ? prisma.userFollow.findMany({
          where: { followerId: viewerId, followingId: { in: authorIds } },
          select: { followingId: true },
        })
      : Promise.resolve([]),
    companyIds.length
      ? prisma.companyFollow.findMany({
          where: { userId: viewerId, company: { companyId: { in: companyIds } } },
          select: { company: { select: { companyId: true } } },
        })
      : Promise.resolve([]),
    companyIds.length
      ? prisma.companyMember.findMany({
          where: { userId: viewerId, companyId: { in: companyIds }, status: CompanyMemberStatus.ACTIVE },
          select: { companyId: true },
        })
      : Promise.resolve([]),
  ]);

  const followedPeople = new Set(people.map((f) => f.followingId));
  const followedCompanies = new Set(pages.flatMap((f) => (f.company.companyId ? [f.company.companyId] : [])));
  const teams = new Set(seats.map((s) => s.companyId));

  for (const post of restricted) {
    const allowed =
      post.authorId === viewerId ||
      (post.companyId
        ? followedCompanies.has(post.companyId) || teams.has(post.companyId)
        : followedPeople.has(post.authorId));
    access.set(post.id, allowed);
  }
  return access;
}

/** Refuses a comment or reply the post's setting does not allow, saying why. */
export async function assertMayComment(prisma: PolicyReader, post: PolicyPost, viewerId: string): Promise<void> {
  if ((await commentAccess(prisma, [post], viewerId)).get(post.id)) return;
  throw new ForbiddenException(
    post.commentPolicy === CommentPolicy.OFF
      ? 'Comments are turned off for this post.'
      : post.companyId
        ? 'Only people who follow this company can comment on its post.'
        : 'Only people who follow the author can comment on this post.',
  );
}
