import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';

const DAY_MS = 86_400_000;

export interface ScoreItem {
  label: string;
  points: number;
  done: boolean;
  /**
   * False when there's nothing to judge yet — an employer with no applicants
   * hasn't failed to respond to them. Inapplicable items are excluded from the
   * total instead of counting as a loss.
   */
  applicable: boolean;
  hint?: string;
  link?: string;
}

export interface ScoreComponent {
  id: string;
  label: string;
  description: string;
  earned: number;
  possible: number;
  items: ScoreItem[];
}

/**
 * Employer brand score.
 *
 * A **checklist**, not a statistical index. Every point is a concrete thing
 * that is either done or not, so the number can always be explained and always
 * points at something to fix.
 *
 * Two deliberate exclusions:
 *
 * - **Audience size.** Follower and view counts scale with how big and how old
 *   a company is. Scoring them would mean a small employer doing everything
 *   right can never score well, which makes the number a proxy for size rather
 *   than for behaviour.
 * - **Industry comparison.** The old UI showed "82" beside "Industry avg 71".
 *   There is no industry data here, and inventing a baseline is what made the
 *   original number meaningless.
 *
 * What it does measure is what the employer controls: how complete their
 * profile is, how they treat candidates, and whether they're active. The
 * responsiveness component matters most, because being left without an answer
 * is what candidates actually experience as a company's reputation.
 */
@Injectable()
export class BrandScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  async forEmployer(user: User) {
    // Scored at company level: the checklist is about how the company treats
    // candidates, not about which colleague happened to answer them.
    const memberIds = await this.companyContext.memberUserIds(user.id);
    const [profile, jobs, apps, staleApps, interviews, openInterviews, recentPosts] =
      await Promise.all([
        this.prisma.employerProfile.findUnique({ where: { userId: user.id } }),
        this.prisma.job.findMany({
          where: { postedById: { in: memberIds } },
          select: { id: true, status: true, skills: true, description: true },
        }),
        this.prisma.application.count({ where: { job: { postedById: { in: memberIds } } } }),
        this.prisma.application.count({
          where: {
            job: { postedById: { in: memberIds } },
            status: 'pending',
            appliedAt: { lt: new Date(Date.now() - 7 * DAY_MS) },
          },
        }),
        this.prisma.interview.count({
          where: { employerId: { in: memberIds }, scheduledAt: { lt: new Date(), not: null } },
        }),
        this.prisma.interview.count({
          where: {
            employerId: { in: memberIds },
            outcome: null,
            scheduledAt: { lt: new Date(Date.now() - 5 * DAY_MS), not: null },
            status: { in: ['confirmed', 'completed'] },
          },
        }),
        this.prisma.post.count({
          where: { authorId: { in: memberIds }, createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) } },
        }),
      ]);

    const p = profile;
    const filled = (v: unknown) =>
      Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null;

    const activeJobs = jobs.filter((j) => j.status === 'active');

    const components: ScoreComponent[] = [
      {
        id: 'profile',
        label: 'Profile',
        description: 'What a candidate sees when they look you up.',
        earned: 0,
        possible: 0,
        items: [
          { label: 'Company logo', points: 5, done: filled(p?.companyLogo), applicable: true, link: '/employers/company' },
          { label: 'Banner image', points: 3, done: filled(p?.companyBanner), applicable: true, link: '/employers/company' },
          { label: 'Tagline', points: 3, done: filled(p?.tagline), applicable: true, link: '/employers/company' },
          { label: 'Company description', points: 8, done: filled(p?.companyDescription), applicable: true, link: '/employers/company' },
          { label: 'What it’s like to work here', points: 6, done: filled(p?.companyCulture) || filled(p?.whyWorkHere), applicable: true, link: '/employers/company' },
          { label: 'Benefits listed', points: 5, done: filled(p?.companyBenefits), applicable: true, link: '/employers/company' },
          { label: 'Website', points: 3, done: filled(p?.companyWebsite), applicable: true, link: '/employers/company' },
          { label: 'Industry and size', points: 3, done: filled(p?.industry) && filled(p?.companySize), applicable: true, link: '/employers/company' },
          { label: 'Headquarters', points: 2, done: filled(p?.headquarters), applicable: true, link: '/employers/company' },
          { label: 'Verified', points: 2, done: p?.verificationStatus === 'verified', applicable: true, hint: 'Verification is reviewed by our team.' },
        ],
      },
      {
        id: 'candidates',
        label: 'Candidate experience',
        description:
          'How people are treated after they apply. Weighted heaviest — being left without an answer is what candidates remember.',
        earned: 0,
        possible: 0,
        items: [
          {
            label: 'No application left unopened over a week',
            points: 20,
            done: staleApps === 0,
            // Nothing to judge before anyone has applied.
            applicable: apps > 0,
            hint: staleApps > 0 ? `${staleApps} waiting more than 7 days` : undefined,
            link: '/employers/candidates',
          },
          {
            label: 'Every past interview has an outcome recorded',
            points: 15,
            done: openInterviews === 0,
            applicable: interviews > 0,
            hint: openInterviews > 0 ? `${openInterviews} with no outcome` : undefined,
            link: '/employers/candidates',
          },
        ],
      },
      {
        id: 'activity',
        label: 'Activity',
        description: 'Whether there’s anything live to find.',
        earned: 0,
        possible: 0,
        items: [
          { label: 'At least one live job', points: 10, done: activeJobs.length > 0, applicable: true, link: '/employers/jobs' },
          {
            label: 'Live jobs list required skills',
            points: 5,
            done: activeJobs.length > 0 && activeJobs.every((j) => j.skills.length > 0),
            applicable: activeJobs.length > 0,
            link: '/employers/jobs',
          },
          {
            label: 'Posted something in the last 30 days',
            points: 10,
            done: recentPosts > 0,
            applicable: true,
            hint: 'Posts appear in the community feed.',
          },
        ],
      },
    ];

    // Only applicable points count, so a new employer isn't marked down for
    // candidates they don't have yet.
    let earned = 0;
    let possible = 0;
    for (const c of components) {
      c.earned = c.items.reduce((a, i) => a + (i.applicable && i.done ? i.points : 0), 0);
      c.possible = c.items.reduce((a, i) => a + (i.applicable ? i.points : 0), 0);
      earned += c.earned;
      possible += c.possible;
    }

    const score = possible > 0 ? Math.round((earned / possible) * 100) : null;
    const missing = components
      .flatMap((c) => c.items)
      .filter((i) => i.applicable && !i.done)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((i) => i.label);

    return {
      /** 0-100, or null when nothing is applicable yet. */
      score,
      earned,
      possible,
      components,
      /** The highest-value things not yet done. */
      nextSteps: missing,
      method:
        'A checklist of things you control: profile completeness, how quickly candidates hear back, and whether you have anything live. Follower and view counts are excluded — those track company size, not how you hire. There is no industry comparison, because we have no industry data to compare against.',
    };
  }
}
