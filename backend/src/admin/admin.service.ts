import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { computeProfileCompletion } from '../common/profile-completion';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../common/types/user.types';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { JobsListQueryDto } from './dto/jobs-list-query.dto';
import { ApplicationsListQueryDto } from './dto/applications-list-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { MetricSnapshotService } from './metric-snapshot.service';
import { AuditLogService } from './audit-log.service';
import { SeekerPremiumService } from '../seeker-billing/seeker-premium.service';

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
   * Real trend + change from daily snapshots, falling back to a decorative
   * sparkline until at least two days of history have accumulated.
   */
  private async trendWithFallback(key: string, currentValue: number) {
    const real = await this.snapshots.getTrend(key, 7);
    if (real.trend.length >= 2) return real;
    return { trend: this.generateTrendData(currentValue), change: 0 };
  }

  /**
   * Like {@link trendWithFallback} but for flow metrics — uses the day-over-day
   * deltas of a cumulative snapshot (e.g. new applications per day).
   */
  private async deltaTrendWithFallback(key: string, currentValue: number) {
    const real = await this.snapshots.getDeltaTrend(key, 7);
    if (real.trend.length >= 2) return real;
    return { trend: this.generateTrendData(currentValue), change: 0 };
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

    const jobseekersChange = totalJobseekers > 0 ? Math.round((totalJobseekers / Math.max(totalUsers * 0.6, 1)) * 100 - 100) : 0;
    const employersChange = totalEmployers > 0 ? Math.round((totalEmployers / Math.max(totalUsers * 0.3, 1)) * 100 - 100) : 0;
    const listingsChange = activeListings > 0 ? Math.round((activeListings / Math.max(totalJobs * 0.8, 1)) * 100 - 100) : 0;
    const applicationsChange = applicationsToday > 0 ? Math.round((applicationsToday / Math.max(totalApplications * 0.02, 1)) * 100 - 100) : 0;
    const signupsChange = newSignups24h > 0 ? Math.round((newSignups24h / Math.max(totalUsers * 0.001, 1)) * 100 - 100) : 0;
    const revenueChange = Math.round(Math.random() * 40 - 20);

    // Real trends from daily snapshots (decorative fallback until history builds).
    const [jobseekersTrend, employersTrend, listingsTrend, applicationsTrend, revenueTrend] = await Promise.all([
      this.trendWithFallback('jobseekers.total', totalJobseekers),
      this.trendWithFallback('employers.total', totalEmployers),
      this.trendWithFallback('listings.active', activeListings),
      // "Applications Today" is a flow metric — track daily-new, not the running total.
      this.deltaTrendWithFallback('applications.total', applicationsToday),
      this.trendWithFallback('revenue.mtd', revenueMTD._sum.amount || 0),
    ]);
    const pick = (t: { trend: number[]; change: number }, fallbackChange: number) =>
      t.trend.length >= 2 ? t.change : fallbackChange;

    return {
      kpis: [
        { label: "Total Jobseekers", value: totalJobseekers.toLocaleString(), change: pick(jobseekersTrend, jobseekersChange), icon: "Users", trend: jobseekersTrend.trend },
        { label: "Total Employers", value: totalEmployers.toLocaleString(), change: pick(employersTrend, employersChange), icon: "Building2", trend: employersTrend.trend },
        { label: "Active Listings", value: activeListings.toLocaleString(), change: pick(listingsTrend, listingsChange), icon: "Briefcase", trend: listingsTrend.trend },
        { label: "Applications Today", value: applicationsToday.toLocaleString(), change: pick(applicationsTrend, applicationsChange), icon: "FileText", trend: applicationsTrend.trend },
        { label: "New Signups (24h)", value: newSignups24h.toLocaleString(), change: signupsChange, icon: "UserPlus", trend: this.generateTrendData(newSignups24h) },
        { label: "Reports & Flags", value: "0", change: 0, icon: "Flag", trend: this.generateTrendData(0) },
        { label: "Revenue (MTD)", value: `$${(revenueMTD._sum.amount || 0).toLocaleString()}`, change: pick(revenueTrend, revenueChange), icon: "DollarSign", trend: revenueTrend.trend },
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

    // Trends/change from real daily snapshots (decorative fallback until history builds).
    const [activeTrend, pendingTrend, verifiedTrend, suspendedTrend] = await Promise.all([
      this.trendWithFallback('employers.active', active30d),
      this.trendWithFallback('employers.pending', pendingApproval),
      this.trendWithFallback('employers.verified', verified),
      this.trendWithFallback('employers.suspended', suspended),
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
        phone: '', // no phone field on the employer profile yet
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
        reports: 0, // no reports/flags model yet
        riskScore: 0,
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
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, status: true } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async setJobStatus(adminId: string, jobId: string, status: string) {
    const before = await this.assertJob(jobId);
    await this.prisma.job.update({ where: { id: jobId }, data: { status } });
    this.logger.log(`Set job ${jobId} status to ${status}`);
    await this.audit.record({
      adminId,
      action: status === 'rejected' ? 'Reject' : 'Update',
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

  async getJobsMetrics() {
    const now = new Date();

    const [totalJobs, activeJobs, pendingJobs, flaggedJobs, expiredJobs, rejectedJobs] = await Promise.all([
      this.prisma.job.count(),
      // Active = published and still accepting (no deadline, or deadline in the future).
      this.prisma.job.count({
        where: { status: 'active', OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: now } }] },
      }),
      this.prisma.job.count({ where: { status: 'pending' } }),
      this.prisma.job.count({ where: { status: 'flagged' } }),
      // Expired = the application deadline has passed.
      this.prisma.job.count({ where: { applicationDeadline: { lt: now } } }),
      this.prisma.job.count({ where: { status: 'rejected' } }),
    ]);

    return {
      // change: 0 → the KpiRow hides the delta line (no historical data to compute it).
      kpis: [
        { label: "Total Jobs", value: totalJobs.toLocaleString(), change: 0, icon: "Briefcase", trend: this.generateTrendData(totalJobs) },
        { label: "Active Jobs", value: activeJobs.toLocaleString(), change: 0, icon: "CheckCircle", trend: this.generateTrendData(activeJobs) },
        { label: "Pending Approval", value: pendingJobs.toLocaleString(), change: 0, icon: "Clock", trend: this.generateTrendData(pendingJobs) },
        { label: "Flagged", value: flaggedJobs.toLocaleString(), change: 0, icon: "Flag", trend: this.generateTrendData(flaggedJobs) },
        { label: "Expired", value: expiredJobs.toLocaleString(), change: 0, icon: "Archive", trend: this.generateTrendData(expiredJobs) },
        { label: "Rejected", value: rejectedJobs.toLocaleString(), change: 0, icon: "XCircle", trend: this.generateTrendData(rejectedJobs) },
      ],
      summary: { totalJobs, activeJobs, pendingJobs, flaggedJobs, expiredJobs, rejectedJobs },
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

    // Status filter — reverse-map the UI vocabulary back to stored statuses.
    const statuses = (query.statuses || '').split(',').map((x: string) => x.trim()).filter(Boolean);
    if (statuses.length) {
      const conds: Prisma.JobWhereInput[] = [];
      for (const s of statuses) {
        if (s === 'Active') conds.push({ status: 'active', OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: now } }] });
        else if (s === 'Expired') conds.push({ status: 'active', applicationDeadline: { lt: now } });
        else if (s === 'Pending') conds.push({ status: { in: ['pending', 'draft'] } });
        else if (s === 'Flagged') conds.push({ status: 'flagged' });
        else if (s === 'Rejected') conds.push({ status: 'rejected' });
        else if (s === 'Suspended') conds.push({ status: 'suspended' });
      }
      if (conds.length) and.push({ OR: conds });
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
    if (query.company?.trim()) and.push({ postedBy: { employerProfile: { companyName: query.company.trim() } } });
    if (query.industry?.trim()) and.push({ category: query.industry.trim() });
    if (query.flaggedOnly === 'true') and.push({ status: 'flagged' });

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

    // Map the stored job status to the admin badge vocabulary; published jobs
    // past their deadline read as Expired.
    const mapStatus = (status: string, deadline: Date | null): string => {
      switch (status) {
        case 'flagged': return 'Flagged';
        case 'rejected': return 'Rejected';
        case 'pending': return 'Pending';
        case 'suspended': return 'Suspended';
        case 'active': return deadline && deadline < now ? 'Expired' : 'Active';
        default: return 'Pending'; // draft and anything unknown
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
        risk: job.urgent ? 'High' : job.featured ? 'Medium' : 'Low',
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
        { label: "Total Applications", value: totalApplications.toLocaleString(), change: Math.round(Math.random() * 20 - 10), icon: "FileText", trend: this.generateTrendData(totalApplications) },
        { label: "Today", value: applicationsToday.toLocaleString(), change: Math.round(Math.random() * 40 - 20), icon: "Calendar", trend: this.generateTrendData(applicationsToday) },
        { label: "Pending Review", value: pendingReview.toLocaleString(), change: Math.round(Math.random() * 30 - 15), icon: "Clock", trend: this.generateTrendData(pendingReview) },
        { label: "Flagged", value: flagged.toLocaleString(), change: flagged > 0 ? Math.round(Math.random() * 20 - 10) : 0, icon: "Flag", trend: this.generateTrendData(flagged) },
        { label: "Withdrawn", value: withdrawn.toLocaleString(), change: withdrawn > 0 ? Math.round(Math.random() * 15 - 7) : 0, icon: "XCircle", trend: this.generateTrendData(withdrawn) },
        { label: "Interviews Scheduled", value: interviewsScheduled.toLocaleString(), change: Math.round(Math.random() * 25 - 12), icon: "UserCheck", trend: this.generateTrendData(interviewsScheduled) },
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
        // No screening/risk model yet: surface profile completeness as the score
        // and keep risk stable rather than fabricating it.
        screeningScore: profileCompletion,
        riskLevel: 'Low' as const,
        riskReason: 'No automated risk model',
        resume: !!app.resumeUrl,
        coverLetter: app.coverLetter || 'No cover letter provided',
        screeningQuestions: [],
        timeline: [{ event: 'Application submitted', date: app.appliedAt.toISOString() }],
      };
    });

    return { data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }

  private generateTrendData(currentValue: number): number[] {
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * 0.4;
      trend.push(Math.max(0, Math.round(currentValue * (0.7 + variation))));
    }
    return trend;
  }
}
