import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';

export const SUBJECT_KEY = 'candidate_subject';

/** What the route's id names, so the guard can find whose candidacy it is. */
export type SubjectKind =
  | 'candidate'
  | 'application'
  | 'interview'
  | 'aiScreen'
  | 'offer'
  | 'shortlistItem';

export interface CandidateSubject {
  kind: SubjectKind;
  /** `params.<name>` or `body.<name>`; a body field may hold one id or a list. */
  from: string;
}

/**
 * Marks a company-side route that acts on a particular candidate.
 *
 * One account can now act for a company and apply to it. Someone who applied
 * to their own company is a candidate there like anyone else — so they must
 * not read the team's notes on them, score their own interview, or move their
 * own application to Hired.
 */
export const AboutCandidate = (kind: SubjectKind, from: string) =>
  SetMetadata(SUBJECT_KEY, { kind, from } satisfies CandidateSubject);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELF_REVIEW =
  "This is about your own application. The rest of your company's hiring team handles it.";

/**
 * Refuses a company-side action whose candidate is the caller.
 *
 * Registered globally, after RolesGuard; routes without @AboutCandidate pass
 * straight through. Lists are filtered in their services instead, since a
 * list has many candidates and only the caller's own row should go.
 */
@Injectable()
export class SelfReviewGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const subject = this.reflector.getAllAndOverride<CandidateSubject>(SUBJECT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!subject) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;
    if (!user || user.role === UserRole.ADMIN) return true;

    const [where, name] = subject.from.split('.');
    const raw = (where === 'body' ? request.body : request.params)?.[name];
    // Guards run before the route's pipes, so a malformed id must not reach a
    // query here — it would fail as a server error instead of the 400 the
    // route's own validation gives it.
    const ids = (Array.isArray(raw) ? raw : [raw]).filter(
      (v): v is string => typeof v === 'string' && UUID.test(v),
    );

    for (const id of ids) {
      if ((await this.candidateOf(subject.kind, id)) === user.id) {
        throw new ForbiddenException(SELF_REVIEW);
      }
    }
    return true;
  }

  /** Null when the record doesn't exist; the route then reports that itself. */
  private async candidateOf(kind: SubjectKind, id: string): Promise<string | null> {
    switch (kind) {
      case 'candidate':
        return id;
      case 'application':
        return (await this.prisma.application.findUnique({ where: { id }, select: { applicantId: true } }))
          ?.applicantId ?? null;
      case 'interview':
        return (await this.prisma.interview.findUnique({ where: { id }, select: { candidateId: true } }))
          ?.candidateId ?? null;
      case 'aiScreen':
        return (await this.prisma.aiScreen.findUnique({ where: { id }, select: { candidateId: true } }))
          ?.candidateId ?? null;
      case 'offer':
        return (
          await this.prisma.offer.findUnique({
            where: { id },
            select: { application: { select: { applicantId: true } } },
          })
        )?.application.applicantId ?? null;
      case 'shortlistItem':
        return (await this.prisma.shortlistItem.findUnique({ where: { id }, select: { candidateId: true } }))
          ?.candidateId ?? null;
    }
  }
}
