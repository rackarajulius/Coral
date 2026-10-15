import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { MatchScoreService } from '../applications/match-score.service';
import { isValidTimezone } from '../employer-hiring/outreach-timing';
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { AiService, ParsedResume } from '../services/ai/ai.service';
import { PROFILE_BUCKET, RESUME_BUCKET, StorageService } from '../storage/storage.service';
import { CreateCertificationDto, UpdateCertificationDto } from './dto/certification.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
import { CreatePortfolioItemDto, UpdatePortfolioItemDto } from './dto/portfolio.dto';
import { CreateRecommendationDto, UpdateRecommendationDto } from './dto/recommendation.dto';
import {
  GenerateInterviewPrepDto,
  InterviewPrepFeedbackDto,
  InterviewPrepSessionsQueryDto,
} from './dto/interview-prep.dto';
import { UpdateJobSeekerProfileDto } from './dto/update-job-seeker-profile.dto';
import { User } from '../common/types/user.types';
import { ProfileImpressionsService } from './profile-impressions.service';

@Injectable()
export class JobSeekersService {
  private readonly logger = new Logger(JobSeekersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
    private readonly companyContext: CompanyContextService,
    private readonly matchScores: MatchScoreService,
    private readonly impressions: ProfileImpressionsService,
  ) {}

  async getMyProfile(userId: string) {
    return this.getOrCreateProfile(userId, true);
  }

