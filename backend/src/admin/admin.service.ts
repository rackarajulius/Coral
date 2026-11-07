import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { computeProfileCompletion } from '../common/profile-completion';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { JobsListQueryDto } from './dto/jobs-list-query.dto';
import { ApplicationsListQueryDto } from './dto/applications-list-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import type { AdminSettableJobStatus } from './dto/update-job-status.dto';
import { MetricSnapshotService } from './metric-snapshot.service';
import { AuditLogService } from './audit-log.service';
import { SeekerPremiumService } from '../seeker-billing/seeker-premium.service';

/** A KPI card's history: a sparkline and % change, or null change when there's none. */
type KpiTrend = { trend: number[]; change: number | null };
const NO_TREND: KpiTrend = { trend: [], change: null };

/** What the admin jobs page calls each status. See `jobStatusWhere`. */
export type AdminJobStatusLabel = 'Active' | 'Expired' | 'Draft' | 'Paused' | 'Closed' | 'Archived';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private readonly snapshots: MetricSnapshotService,
    private readonly audit: AuditLogService,
    private readonly premium: SeekerPremiumService,
  ) {}

  /**
   * Trend + change from daily snapshots, or nothing at all until two days of
   * history exist. `change: null` tells the card to say nothing — it used to
   * get a random sparkline and a ratio against a guessed baseline instead.
   */
  private async snapshotTrend(key: string): Promise<KpiTrend> {
    const real = await this.snapshots.getTrend(key, 7);
    return real.trend.length >= 2 ? real : NO_TREND;
  }

  /**
   * Like {@link snapshotTrend} but for flow metrics — uses the day-over-day
   * deltas of a cumulative snapshot (e.g. new applications per day).
   */
  private async snapshotDeltaTrend(key: string): Promise<KpiTrend> {
    const real = await this.snapshots.getDeltaTrend(key, 7);
    return real.trend.length >= 2 ? real : NO_TREND;
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users as User[];
  }

  async getDashboardMetrics() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalJobseekers,
      totalEmployers,
      totalFreelancers,
      activeListings,
      applicationsToday,
      newSignups24h,
      revenueMTD,
      totalUsers,
      totalPosts,
      totalApplications,
      totalJobs,
      jobPostsOverTime,
      applicationsByCategory,
      employerApprovalRate,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'JOB_SEEKER' } }),
      this.prisma.user.count({ where: { role: 'EMPLOYER' } }),
      this.prisma.user.count({ where: { role: 'FREELANCER' } }),
      this.prisma.job.count({ where: { status: 'active', publishedAt: { not: null } } }),
      this.prisma.application.count({
        where: { appliedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: oneDayAgo } } }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.application.count(),
      this.prisma.job.count(),
      this.prisma.$queryRaw`
        SELECT
          TO_CHAR(m.month, 'Mon YYYY') as month,
          COUNT(j.id)::int as posts
        FROM generate_series(
          DATE_TRUNC('month', NOW()) - INTERVAL '11 months',
          DATE_TRUNC('month', NOW()),
          INTERVAL '1 month'
        ) AS m(month)
        LEFT JOIN jobs j
          ON DATE_TRUNC('month', j.created_at) = m.month
        GROUP BY m.month
        ORDER BY m.month
      `,
      this.prisma.$queryRaw`
        SELECT
          j.category as category,
          COUNT(a.id)::int as apps
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.category IS NOT NULL AND j.category != ''
        GROUP BY j.category
        ORDER BY apps DESC
        LIMIT 6
      `,
      this.prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('week', created_at), 'Mon DD') as week,
          ROUND(
            (COUNT(CASE WHEN status = 'active' THEN 1 END)::decimal /
             NULLIF(COUNT(*), 0) * 100)::numeric, 1
          )::float as rate
        FROM jobs
        WHERE created_at >= DATE_TRUNC('week', NOW() - INTERVAL '8 weeks')
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY DATE_TRUNC('week', created_at)
      `,
      this.prisma.$queryRaw`
        (
          SELECT
            'user_signup'::text as type,
            u.email::text as detail,
            u.created_at::timestamptz as timestamp,
            CASE WHEN u.role = 'EMPLOYER' THEN 'Employer' ELSE 'Job Seeker' END::text as category
          FROM users u
          ORDER BY u.created_at DESC
          LIMIT 10
        )
        UNION ALL
        (
          SELECT
            'job_posted'::text as type,
            j.title::text as detail,
            j.created_at::timestamptz as timestamp,
            'Job'::text as category
          FROM jobs j
          ORDER BY j.created_at DESC
          LIMIT 10
        )
        UNION ALL
        (
          SELECT
            'application'::text as type,
            CONCAT('Applied to: ', j.title)::text as detail,
            a.applied_at::timestamptz as timestamp,
            'Application'::text as category
          FROM applications a
          JOIN jobs j ON a.job_id = j.id
          ORDER BY a.applied_at DESC
          LIMIT 10
        )
        ORDER BY timestamp DESC
        LIMIT 10
      `,
    ]);

    // Trends only from recorded daily snapshots; until there are two days of
    // them, a card shows its value and nothing else.
    const [jobseekersTrend, employersTrend, listingsTrend, applicationsTrend, revenueTrend] = await Promise.all([
      this.snapshotTrend('jobseekers.total'),
      this.snapshotTrend('employers.total'),
      this.snapshotTrend('listings.active'),
      // "Applications Today" is a flow metric — track daily-new, not the running total.
      this.snapshotDeltaTrend('applications.total'),
      this.snapshotTrend('revenue.mtd'),
    ]);

    // No "Reports & Flags" card: it was a hardcoded 0. It comes back with the
    // reports inbox, counted from the real report tables.
    return {
      kpis: [
        { label: "Total Jobseekers", value: totalJobseekers.toLocaleString(), icon: "Users", ...jobseekersTrend },
        { label: "Total Employers", value: totalEmployers.toLocaleString(), icon: "Building2", ...employersTrend },
        { label: "Active Listings", value: activeListings.toLocaleString(), icon: "Briefcase", ...listingsTrend },
        { label: "Applications Today", value: applicationsToday.toLocaleString(), icon: "FileText", ...applicationsTrend },
        // Nothing snapshots signups yet, so no trend.
        { label: "New Signups (24h)", value: newSignups24h.toLocaleString(), icon: "UserPlus", ...NO_TREND },
        { label: "Revenue (MTD)", value: `$${(revenueMTD._sum.amount || 0).toLocaleString()}`, icon: "DollarSign", ...revenueTrend },
      ],
      summary: {
        totalUsers,
        totalJobseekers,
        totalEmployers,
        totalFreelancers,
        activeListings,
        totalApplications,
        totalPosts,
        totalJobs,
        revenueMTD: revenueMTD._sum.amount || 0,
      },
      charts: { jobPostsOverTime, applicationsByCategory, employerApprovalRate, recentActivity },
    };
  }

  async getJobseekerMetrics() {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalJobseekers, newSignups7d, active30d, suspended, flagged, premiumUsers] = await Promise.all([
      this.prisma.user.count({ where: { role: 'JOB_SEEKER' } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER', createdAt: { gte: last7Days } } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER', status: 'ACTIVE', lastLoginAt: { gte: last30Days } } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER', status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER', status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER', subscriptionTier: 'premium' } }),
    ]);

    return {
      totalJobseekers,
      newSignups7d,
      active30d,
      suspended,
      flagged,
      // Paid or complimentary — the same tier every feature checks.
      premiumUsers,
      // No trend figures: nothing records these counts over time, and a ratio
      // against a guessed baseline is not a trend.
    };
  }

  /**
   * Real profile-completion percentage (0-100).
   *
   * The weights live in `common/profile-completion`, shared with every other
   * place the server answers this question, and mirroring the candidate's own
   * meter.
   */
  private computeJobseekerCompletion(user: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    jobSeekerProfile: {
      city: string | null;
      state: string | null;
      country: string | null;
      headline: string | null;
      summary: string | null;
      languages: string[];
      skills: string[];
      _count: {
        experiences: number;
        educations: number;
        certifications: number;
        portfolioItems: number;
      };
    } | null;
  }): number {
    const p = user.jobSeekerProfile;

    return computeProfileCompletion({
      name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      headline: p?.headline,
      location: [p?.city, p?.state, p?.country].filter(Boolean).join(', '),
      summary: p?.summary,
      languages: p?.languages,
      skills: p?.skills,
      experienceCount: p?._count.experiences,
      educationCount: p?._count.educations,
      certificationCount: p?._count.certifications,
      portfolioCount: p?._count.portfolioItems,
    });
  }

  async getJobseekersList(query: AdminListQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;
    const dir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';

    const and: Prisma.UserWhereInput[] = [{ role: 'JOB_SEEKER' }];
    if (query.search?.trim()) {
      const s = query.search.trim();
      and.push({
        OR: [
          { email: { contains: s, mode: 'insensitive' } },
          { displayName: { contains: s, mode: 'insensitive' } },
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.UserWhereInput = { AND: and };

    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sort === 'applications'
        ? { applications: { _count: dir } }
        : query.sort === 'savedJobs'
          ? { savedJobs: { _count: dir } }
          : { lastLoginAt: dir }; // lastActive (default)

    const selection = {
      id: true,
      email: true,
      displayName: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      status: true,
      subscriptionTier: true,
      createdAt: true,
      lastLoginAt: true,
      jobSeekerProfile: {
        select: {
          city: true,
          state: true,
          country: true,
          headline: true,
          summary: true,
          languages: true,
          skills: true,
          _count: {
            select: {
              experiences: true,
              educations: true,
              certifications: true,
              portfolioItems: true,
            },
          },
        },
      },
      _count: {
        select: { applications: true, savedJobs: true },
      },
      // Identity verification: present only if APPROVED.
      verifications: {
        where: { type: 'IDENTITY' as const, status: 'APPROVED' as const },
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.UserSelect;

    const [jobseekers, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: selection, orderBy, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    const data = jobseekers.map((user) => ({
      id: user.id,
      name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
      email: user.email,
      location:
        [user.jobSeekerProfile?.city, user.jobSeekerProfile?.state, user.jobSeekerProfile?.country]
          .filter(Boolean)
          .join(', ') || 'Unknown',
      avatar: user.avatarUrl || (user.displayName || user.email).substring(0, 2).toUpperCase(),
      applications: user._count.applications,
      savedJobs: user._count.savedJobs,
      profileCompletion: this.computeJobseekerCompletion(user),
      lastActive: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
      signupDate: user.createdAt.toISOString(),
      status: user.status === 'ACTIVE' ? 'Active' : user.status === 'SUSPENDED' ? 'Suspended' : 'Inactive',
      // No risk model yet — keep it stable rather than random.
      risk: 'Low' as const,
      riskScore: 0,
      // Paid or complimentary, as the product itself sees it. A one-off payment
      // is not Premium.
      isPremium: user.subscriptionTier === 'premium',
      isVerified: user.verifications.length > 0,
    }));

    return { data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }

  async getEmployerMetrics() {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalEmployers, active30d, suspended, verified] = await Promise.all([
      this.prisma.user.count({ where: { role: 'EMPLOYER' } }),
      this.prisma.user.count({ where: { role: 'EMPLOYER', postedJobs: { some: { publishedAt: { gte: last30Days } } } } }),
      this.prisma.user.count({ where: { role: 'EMPLOYER', status: 'SUSPENDED' } }),
      this.prisma.employerProfile.count({ where: { verificationStatus: 'verified' } }),
    ]);

    // Anyone not yet verified is awaiting approval.
    const pendingApproval = Math.max(totalEmployers - verified, 0);

    // Trends/change from recorded daily snapshots only.
    const [activeTrend, pendingTrend, verifiedTrend, suspendedTrend] = await Promise.all([
      this.snapshotTrend('employers.active'),
      this.snapshotTrend('employers.pending'),
      this.snapshotTrend('employers.verified'),
      this.snapshotTrend('employers.suspended'),
    ]);

    return {
      kpis: [
        { label: "Active Employers", value: active30d.toLocaleString(), change: activeTrend.change, icon: "Briefcase", trend: activeTrend.trend },
        { label: "Pending Approval", value: pendingApproval.toLocaleString(), change: pendingTrend.change, icon: "Clock", trend: pendingTrend.trend },
        { label: "Verified", value: verified.toLocaleString(), change: verifiedTrend.change, icon: "CheckCircle2", trend: verifiedTrend.trend },
        { label: "Suspended Employers", value: suspended.toLocaleString(), change: suspendedTrend.change, icon: "ShieldX", trend: suspendedTrend.trend },
      ],
      summary: { totalEmployers, activeEmployers: active30d, pendingApproval, verified, suspendedEmployers: suspended },
    };
  }

  async getEmployersList(query: AdminListQueryDto = {}) {
    const now = new Date();
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;
    const dir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';

    const and: Prisma.UserWhereInput[] = [{ role: 'EMPLOYER' }];

    if (query.search?.trim()) {
      const s = query.search.trim();
      and.push({
        OR: [
          { email: { contains: s, mode: 'insensitive' } },
          { employerProfile: { companyName: { contains: s, mode: 'insensitive' } } },
        ],
      });
    }

    switch (query.status) {
      case 'banned':
        and.push({ status: 'BANNED' });
        break;
      case 'suspended':
        and.push({ status: 'SUSPENDED' });
        break;
      case 'verified':
        and.push({ status: { notIn: ['SUSPENDED', 'BANNED'] }, employerProfile: { verificationStatus: 'verified' } });
        break;
      case 'pending':
        and.push({
          status: { notIn: ['SUSPENDED', 'BANNED'] },
          OR: [
            { employerProfile: { is: null } },
            { employerProfile: { verificationStatus: { not: 'verified' } } },
          ],
        });
        break;
    }

    if (query.industry?.trim()) {
      const ind = query.industry.trim();
      and.push({ employerProfile: { OR: [{ industry: ind }, { industries: { has: ind } }] } });
    }

    const where: Prisma.UserWhereInput = { AND: and };

    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sort === 'company'
        ? { employerProfile: { companyName: dir } }
        : query.sort === 'jobsPosted'
          ? { postedJobs: { _count: dir } }
          : { createdAt: dir }; // joinedDate (default)

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          employerProfile: true,
          postedJobs: { select: { id: true, status: true, applicationsCount: true, createdAt: true, applicationDeadline: true } },
          // Billing signal: has at least one successful payment.
          paymentTransactions: { where: { status: 'PAID' }, select: { id: true }, take: 1 },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = rows.map((user) => {
      const profile = user.employerProfile;
      const totalJobs = user.postedJobs.length;
      const activeJobs = user.postedJobs.filter(job => job.status === 'active').length;
      const expiredJobs = user.postedJobs.filter(job => job.applicationDeadline && job.applicationDeadline < now).length;
      const totalApplications = user.postedJobs.reduce((sum: number, job) => sum + job.applicationsCount, 0);

      // Map to the admin UI's status vocabulary: banned/suspended account →
      // banned/suspended; verified profile → verified; else awaiting approval.
      const status: 'verified' | 'pending' | 'suspended' | 'banned' =
        user.status === 'BANNED'
          ? 'banned'
          : user.status === 'SUSPENDED'
            ? 'suspended'
            : profile?.verificationStatus === 'verified'
              ? 'verified'
              : 'pending';

      return {
        id: user.id,
        name: profile?.companyName || user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
        email: user.email,
        company: profile?.companyName || 'Unknown',
        logo: (profile?.companyName || user.email).substring(0, 2).toUpperCase(),
        logoUrl: profile?.companyLogo || null,
        website: profile?.companyWebsite || '',
        companySize: profile?.companySize || '',
        location: profile?.headquarters || 'Unknown',
        industry: profile?.industry || profile?.industries?.[0] || 'Unknown',
        jobsPosted: totalJobs,
        activeJobs,
        expiredJobs,
        applicationsReceived: totalApplications,
        plan: 'Free' as const,
        billingStatus: user.paymentTransactions.length > 0 ? 'Paid' : 'Free',
        joinedDate: user.createdAt.toISOString(),
        lastActive: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
        status,
        isVerified: profile?.verificationStatus === 'verified',
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }

  // --- Employer admin actions ---

  /** Loads an employer with the fields the audit trail needs, or 404s. */
  private async assertEmployer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        displayName: true,
        email: true,
        employerProfile: { select: { companyName: true, verificationStatus: true } },
      },
    });
    if (!user || user.role !== 'EMPLOYER') {
      throw new NotFoundException('Employer not found');
    }
    return user;
  }

  private employerLabel(user: { displayName: string | null; email: string; employerProfile: { companyName: string | null } | null }) {
    return user.employerProfile?.companyName || user.displayName || user.email;
  }

  /** Approve = mark the employer's profile verified and ensure the account is active. */
  async approveEmployer(adminId: string, userId: string) {
    const before = await this.assertEmployer(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    await this.prisma.employerProfile.updateMany({
      where: { userId },
      data: { verificationStatus: 'verified' },
    });
    this.logger.log(`Approved employer ${userId}`);
    await this.audit.record({
      adminId,
      action: 'Approve',
      entityType: 'Employer',
      entityId: userId,
      entityName: this.employerLabel(before),
      changeSummary: 'Employer approved and verified',
      before: { status: before.status, verificationStatus: before.employerProfile?.verificationStatus ?? null },
      after: { status: 'ACTIVE', verificationStatus: 'verified' },
    });
  }

  async setEmployerStatus(adminId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') {
    const before = await this.assertEmployer(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    this.logger.log(`Set employer ${userId} status to ${status}`);
    await this.audit.record({
      adminId,
      action: 'Update',
      entityType: 'Employer',
      entityId: userId,
      entityName: this.employerLabel(before),
      changeSummary: `Status: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status },
    });
  }

  async deleteEmployer(adminId: string, userId: string) {
    const before = await this.assertEmployer(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Deleted employer ${userId}`);
    await this.audit.record({
      adminId,
      action: 'Delete',
      entityType: 'Employer',
      entityId: userId,
      entityName: this.employerLabel(before),
      changeSummary: 'Employer account deleted',
      before: { status: before.status, email: before.email },
    });
  }

  // --- Job admin actions ---

  /** Loads a job with the fields the audit trail needs, or 404s. */
  private async assertJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, status: true, publishedAt: true, applicationDeadline: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async setJobStatus(adminId: string, jobId: string, status: AdminSettableJobStatus) {
    const before = await this.assertJob(jobId);
    if (before.status === status) return;

    if (status === 'active') {
      // Publishing a job its employer never published would put an unfinished
      // posting in front of candidates on the admin's say-so.
      if (!before.publishedAt) {
        throw new BadRequestException('This job has never been published. Only its employer can publish a draft.');
      }
      // The expiry cron would archive it again within a day, and search
      // already hides it, so "active" would only be a label.
      if (before.applicationDeadline && before.applicationDeadline < new Date()) {
        throw new BadRequestException('Its application deadline has passed. The employer needs to extend it before it can go live again.');
      }
    }

    await this.prisma.job.update({ where: { id: jobId }, data: { status } });
    this.logger.log(`Set job ${jobId} status to ${status}`);
    await this.audit.record({
      adminId,
      action: 'Update',
      entityType: 'Job',
      entityId: jobId,
      entityName: before.title,
      changeSummary: `Status: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status },
    });
  }

  async deleteJob(adminId: string, jobId: string) {
    const before = await this.assertJob(jobId);
    await this.prisma.job.delete({ where: { id: jobId } });
    this.logger.log(`Deleted job ${jobId}`);
    await this.audit.record({
      adminId,
      action: 'Delete',
      entityType: 'Job',
      entityId: jobId,
      entityName: before.title,
      changeSummary: 'Job posting deleted',
      before: { status: before.status, title: before.title },
    });
  }

  // --- Jobseeker admin actions ---

  /** Loads a jobseeker with the fields the audit trail needs, or 404s. */
  private async assertJobseeker(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, displayName: true, email: true },
    });
    if (!user || user.role !== 'JOB_SEEKER') {
      throw new NotFoundException('Jobseeker not found');
    }
    return user;
  }

  async setJobseekerStatus(adminId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') {
    const before = await this.assertJobseeker(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    this.logger.log(`Set jobseeker ${userId} status to ${status}`);
    await this.audit.record({
      adminId,
      action: 'Update',
      entityType: 'Jobseeker',
      entityId: userId,
      entityName: before.displayName || before.email,
      changeSummary: `Status: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status },
    });
  }

  /* ------------------------------ premium comps ----------------------------- */

  getJobseekerPremium(userId: string) {
    return this.premium.adminView(userId);
  }

  async grantJobseekerPremium(adminId: string, userId: string, dto: { until: string; reason: string }) {
    const subject = await this.assertJobseeker(userId);
    const result = await this.premium.grantComp(adminId, userId, new Date(dto.until), dto.reason);
    await this.audit.record({
      adminId,
      action: 'Grant Premium',
      entityType: 'Jobseeker',
      entityId: userId,
      entityName: subject.displayName || subject.email,
      changeSummary: `Complimentary Premium until ${result.after.toISOString().slice(0, 10)} — ${dto.reason.trim()}`,
      before: { compedUntil: result.before ? result.before.toISOString() : null },
      after: { compedUntil: result.after.toISOString(), reason: dto.reason.trim(), tier: result.tier },
    });
    return this.premium.adminView(userId);
  }

  async revokeJobseekerPremium(adminId: string, userId: string) {
    const subject = await this.assertJobseeker(userId);
    const result = await this.premium.revokeComp(userId);
    await this.audit.record({
      adminId,
      action: 'Revoke Premium',
      entityType: 'Jobseeker',
      entityId: userId,
      entityName: subject.displayName || subject.email,
      changeSummary: `Complimentary Premium ended early (was until ${result.before.toISOString().slice(0, 10)}); tier now ${result.tier}`,
      before: { compedUntil: result.before.toISOString() },
      after: { tier: result.tier },
    });
    return this.premium.adminView(userId);
  }

  async deleteJobseeker(adminId: string, userId: string) {
    const before = await this.assertJobseeker(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Deleted jobseeker ${userId}`);
    await this.audit.record({
      adminId,
      action: 'Delete',
      entityType: 'Jobseeker',
      entityId: userId,
      entityName: before.displayName || before.email,
      changeSummary: 'Jobseeker account deleted',
      before: { status: before.status, email: before.email },
    });
  }

  // --- Application admin actions ---

  /** Loads an application with the fields the audit trail needs, or 404s. */
  private async assertApplication(id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        applicant: { select: { displayName: true, firstName: true, lastName: true, email: true } },
        job: { select: { title: true } },
      },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    return app;
  }

  async setApplicationStatus(adminId: string, id: string, status: string) {
    const before = await this.assertApplication(id);
    await this.prisma.application.update({ where: { id }, data: { status } });
    this.logger.log(`Set application ${id} status to ${status}`);
    const applicantName =
      before.applicant.displayName ||
      `${before.applicant.firstName || ''} ${before.applicant.lastName || ''}`.trim() ||
      before.applicant.email;
    await this.audit.record({
      adminId,
      action: status === 'rejected' ? 'Reject' : 'Update',
      entityType: 'Application',
      entityId: id,
      entityName: applicantName,
      changeSummary: `${before.job.title} · ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status },
    });
  }

  async deleteApplication(adminId: string, id: string) {
    const before = await this.assertApplication(id);
    await this.prisma.application.delete({ where: { id } });
    this.logger.log(`Deleted application ${id}`);
    const applicantName =
      before.applicant.displayName ||
      `${before.applicant.firstName || ''} ${before.applicant.lastName || ''}`.trim() ||
      before.applicant.email;
    await this.audit.record({
      adminId,
      action: 'Delete',
      entityType: 'Application',
      entityId: id,
      entityName: applicantName,
      changeSummary: `Application deleted · ${before.job.title}`,
      before: { status: before.status },
    });
  }

  /** Paginated audit-log feed for the admin UI. */
  async getAuditLogs(query: AuditLogsQueryDto = {}) {
    return this.audit.list(query);
  }

  /**
   * The admin jobs page's status vocabulary, as `where` clauses.
   *
   * These are the schema's own statuses, plus Expired — a job still marked
   * active whose deadline has passed. Search already hides those, and the
   * expiry cron archives them a day later, so calling them Active would
   * overstate what is live.
   *
   * The six buckets don't overlap and together cover every job, so the KPI
   * cards add up to the total. The list, its filter and the cards all read
   * from here, so a label can't mean one thing in the table and another in a
   * count.
   */
  private jobStatusWhere(now: Date): Record<AdminJobStatusLabel, Prisma.JobWhereInput> {
    return {
      Active: { status: 'active', OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: now } }] },
      Expired: { status: 'active', applicationDeadline: { lt: now } },
      Draft: { status: 'draft' },
      Paused: { status: 'paused' },
      Closed: { status: 'closed' },
      Archived: { status: 'archived' },
    };
  }

  async getJobsMetrics() {
    const where = this.jobStatusWhere(new Date());
    const labels = Object.keys(where) as AdminJobStatusLabel[];
    const counts = await Promise.all(labels.map((label) => this.prisma.job.count({ where: where[label] })));

    // No change figures or sparklines: nothing records these counts over time.
    return {
      kpis: labels.map((label, i) => ({ label, value: counts[i].toLocaleString() })),
      summary: Object.fromEntries(labels.map((label, i) => [label, counts[i]])),
    };
  }

  async getJobsList(query: JobsListQueryDto = {}) {
    const now = new Date();
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;
    const dir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';

    const and: Prisma.JobWhereInput[] = [];

    if (query.search?.trim()) {
      const s = query.search.trim();
      and.push({
        OR: [
          { title: { contains: s, mode: 'insensitive' } },
          { location: { contains: s, mode: 'insensitive' } },
          { postedBy: { employerProfile: { companyName: { contains: s, mode: 'insensitive' } } } },
        ],
      });
    }

    // Status filter — the same buckets the KPI cards count.
    const statusWhere = this.jobStatusWhere(now);
    const statuses = (query.statuses || '').split(',').map((x: string) => x.trim()).filter(Boolean);
    if (statuses.length) {
      const conds = statuses
        .filter((s): s is AdminJobStatusLabel => s in statusWhere)
        .map((s) => statusWhere[s]);
      // Every requested status unknown → match nothing, rather than silently
      // dropping the filter and showing everything.
      and.push(conds.length ? { OR: conds } : { id: { in: [] } });
    }

    const types = (query.types || '').split(',').map((x: string) => x.trim()).filter(Boolean);
    if (types.length) {
      const conds: Prisma.JobWhereInput[] = types.map((t: string) => {
        const lt = t.toLowerCase();
        const kw = lt.includes('full') ? 'full' : lt.includes('part') ? 'part' : lt.includes('contract') ? 'contract' : 'intern';
        return { employmentType: { contains: kw, mode: 'insensitive' as const } };
      });
      and.push({ OR: conds });
    }

    if (query.location?.trim()) and.push({ location: { contains: query.location.trim(), mode: 'insensitive' } });
    if (query.dateFrom) and.push({ createdAt: { gte: new Date(query.dateFrom) } });
    if (query.dateTo) and.push({ createdAt: { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } });
    if (query.salaryMin) and.push({ salaryMin: { gte: Number(query.salaryMin) } });
    if (query.salaryMax) and.push({ salaryMax: { lte: Number(query.salaryMax) } });
    if (query.minApplications) and.push({ applicationsCount: { gte: Number(query.minApplications) } });
    // Typed, not picked from a list, so match loosely.
    if (query.company?.trim()) {
      and.push({ postedBy: { employerProfile: { companyName: { contains: query.company.trim(), mode: 'insensitive' } } } });
    }
    if (query.industry?.trim()) and.push({ category: { contains: query.industry.trim(), mode: 'insensitive' } });

    const where: Prisma.JobWhereInput = and.length ? { AND: and } : {};

    const orderBy: Prisma.JobOrderByWithRelationInput =
      query.sort === 'applications' ? { applicationsCount: dir } : { createdAt: dir };

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          postedBy: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
              employerProfile: { select: { companyName: true, companyLogo: true } },
            },
          },
          applications: { select: { id: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    // Normalize free-form employmentType to the admin UI's type vocabulary.
    const mapType = (t: string): string => {
      const s = (t || '').toLowerCase().replace(/[\s_]/g, '-');
      if (s.includes('full')) return 'Full-time';
      if (s.includes('part')) return 'Part-time';
      if (s.includes('contract')) return 'Contract';
      if (s.includes('intern')) return 'Internship';
      return 'Full-time';
    };

    const currencySymbol = (code: string): string =>
      (({ USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$' } as Record<string, string>)[code] || `${code} `);

    // Stored status → admin label, matching jobStatusWhere. An unrecognised
    // status is shown as stored rather than relabelled as something it isn't.
    const mapStatus = (status: string, deadline: Date | null): string => {
      switch (status) {
        case 'active': return deadline && deadline < now ? 'Expired' : 'Active';
        case 'draft': return 'Draft';
        case 'paused': return 'Paused';
        case 'closed': return 'Closed';
        case 'archived': return 'Archived';
        default: return status;
      }
    };

    const data = jobs.map((job) => {
      const profile = job.postedBy.employerProfile;
      const posterName = job.postedBy.displayName || `${job.postedBy.firstName || ''} ${job.postedBy.lastName || ''}`.trim();
      return {
        id: job.id,
        title: job.title,
        company: profile?.companyName || posterName || 'Unknown',
        companyLogo: profile?.companyLogo || '',
        location: job.location || 'Remote',
        type: mapType(job.employmentType),
        salaryMin: job.salaryMin ?? undefined,
        salaryMax: job.salaryMax ?? undefined,
        currency: currencySymbol(job.salaryCurrency),
        postedDate: job.publishedAt?.toISOString().split('T')[0] || job.createdAt.toISOString().split('T')[0],
        applications: job.applicationsCount,
        status: mapStatus(job.status, job.applicationDeadline),
        // Whatever the status, a job past its deadline can't be made live again
        // from here — the admin UI uses this to not offer it.
        deadlinePassed: !!job.applicationDeadline && job.applicationDeadline < now,
        industry: job.category || 'General',
        expiryDate: job.applicationDeadline?.toISOString().split('T')[0],
        views: job.viewsCount,
        applicationsCount: job.applications.length,
        isActive: job.status === 'active',
        postedBy: {
          id: job.postedBy.id,
          name: posterName,
          email: job.postedBy.email,
        },
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }

  async getApplicationsMetrics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalApplications, applicationsToday, pendingReview, flagged, withdrawn, interviewsScheduled] = await Promise.all([
      this.prisma.application.count(),
      this.prisma.application.count({ where: { appliedAt: { gte: today } } }),
      this.prisma.application.count({ where: { status: 'pending' } }),
      this.prisma.application.count({ where: { status: 'flagged' } }),
      this.prisma.application.count({ where: { status: 'withdrawn' } }),
      this.prisma.application.count({ where: { status: 'interview' } }),
    ]);

    return {
      kpis: [
        // Counts only: nothing records these over time, so there is no change to show.
        { label: "Total Applications", value: totalApplications.toLocaleString() },
        { label: "Today", value: applicationsToday.toLocaleString() },
        { label: "Pending Review", value: pendingReview.toLocaleString() },
        { label: "Flagged", value: flagged.toLocaleString() },
        { label: "Withdrawn", value: withdrawn.toLocaleString() },
        { label: "Interviews Scheduled", value: interviewsScheduled.toLocaleString() },
      ],
      summary: { totalApplications, applicationsToday, pendingReview, flagged, withdrawn, interviewsScheduled },
    };
  }

  async getApplicationsList(query: ApplicationsListQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;
    const dir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';

    const and: Prisma.ApplicationWhereInput[] = [];

    if (query.search?.trim()) {
      const s = query.search.trim();
      and.push({
        OR: [
          { applicant: { displayName: { contains: s, mode: 'insensitive' } } },
          { applicant: { firstName: { contains: s, mode: 'insensitive' } } },
          { applicant: { lastName: { contains: s, mode: 'insensitive' } } },
          { applicant: { email: { contains: s, mode: 'insensitive' } } },
          { job: { title: { contains: s, mode: 'insensitive' } } },
        ],
      });
    }

    // Status filter — reverse-map the UI vocabulary back to stored statuses.
    const uiToStored: Record<string, string> = {
      'Under Review': 'pending',
      Submitted: 'pending',
      Shortlisted: 'shortlisted',
      Interview: 'interview',
      Rejected: 'rejected',
      Withdrawn: 'withdrawn',
      Flagged: 'flagged',
    };
    const statuses = (query.statuses || '').split(',').map((x: string) => x.trim()).filter(Boolean);
    if (statuses.length) {
      const stored = [...new Set(statuses.map((s: string) => uiToStored[s]).filter(Boolean) as string[])];
      if (stored.length) and.push({ status: { in: stored } });
    }
    if (query.flaggedOnly === 'true') and.push({ status: 'flagged' });

    const where: Prisma.ApplicationWhereInput = and.length ? { AND: and } : {};

    const orderBy: Prisma.ApplicationOrderByWithRelationInput =
      query.sort === 'applicant' ? { applicant: { displayName: dir } } : { appliedAt: dir };

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              postedBy: { select: { displayName: true, firstName: true, lastName: true } },
              location: true,
              salaryMin: true,
              salaryMax: true,
              salaryCurrency: true,
              employmentType: true,
              status: true,
              publishedAt: true,
            },
          },
          applicant: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              jobSeekerProfile: {
                select: {
                  phone: true,
                  city: true,
                  state: true,
                  country: true,
                  headline: true,
                  summary: true,
                  languages: true,
                  skills: true,
                  _count: {
                    select: { experiences: true, educations: true, certifications: true, portfolioItems: true },
                  },
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    const data = applications.map((app) => {
      const profile = app.applicant.jobSeekerProfile;
      const profileCompletion = this.computeJobseekerCompletion(app.applicant);
      return {
        id: app.id,
        applicant: {
          name: app.applicant.displayName || `${app.applicant.firstName || ''} ${app.applicant.lastName || ''}`.trim() || 'Unknown',
          email: app.applicant.email,
          phone: profile?.phone || 'Unknown',
          avatar: app.applicant.avatarUrl || (app.applicant.displayName || app.applicant.email).substring(0, 2).toUpperCase(),
          location: [profile?.city, profile?.state, profile?.country].filter(Boolean).join(', ') || 'Unknown',
          profileCompletion,
        },
        job: {
          title: app.job.title,
          employer: app.job.postedBy.displayName || `${app.job.postedBy.firstName || ''} ${app.job.postedBy.lastName || ''}`.trim() || 'Unknown',
          location: app.job.location || 'Remote',
          salary: app.job.salaryMin && app.job.salaryMax ? `$${app.job.salaryMin.toLocaleString()}-$${app.job.salaryMax.toLocaleString()}` : 'Salary not specified',
          type: app.job.employmentType || 'Full-time',
          postedDate: app.job.publishedAt?.toISOString().split('T')[0] || 'Unknown',
          status: app.job.status,
        },
        appliedDate: app.appliedAt.toISOString(),
        status: (
          app.status === 'pending' ? 'Under Review' :
          app.status === 'shortlisted' ? 'Shortlisted' :
          app.status === 'interview' ? 'Interview' :
          app.status === 'rejected' ? 'Rejected' :
          app.status === 'withdrawn' ? 'Withdrawn' :
          app.status === 'flagged' ? 'Flagged' :
          'Submitted'
        ),
        // No screening model behind this yet: it is profile completeness.
        screeningScore: profileCompletion,
        resume: !!app.resumeUrl,
        coverLetter: app.coverLetter || 'No cover letter provided',
        screeningQuestions: [],
        timeline: [{ event: 'Application submitted', date: app.appliedAt.toISOString() }],
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }
}