  /**
   * Read-only profile of another job seeker, for recruiters (and shared links).
   *
   * Privacy gates — the profile is served only when one of these holds:
   *  - the viewer is the owner or an admin;
   *  - the candidate is discoverable, unless they've also set
   *    privacySettings.profileVisible = false;
   *  - the candidate applied to one of the viewer's jobs (sharing implied).
   * Contact email is included only for the owner/admin/applied cases — never
   * for pure discovery (consent-first: outreach goes through the platform).
   */
  async getPublicProfile(targetUserId: string, actor: User) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: targetUserId },
      include: {
        user: { select: { displayName: true, firstName: true, lastName: true, avatarUrl: true } },
        experiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issueDate: 'desc' } },
        portfolioItems: { orderBy: { createdAt: 'desc' } },
        recommendations: { orderBy: { createdAt: 'desc' } },
      },
    });
    // 404 (not 403) on every denial so we don't leak whether a profile exists.
    const notAvailable = new NotFoundException('Profile not available');
    if (!profile) throw notAvailable;

    const isOwner = actor.id === targetUserId;
    const isAdmin = actor.role === 'ADMIN';
    const privacy = (profile.privacySettings ?? {}) as { profileVisible?: boolean };
    const hidden = privacy.profileVisible === false;

    let appliedToViewerJobs = false;
    if (!isOwner && !isAdmin) {
      // Consent runs to the company: applying to a job hands contact details to
      // the employer that posted it, and every colleague working that pipeline
      // sees the same application. Keeping this to the actor alone would show a
      // teammate a redacted profile for a candidate who had in fact applied.
      appliedToViewerJobs = !!(await this.prisma.application.findFirst({
        where: {
          applicantId: targetUserId,
          job: { postedById: { in: await this.companyContext.memberUserIds(actor.id) } },
        },
        select: { id: true },
      }));
      // `openToWork` used to stand in for this, which hid every passive
      // candidate's profile from the recruiter who had just found them.
      const discoverable = profile.discoverable && !hidden;
      if (!discoverable && !appliedToViewerJobs) throw notAvailable;
    }

    /**
      * Counted here, after every privacy gate above has passed.
      *
      * Recording earlier would count views of profiles the viewer was refused,
      * which would tell a candidate someone looked when nobody could. Owner
      * and admin traffic is dropped inside the service.
      */
    void this.impressions.record(actor, [targetUserId], 'view');

    const includeContact = isOwner || isAdmin || appliedToViewerJobs;
    const name =
      profile.user.displayName ||
      [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ') ||
      'Candidate';

    return {
      userId: targetUserId,
      name,
      headline: profile.headline,
      about: profile.summary,
      location: [profile.city, profile.country].filter(Boolean).join(', '),
      openToWork: profile.openToWork,
      avatarUrl: profile.avatarUrl || profile.user.avatarUrl,
      bannerUrl: profile.bannerUrl,
      introVideoUrl: profile.introVideoUrl,
      workEligibility: profile.workEligibility,
      workPermitExpiry: profile.workPermitExpiry,
      skills: profile.skills,
      languages: profile.languages,
      contactLinks: {
        email: includeContact ? profile.contactEmail : null,
        linkedin: profile.linkedinUrl,
        github: profile.githubUrl,
        website: profile.portfolioUrl,
        twitter: profile.twitterUrl,
      },
      experiences: profile.experiences.map((e) => ({
        id: e.id,
        title: e.title,
        company: e.company,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        verified: e.verified,
        // The weaker, truer claim, for roles where the domain proved out but
        // could not be tied to this employer by name.
        verifiedWorkDomain: e.verifiedWorkDomain,
        description: e.description,
      })),
      educations: profile.educations.map((e) => ({
        id: e.id,
        degree: e.degree,
        school: e.institution,
        fieldOfStudy: e.fieldOfStudy,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        gpa: e.gpa,
        honors: e.honors,
        description: e.description,
      })),
      certifications: profile.certifications.map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuingOrg,
        issueDate: c.issueDate,
        credentialUrl: c.credentialUrl,
      })),
      portfolioItems: profile.portfolioItems.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        link: p.projectUrl ?? p.videoUrl ?? p.imageUrl,
      })),
      recommendations: profile.recommendations.map((r) => ({
        id: r.id,
        text: r.text,
        author: r.author,
        authorTitle: r.authorTitle,
        date: r.date,
      })),
    };
  }

  async generateInterviewPrepSession(userId: string, dto: GenerateInterviewPrepDto) {
    const profile = await this.getOrCreateProfile(userId, true);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileSnapshot = this.buildInterviewProfileSnapshot({
      id: user.id,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }, profile);
    const questionCount = dto.questionCount ?? 8;
    const focusAreas = dto.focusAreas ? this.normalizeStringList(dto.focusAreas) : [];

    const generatedPlan = await this.aiService.generateInterviewPlan({
      targetRole: dto.targetRole,
      company: dto.company,
      interviewType: dto.interviewType,
      difficulty: dto.difficulty,
      focusAreas,
      questionCount,
      jobDescription: dto.jobDescription,
      profileSnapshot,
    });

    return this.prisma.interviewPrepSession.create({
      data: {
        userId,
        title: dto.title.trim(),
        targetRole: dto.targetRole.trim(),
        company: dto.company?.trim(),
        interviewType: dto.interviewType?.trim(),
        difficulty: dto.difficulty?.trim() || 'intermediate',
        jobDescription: dto.jobDescription?.trim(),
        focusAreas,
        questionCount,
        profileSnapshot: profileSnapshot as Prisma.InputJsonValue,
        generatedPlan: generatedPlan as unknown as Prisma.InputJsonValue,
      },
      include: {
        feedbacks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async listInterviewPrepSessions(userId: string, query: InterviewPrepSessionsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.interviewPrepSession.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          targetRole: true,
          company: true,
          interviewType: true,
          difficulty: true,
          focusAreas: true,
          questionCount: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              feedbacks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.interviewPrepSession.count({
        where: { userId },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getInterviewPrepSession(userId: string, sessionId: string) {
    const session = await this.prisma.interviewPrepSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        feedbacks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Interview prep session not found');
    }

    return session;
  }

  async evaluateInterviewAnswer(
    userId: string,
    sessionId: string,
    dto: InterviewPrepFeedbackDto,
  ) {
    const session = await this.prisma.interviewPrepSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        targetRole: true,
        profileSnapshot: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Interview prep session not found');
    }

    const question = dto.question.trim();
    const answer = dto.answer.trim();
    if (!question || !answer) {
      throw new BadRequestException('Both question and answer are required');
    }

    const feedback = await this.aiService.evaluateInterviewAnswer({
      targetRole: session.targetRole,
      question,
      answer,
      profileSnapshot: session.profileSnapshot as Record<string, unknown>,
    });

    const saved = await this.prisma.interviewPrepFeedback.create({
      data: {
        sessionId: session.id,
        userId,
        question,
        answer,
        score: feedback.score,
        feedback: feedback as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: saved.id,
      sessionId: saved.sessionId,
      score: saved.score,
      feedback,
      createdAt: saved.createdAt,
    };
  }

  /**
   * Stores the timezone the seeker's browser reports. Only a real IANA zone,
   * only when it changed, and never creates a profile just to hold it — a
   * seeker without one has nothing a recruiter could be approaching.
   */
  async setTimezone(userId: string, timezone: string) {
    const zone = timezone.trim();
    if (!isValidTimezone(zone)) return { timezone: null, updated: false };
    // Both branches: SQL's `<>` is never true against NULL, so a first report
    // would otherwise never be stored.
    const { count } = await this.prisma.jobSeekerProfile.updateMany({
      where: { userId, OR: [{ timezone: null }, { timezone: { not: zone } }] },
      data: { timezone: zone },
    });
    return { timezone: zone, updated: count > 0 };
  }

  async updateMyProfile(userId: string, dto: UpdateJobSeekerProfileDto) {
    const profile = await this.getOrCreateProfile(userId, false);

    // Editing skills changes every match score this candidate has. Deliberately
    // not awaited and never allowed to throw — a profile save must not fail
    // because a rescore did, and the nightly sweep catches anything missed.
    if (dto.skills !== undefined) {
      void this.matchScores
        .recomputeForCandidate(userId)
        .catch((err) => this.logger.warn(`Match rescore failed for ${userId}: ${err.message}`));
    }

    return this.prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: {
        ...dto,
        availableFrom:
          dto.availableFrom !== undefined
            ? this.parseDate(dto.availableFrom, 'availableFrom')
            : undefined,
        jobTypes: dto.jobTypes ? this.normalizeStringList(dto.jobTypes) : undefined,
        skills: dto.skills ? this.normalizeStringList(dto.skills) : undefined,
        // Kept in step with `skills` on every write. Search reads this one;
        // letting the two drift makes a profile quietly unfindable by a skill
        // it visibly lists.
        skillsNormalized: dto.skills
          ? this.normalizeStringList(dto.skills).map((s) => s.toLowerCase())
          : undefined,
        languages: dto.languages ? this.normalizeStringList(dto.languages) : undefined,
        preferredLocations: dto.preferredLocations
          ? this.normalizeStringList(dto.preferredLocations)
          : undefined,
        preferredIndustries: dto.preferredIndustries
          ? this.normalizeStringList(dto.preferredIndustries)
          : undefined,
        keywords: dto.keywords ? this.normalizeStringList(dto.keywords) : undefined,
        // JSON settings blobs — cast for Prisma's Json input type.
        notificationSettings:
          dto.notificationSettings as Prisma.InputJsonValue | undefined,
        privacySettings: dto.privacySettings as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async addExperience(userId: string, dto: CreateExperienceDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    this.assertCurrentWithoutEndDate(dto.current, dto.endDate, 'current', 'endDate');

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate =
      dto.current === true
        ? undefined
        : dto.endDate !== undefined
          ? this.parseDate(dto.endDate, 'endDate')
          : undefined;

    this.assertDateOrder(startDate, endDate, 'startDate', 'endDate');

    return this.prisma.experience.create({
      data: {
        profileId: profile.id,
        title: dto.title,
        company: dto.company,
        companyLogo: dto.companyLogo,
        location: dto.location,
        employmentType: dto.employmentType,
        startDate,
        endDate,
        current: dto.current ?? false,
        description: dto.description,
      },
    });
  }

  async updateExperience(userId: string, experienceId: string, dto: UpdateExperienceDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    const experience = await this.prisma.experience.findUnique({
      where: { id: experienceId },
    });

    if (!experience) {
      throw new NotFoundException('Experience not found');
    }

    if (experience.profileId !== profile.id) {
      throw new ForbiddenException('You can only update your own experience');
    }

    this.assertCurrentWithoutEndDate(dto.current, dto.endDate, 'current', 'endDate');
    const parsedStartDate =
      dto.startDate !== undefined ? this.parseDate(dto.startDate, 'startDate') : undefined;
    const parsedEndDate =
      dto.endDate !== undefined ? this.parseDate(dto.endDate, 'endDate') : undefined;

    const effectiveStartDate = parsedStartDate ?? experience.startDate;
    const effectiveEndDate = dto.current === true ? null : parsedEndDate ?? experience.endDate;

    this.assertDateOrder(effectiveStartDate, effectiveEndDate, 'startDate', 'endDate');

    // Renaming the employer invalidates whatever was proved about the old one:
    // verifying a work email at acme.com and then editing the row to say Google
    // would otherwise carry the badge across.
    const employerChanged =
      dto.company !== undefined && dto.company.trim() !== experience.company.trim();

    return this.prisma.experience.update({
      where: { id: experienceId },
      data: {
        ...dto,
        startDate: parsedStartDate,
        endDate: dto.current === true ? null : parsedEndDate,
        ...(employerChanged ? { verified: false, verifiedWorkDomain: null } : {}),
      },
    });
  }

  async deleteExperience(userId: string, experienceId: string) {
    const profile = await this.getOrCreateProfile(userId, false);
    const experience = await this.prisma.experience.findUnique({
      where: { id: experienceId },
    });

    if (!experience) {
      throw new NotFoundException('Experience not found');
    }

    if (experience.profileId !== profile.id) {
      throw new ForbiddenException('You can only delete your own experience');
    }

    await this.prisma.experience.delete({
      where: { id: experienceId },
    });

    // Verification rows point at the experience by id but aren't a relation, so
    // nothing cascades. Left alone they become records of a role that no longer
    // exists — visible in the seeker's own list and in the admin review queue.
    await this.prisma.verification.deleteMany({
      where: { userId, type: 'EXPERIENCE', targetId: experienceId },
    });
  }

  async addEducation(userId: string, dto: CreateEducationDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    this.assertCurrentWithoutEndDate(dto.current, dto.endDate, 'current', 'endDate');

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate =
      dto.current === true
        ? undefined
        : dto.endDate !== undefined
          ? this.parseDate(dto.endDate, 'endDate')
          : undefined;

    this.assertDateOrder(startDate, endDate, 'startDate', 'endDate');

    return this.prisma.education.create({
      data: {
        profileId: profile.id,
        institution: dto.institution,
        institutionLogo: dto.institutionLogo,
        degree: dto.degree,
        fieldOfStudy: dto.fieldOfStudy,
        location: dto.location,
        gpa: dto.gpa,
        honors: dto.honors,
        startDate,
        endDate,
        current: dto.current ?? false,
        description: dto.description,
      },
    });
  }

  async updateEducation(userId: string, educationId: string, dto: UpdateEducationDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    const education = await this.prisma.education.findUnique({
      where: { id: educationId },
    });

    if (!education) {
      throw new NotFoundException('Education not found');
    }

    if (education.profileId !== profile.id) {
      throw new ForbiddenException('You can only update your own education');
    }

    this.assertCurrentWithoutEndDate(dto.current, dto.endDate, 'current', 'endDate');
    const parsedStartDate =
      dto.startDate !== undefined ? this.parseDate(dto.startDate, 'startDate') : undefined;
    const parsedEndDate =
      dto.endDate !== undefined ? this.parseDate(dto.endDate, 'endDate') : undefined;

    const effectiveStartDate = parsedStartDate ?? education.startDate;
    const effectiveEndDate = dto.current === true ? null : parsedEndDate ?? education.endDate;

    this.assertDateOrder(effectiveStartDate, effectiveEndDate, 'startDate', 'endDate');

    return this.prisma.education.update({
      where: { id: educationId },
      data: {
        ...dto,
        startDate: parsedStartDate,
        endDate: dto.current === true ? null : parsedEndDate,
      },
    });
  }

  async deleteEducation(userId: string, educationId: string) {
    const profile = await this.getOrCreateProfile(userId, false);
    const education = await this.prisma.education.findUnique({
      where: { id: educationId },
    });

    if (!education) {
      throw new NotFoundException('Education not found');
    }

    if (education.profileId !== profile.id) {
      throw new ForbiddenException('You can only delete your own education');
    }

    await this.prisma.education.delete({
      where: { id: educationId },
    });

    // Same as experiences: nothing cascades from a targetId.
    await this.prisma.verification.deleteMany({
      where: { userId, type: 'EDUCATION', targetId: educationId },
    });
  }

  async addCertification(userId: string, dto: CreateCertificationDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    this.assertCurrentWithoutEndDate(dto.noExpiration, dto.expirationDate, 'noExpiration', 'expirationDate');

    const issueDate = this.parseDate(dto.issueDate, 'issueDate');
    const expirationDate =
      dto.noExpiration === true
        ? undefined
        : dto.expirationDate !== undefined
          ? this.parseDate(dto.expirationDate, 'expirationDate')
          : undefined;

    this.assertDateOrder(issueDate, expirationDate, 'issueDate', 'expirationDate');

    return this.prisma.certification.create({
      data: {
        profileId: profile.id,
        name: dto.name,
        issuingOrg: dto.issuingOrg,
        issuingOrgLogo: dto.issuingOrgLogo,
        issueDate,
        expirationDate,
        noExpiration: dto.noExpiration ?? false,
        credentialId: dto.credentialId,
        credentialUrl: dto.credentialUrl,
      },
    });
  }

  async updateCertification(
    userId: string,
    certificationId: string,
    dto: UpdateCertificationDto,
  ) {
    const profile = await this.getOrCreateProfile(userId, false);
    const certification = await this.prisma.certification.findUnique({
      where: { id: certificationId },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    if (certification.profileId !== profile.id) {
      throw new ForbiddenException('You can only update your own certification');
    }

    this.assertCurrentWithoutEndDate(dto.noExpiration, dto.expirationDate, 'noExpiration', 'expirationDate');
    const parsedIssueDate =
      dto.issueDate !== undefined ? this.parseDate(dto.issueDate, 'issueDate') : undefined;
    const parsedExpirationDate =
      dto.expirationDate !== undefined
        ? this.parseDate(dto.expirationDate, 'expirationDate')
        : undefined;

    const effectiveIssueDate = parsedIssueDate ?? certification.issueDate;
    const effectiveExpirationDate =
      dto.noExpiration === true ? null : parsedExpirationDate ?? certification.expirationDate;

    this.assertDateOrder(effectiveIssueDate, effectiveExpirationDate, 'issueDate', 'expirationDate');

    return this.prisma.certification.update({
      where: { id: certificationId },
      data: {
        ...dto,
        issueDate: parsedIssueDate,
        expirationDate: dto.noExpiration === true ? null : parsedExpirationDate,
      },
    });
  }

  async deleteCertification(userId: string, certificationId: string) {
    const profile = await this.getOrCreateProfile(userId, false);
    const certification = await this.prisma.certification.findUnique({
      where: { id: certificationId },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    if (certification.profileId !== profile.id) {
      throw new ForbiddenException('You can only delete your own certification');
    }

    await this.prisma.certification.delete({
      where: { id: certificationId },
    });
  }

  async addSkills(userId: string, skills: string[]) {
    const profile = await this.getOrCreateProfile(userId, false);
    const normalizedSkills = this.normalizeStringList(skills);

    if (normalizedSkills.length === 0) {
      throw new BadRequestException('Provide at least one valid skill');
    }

    const nextSkills = this.mergeDistinctSkills(profile.skills || [], normalizedSkills);

    return this.prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: {
        skills: nextSkills,
      },
    });
  }

  async removeSkill(userId: string, skillIdentifier: string) {
    const profile = await this.getOrCreateProfile(userId, false);
    const target = skillIdentifier.trim().toLowerCase();

    if (!target) {
      throw new BadRequestException('Skill identifier is required');
    }

    const currentSkills = profile.skills || [];
    const nextSkills = currentSkills.filter(
      (skill) => skill.trim().toLowerCase() !== target,
    );

    if (nextSkills.length === currentSkills.length) {
      throw new NotFoundException('Skill not found on profile');
    }

    return this.prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: {
        skills: nextSkills,
      },
    });
  }

  // --- Resume parsing (stateless: extract text + AI parse, no storage) ---

  async parseResume(file: Express.Multer.File, userId?: string): Promise<ParsedResume> {
    const text = await this.extractResumeText(file);
    if (!text.trim()) {
      throw new BadRequestException(
        'Could not read any text from this file. Please upload a PDF, Word document, or text file.',
      );
    }
    /**
     * Reading the file is the bonus; keeping it is the request.
     *
     * When the AI is unavailable the upload used to fail outright and nothing
     * was stored — the user had asked us to hold their resume and we answered
     * "500 Internal server error" and kept nothing. Now the file is saved
     * either way, and only the extraction is reported as unavailable.
     */
    let parsed: ParsedResume;
    try {
      parsed = await this.aiService.parseResume(text);
    } catch (err) {
      if (userId) {
        await this.storeResumeFile(userId, file);
        // No summary can describe this file, and a stale one from the previous
        // file would be worse than none — it would be attributed to this upload.
        await this.prisma.jobSeekerProfile
          .updateMany({ where: { userId }, data: { parsedResume: Prisma.DbNull } })
          .catch(() => undefined);
      }
      this.logger.warn(
        `Resume stored but not parsed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new ServiceUnavailableException(
        'Your resume was saved, but we could not read it just now — that service is temporarily unavailable. Use Replace in a few minutes to fill in your details from it.',
      );
    }

    /**
     * Keep the file + a summary so other flows (applications, the interview
     * coach) can reuse them.
     *
     * Awaited, not fired and forgotten. Both of these write to the profile row,
     * and letting them land after the response created a race with deletion: a
     * user who uploaded and then removed a resume could have it resurrected a
     * moment later by the tail of their own upload, leaving the profile
     * pointing at a file they believed was gone. A deletion that does not stay
     * deleted is worth the few hundred milliseconds this costs.
     *
     * Still best-effort — each swallows and logs its own failure, so a storage
     * outage cannot fail a parse that otherwise succeeded.
     */
    if (userId) {
      await this.saveParsedResumeSummary(userId, file.originalname, parsed);
      await this.storeResumeFile(userId, file);
    }
    return parsed;
  }

  /**
   * Stores the resume in the PRIVATE `resumes` bucket and records its path on
   * the profile. Only the path is persisted — reads always go through a
   * short-lived signed URL, so the file is never publicly addressable.
   */
  private async storeResumeFile(userId: string, file: Express.Multer.File): Promise<void> {
    try {
      const safe = (file.originalname || 'resume').replace(/[^\w.\-]+/g, '_').slice(0, 80);
      const path = `resumes/${userId}/${randomUUID()}-${safe}`;

      const existing = await this.prisma.jobSeekerProfile.findUnique({
        where: { userId },
        select: { resumePath: true },
      });

      await this.storageService.uploadPrivateFile(path, file.buffer, file.mimetype, RESUME_BUCKET);
      await this.prisma.jobSeekerProfile.updateMany({
        where: { userId },
        data: {
          resumePath: path,
          resumeFileName: file.originalname,
          resumeUploadedAt: new Date(),
        },
      });

      // Replace, don't accumulate — the previous file is no longer reachable.
      if (existing?.resumePath && existing.resumePath !== path) {
        await this.storageService.deletePublicFile(existing.resumePath, RESUME_BUCKET);
      }
    } catch (err) {
      this.logger.warn(
        `Could not store resume file: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Uploads a resume for a single application WITHOUT changing the profile
   * default — a candidate may have a version tailored to one role. Returns the
   * storage path, which `createApplication` re-validates as theirs.
   */
  async uploadResumeForApplication(userId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('No file received.');

    const safe = (file.originalname || 'resume').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const path = `resumes/${userId}/${randomUUID()}-${safe}`;
    await this.storageService.uploadPrivateFile(path, file.buffer, file.mimetype, RESUME_BUCKET);

    const url = await this.storageService
      .createSignedUrl(path, RESUME_BUCKET, 300)
      .catch(() => null);

    return { path, fileName: file.originalname, url };
  }

  /** Owner's resume metadata + a short-lived signed download URL. */
  async getMyResume(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { resumePath: true, resumeFileName: true, resumeUploadedAt: true },
    });
    if (!profile?.resumePath) return null;

    const url = await this.storageService
      .createSignedUrl(profile.resumePath, RESUME_BUCKET, 300)
      .catch(() => null);

    return {
      fileName: profile.resumeFileName,
      uploadedAt: profile.resumeUploadedAt,
      url,
    };
  }

  /** Removes the stored resume file and clears it from the profile. */
  async deleteMyResume(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { resumePath: true },
    });
    if (profile?.resumePath) {
      await this.storageService.deletePublicFile(profile.resumePath, RESUME_BUCKET);
    }
    await this.prisma.jobSeekerProfile.updateMany({
      where: { userId },
      // The parsed summary goes with the file. Keeping it meant the interview
      // coach still prefilled "from your last upload" after the upload had
      // been deleted — the user had removed it, and we were still using it.
      data: {
        resumePath: null,
        resumeFileName: null,
        resumeUploadedAt: null,
        parsedResume: Prisma.DbNull,
      },
    });
    return { removed: true };
  }

  /** Stores the reusable bits of a parsed resume on the profile (not the file). */
  private async saveParsedResumeSummary(
    userId: string,
    fileName: string,
    parsed: ParsedResume,
  ): Promise<void> {
    try {
      const roles = (parsed.experiences ?? [])
        .map((e) => [e.title, e.company].filter(Boolean).join(' · '))
        .filter(Boolean)
        .slice(0, 5);

      const years = (parsed.experiences ?? [])
        .flatMap((e) => (e.period ?? '').match(/(19|20)\d{2}/g) ?? [])
        .map(Number)
        .filter((y) => y > 1950 && y <= new Date().getFullYear());
      const experienceYears = years.length ? Math.max(0, new Date().getFullYear() - Math.min(...years)) : 0;

      await this.prisma.jobSeekerProfile.updateMany({
        where: { userId },
        data: {
          parsedResume: {
            fileName,
            skills: (parsed.skills ?? []).slice(0, 40),
            roles,
            experienceYears,
            parsedAt: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `Could not store parsed resume summary: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async extractResumeText(file: Express.Multer.File): Promise<string> {
    const mime = file.mimetype;
    if (mime === 'application/pdf') {
      const data = await pdfParse(file.buffer);
      return data.text || '';
    }
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value || '';
    }
    if (mime === 'text/plain') {
      return file.buffer.toString('utf-8');
    }
    return '';
  }

  // --- Profile media (Supabase Storage) ---

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    return this.uploadProfileMedia(userId, file, 'avatars', 'avatarUrl');
  }

  async uploadBanner(userId: string, file: Express.Multer.File) {
    return this.uploadProfileMedia(userId, file, 'banners', 'bannerUrl');
  }

  async uploadIntroVideo(userId: string, file: Express.Multer.File) {
    return this.uploadProfileMedia(userId, file, 'intro-videos', 'introVideoUrl');
  }

  async deleteAvatar(userId: string) {
    return this.deleteProfileMedia(userId, 'avatarUrl');
  }

  async deleteBanner(userId: string) {
    return this.deleteProfileMedia(userId, 'bannerUrl');
  }

  private async deleteProfileMedia(userId: string, field: 'avatarUrl' | 'bannerUrl') {
    const profile = await this.getOrCreateProfile(userId, false);
    if (field === 'avatarUrl') {
      // Removing the photo removes it everywhere. Before, the sign-in photo
      // on the account stayed behind and the profile went straight back to it.
      const accountPhoto = await this.accountPhoto(userId);
      const updated = await this.setAvatar(userId, profile.id, null);
      await this.deleteOwnAvatarFiles(userId, [profile.avatarUrl, accountPhoto]);
      return updated;
    }

    const oldPath = this.storageService.pathFromPublicUrl(profile[field], PROFILE_BUCKET);

    const updated = await this.prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: { [field]: null },
    });

    if (oldPath) {
      await this.storageService.deletePublicFile(oldPath, PROFILE_BUCKET);
    }

    return updated;
  }

  /**
   * The profile photo is also the account photo.
   *
   * Posts, comments, chat, the team list and every other page read the
   * account's photo, not the job-seeker profile's. Kept apart, an uploaded
   * photo showed on the profile and nowhere else.
   */
  private setAvatar(userId: string, profileId: string, url: string | null) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { avatarUrl: url } });
      return tx.jobSeekerProfile.update({ where: { id: profileId }, data: { avatarUrl: url } });
    });
  }

  private async accountPhoto(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    return user?.avatarUrl ?? null;
  }

  /**
   * Deletes replaced photos, but only this person's own files. The account
   * photo can be set to any address, so one naming someone else's file in
   * our bucket must not get that file deleted.
   */
  private async deleteOwnAvatarFiles(userId: string, urls: Array<string | null>) {
    const paths = new Set(
      urls
        .map((url) => this.storageService.pathFromPublicUrl(url, PROFILE_BUCKET))
        .filter((path): path is string => !!path && path.startsWith(`avatars/${userId}-`)),
    );
    for (const path of paths) await this.storageService.deletePublicFile(path, PROFILE_BUCKET);
  }

  private async uploadProfileMedia(
    userId: string,
    file: Express.Multer.File,
    folder: 'avatars' | 'banners' | 'intro-videos',
    field: 'avatarUrl' | 'bannerUrl' | 'introVideoUrl',
  ) {
    const profile = await this.getOrCreateProfile(userId, false);
    const ext = (file.mimetype.split('/')[1] || 'bin').replace('quicktime', 'mov');
    const path = `${folder}/${userId}-${Date.now()}.${ext}`;

    const publicUrl = await this.storageService.uploadPublicFile(
      path,
      file.buffer,
      file.mimetype,
      PROFILE_BUCKET,
    );
    if (field === 'avatarUrl') {
      const accountPhoto = await this.accountPhoto(userId);
      const updated = await this.setAvatar(userId, profile.id, publicUrl);
      await this.deleteOwnAvatarFiles(userId, [profile.avatarUrl, accountPhoto]);
      return updated;
    }

    const oldPath = this.storageService.pathFromPublicUrl(profile[field], PROFILE_BUCKET);

    const updated = await this.prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: { [field]: publicUrl },
    });

    if (oldPath) {
      await this.storageService.deletePublicFile(oldPath, PROFILE_BUCKET);
    }

    return updated;
  }

  // --- Portfolio ---

  /**
   * An image for one Featured item.
   *
   * The same public profile bucket the avatar and banner use. The picture used
   * to be base64-encoded into the item row: megabytes of text in every profile
   * response, and anything over about 1.5 MB was refused outright by the
   * request size limit while the form promised 5 MB.
   */
  async uploadPortfolioImage(userId: string, file: Express.Multer.File): Promise<string> {
    await this.getOrCreateProfile(userId, false);
    const ext = (file.mimetype.split('/')[1] || 'bin');
    const path = `portfolio/${userId}-${Date.now()}.${ext}`;
    return this.storageService.uploadPublicFile(path, file.buffer, file.mimetype, PROFILE_BUCKET);
  }

  /** Removes an item's image from storage once nothing points at it. */
  private async dropPortfolioImage(imageUrl: string | null): Promise<void> {
    const path = this.storageService.pathFromPublicUrl(imageUrl, PROFILE_BUCKET);
    if (path) await this.storageService.deletePublicFile(path, PROFILE_BUCKET);
  }

  async addPortfolioItem(userId: string, dto: CreatePortfolioItemDto) {
    const profile = await this.getOrCreateProfile(userId, false);

    return this.prisma.portfolioItem.create({
      data: {
        profileId: profile.id,
        title: dto.title,
        mediaType: dto.mediaType,
        description: dto.description,
        projectUrl: dto.projectUrl,
        imageUrl: dto.imageUrl,
        videoUrl: dto.videoUrl,
      },
    });
  }

  async updatePortfolioItem(userId: string, itemId: string, dto: UpdatePortfolioItemDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    const item = await this.prisma.portfolioItem.findUnique({ where: { id: itemId } });

    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }
    if (item.profileId !== profile.id) {
      throw new ForbiddenException('You can only update your own portfolio item');
    }

    const updated = await this.prisma.portfolioItem.update({
      where: { id: itemId },
      data: { ...dto },
    });

    // A replaced picture is nobody's any more.
    if (dto.imageUrl !== undefined && dto.imageUrl !== item.imageUrl) {
      await this.dropPortfolioImage(item.imageUrl);
    }
    return updated;
  }

  async deletePortfolioItem(userId: string, itemId: string) {
    const profile = await this.getOrCreateProfile(userId, false);
    const item = await this.prisma.portfolioItem.findUnique({ where: { id: itemId } });

    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }
    if (item.profileId !== profile.id) {
      throw new ForbiddenException('You can only delete your own portfolio item');
    }

    await this.prisma.portfolioItem.delete({ where: { id: itemId } });
    await this.dropPortfolioImage(item.imageUrl);
  }

  // --- Recommendations ---

  async addRecommendation(userId: string, dto: CreateRecommendationDto) {
    const profile = await this.getOrCreateProfile(userId, false);

    return this.prisma.recommendation.create({
      data: {
        profileId: profile.id,
        author: dto.author,
        authorTitle: dto.authorTitle,
        relationship: dto.relationship,
        text: dto.text,
        date: dto.date,
      },
    });
  }

  async updateRecommendation(userId: string, recommendationId: string, dto: UpdateRecommendationDto) {
    const profile = await this.getOrCreateProfile(userId, false);
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new NotFoundException('Recommendation not found');
    }
    if (recommendation.profileId !== profile.id) {
      throw new ForbiddenException('You can only update your own recommendation');
    }

    return this.prisma.recommendation.update({
      where: { id: recommendationId },
      data: { ...dto },
    });
  }

  async deleteRecommendation(userId: string, recommendationId: string) {
    const profile = await this.getOrCreateProfile(userId, false);
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new NotFoundException('Recommendation not found');
    }
    if (recommendation.profileId !== profile.id) {
      throw new ForbiddenException('You can only delete your own recommendation');
    }

    await this.prisma.recommendation.delete({ where: { id: recommendationId } });
  }

  private async getOrCreateProfile(userId: string, includeRelations: boolean) {
    const baseQuery = {
      where: { userId },
    };

    const include = includeRelations
      ? {
          experiences: {
            orderBy: { startDate: 'desc' as const },
          },
          educations: {
            orderBy: { startDate: 'desc' as const },
          },
          certifications: {
            orderBy: { issueDate: 'desc' as const },
          },
          portfolioItems: {
            orderBy: { createdAt: 'desc' as const },
          },
          recommendations: {
            orderBy: { createdAt: 'desc' as const },
          },
        }
      : undefined;

    let profile = await this.prisma.jobSeekerProfile.findUnique({
      ...baseQuery,
      include,
    });

    if (!profile) {
      profile = await this.prisma.jobSeekerProfile.create({
        data: {
          userId,
          jobTypes: [],
          skills: [],
          languages: [],
        },
        include,
      });
    }

    return profile;
  }

  private parseDate(dateString: string, fieldName: string): Date {
    const parsedDate = new Date(dateString);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsedDate;
  }

  private assertCurrentWithoutEndDate(
    currentFlag: boolean | undefined,
    endDate: string | undefined,
    currentFieldName: string,
    endDateFieldName: string,
  ) {
    if (currentFlag && endDate !== undefined) {
      throw new BadRequestException(
        `${endDateFieldName} cannot be provided when ${currentFieldName} is true`,
      );
    }
  }

  private assertDateOrder(
    startDate: Date | undefined | null,
    endDate: Date | undefined | null,
    startFieldName: string,
    endFieldName: string,
  ) {
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(`${endFieldName} cannot be before ${startFieldName}`);
    }
  }

  private normalizeStringList(values: string[]): string[] {
    const seen = new Set<string>();
    const normalizedValues: string[] = [];

    for (const value of values) {
      const normalized = value.trim().replace(/\s+/g, ' ');
      const key = normalized.toLowerCase();

      if (!normalized || seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalizedValues.push(normalized);
    }

    return normalizedValues;
  }

  private mergeDistinctSkills(existingSkills: string[], incomingSkills: string[]): string[] {
    return this.normalizeStringList([...existingSkills, ...incomingSkills]);
  }

  async suggestHeadlines(userId: string, targetRole?: string) {
    const profile = await this.getOrCreateProfile(userId, true);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, firstName: true, lastName: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileSnapshot = this.buildInterviewProfileSnapshot(
      {
        id: user.id,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      profile,
    );

    return this.aiService.suggestHeadlines({
      profileSnapshot,
      targetRole: targetRole?.trim() || undefined,
    });
  }

  async analyzeRoleReadiness(userId: string, targetRole: string) {
    const profile = await this.getOrCreateProfile(userId, true);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, firstName: true, lastName: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileSnapshot = this.buildInterviewProfileSnapshot(
      {
        id: user.id,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      profile,
    );

    return this.aiService.analyzeRoleReadiness({
      profileSnapshot,
      targetRole: targetRole.trim(),
    });
  }

  private buildInterviewProfileSnapshot(user: { id: string; displayName: string | null; firstName: string | null; lastName: string | null; role: any }, profile: any): Record<string, unknown> {
    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      headline: profile.headline,
      summary: profile.summary,
      currentTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      industry: profile.industry,
      location: {
        country: profile.country,
        state: profile.state,
        city: profile.city,
      },
      remotePreference: profile.remotePreference,
      experienceLevel: profile.experienceLevel,
      salaryExpectation: profile.salaryExpectation,
      skills: (profile.skills || []).slice(0, 30),
      languages: (profile.languages || []).slice(0, 15),
      experiences: (profile.experiences || []).slice(0, 8).map((experience: any) => ({
        title: experience.title,
        company: experience.company,
        startDate: experience.startDate,
        endDate: experience.endDate,
        current: experience.current,
        description: experience.description,
      })),
      educations: (profile.educations || []).slice(0, 5).map((education: any) => ({
        institution: education.institution,
        degree: education.degree,
        fieldOfStudy: education.fieldOfStudy,
        startDate: education.startDate,
        endDate: education.endDate,
        current: education.current,
      })),
      certifications: (profile.certifications || []).slice(0, 8).map((certification: any) => ({
        name: certification.name,
        issuingOrg: certification.issuingOrg,
        issueDate: certification.issueDate,
      })),
    };
  }
}
