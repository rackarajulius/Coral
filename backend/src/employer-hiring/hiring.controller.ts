import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CandidateSourcingService } from './candidate-sourcing.service';
import { OutreachService } from './outreach.service';
import { InterviewService } from './interview.service';
import { AiScreenService } from './ai-screen.service';
import { AvailabilityService } from './availability.service';
import { CopilotService } from './copilot.service';
import { CopilotDto } from './dto/copilot.dto';
import { RoleProfileDto } from './dto/role-profile.dto';
import { ShortlistService } from './shortlist.service';
import {
  CreateProjectDto,
  MoveItemToProjectDto,
  MoveShortlistItemDto,
  OpenShortlistDto,
  UpdateShortlistDto,
  UpsertShortlistItemDto,
} from './dto/shortlist.dto';
import { AiService } from '../services/ai/ai.service';
import { BillingService } from '../billing/billing.service';
import { EmployerVerificationService } from '../employers/employer-verification.service';
import { SourceCandidatesDto } from './dto/source-candidates.dto';
import { DraftOutreachDto } from './dto/draft-outreach.dto';
import { SendOutreachDto } from './dto/send-outreach.dto';
import { OutreachFromTemplateDto } from './dto/outreach-from-template.dto';
import { RespondOutreachDto } from './dto/respond-outreach.dto';
import { ProposeInterviewDto } from './dto/propose-interview.dto';
import { RespondInterviewDto } from './dto/respond-interview.dto';
import { SubmitScorecardDto } from './dto/submit-scorecard.dto';
import { InviteScreenDto } from './dto/invite-screen.dto';
import { GenerateJobQuestionsDto, InviteScreenBatchDto } from './dto/job-screening.dto';
import { RequestAccommodationsDto } from './dto/accommodations.dto';
import { SubmitScreenDto } from './dto/submit-screen.dto';
import { AddSlotsDto } from './dto/add-slots.dto';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';
import { ProfileImpressionsService } from '../job-seekers/profile-impressions.service';

@Controller('employers/hiring')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class HiringController {
  constructor(
    private readonly sourcing: CandidateSourcingService,
    private readonly outreach: OutreachService,
    private readonly interviews: InterviewService,
    private readonly screens: AiScreenService,
    private readonly copilot: CopilotService,
    private readonly ai: AiService,
    private readonly shortlists: ShortlistService,
    private readonly verification: EmployerVerificationService,
    private readonly billing: BillingService,
    private readonly impressions: ProfileImpressionsService,
  ) {}

  /** Sources & AI-ranks candidates from the opt-in talent pool for a role. */
  @Post('candidates')
  async candidates(@CurrentUser() user: User, @Body() dto: SourceCandidatesDto) {
    const data = await this.sourcing.source(dto);
    // Everyone who came back was actually shown to an employer, which is what
    // "search appearance" means on their profile. Deduped per viewer per day,
    // so re-running the same search all afternoon counts once.
    void this.impressions.record(user, data.candidates.map((c) => c.id), 'search');
    // Counted after it succeeds, so a vendor outage is not billed as usage.
    void this.billing.record(user.id, 'ai.search');
    return { success: true, data };
  }

  /** Copilot: turns a NL chat message into a grounded reply + next action. */
  @Post('copilot')
  async copilotRespond(@CurrentUser() user: User, @Body() dto: CopilotDto) {
    const data = await this.copilot.respond(dto);
    void this.billing.record(user.id, 'ai.assist');
    return { success: true, data };
  }

  /** Turns a free-text hiring prompt into a structured role profile (intent + quals + JD). */
  @Post('role-profile')
  async roleProfile(@CurrentUser() user: User, @Body() dto: RoleProfileDto) {
    const data = await this.ai.generateRoleProfile(dto.prompt);
    void this.billing.record(user.id, 'ai.search');
    return { success: true, data };
  }

  /**
   * Past sourcing sessions for the company, pinned first. Readable by anyone
   * who can see candidates — it is a list of work, not a list of people.
   */
  @Get('shortlists')
  async listShortlists(@CurrentUser() user: User) {
    return { success: true, data: await this.shortlists.list(user) };
  }

  /**
   * The project a search already feeds, or null. Creates nothing.
   *
   * Declared above `shortlists/:id` on purpose — a literal segment has to come
   * first, or Nest matches "for-query" as an id and the UUID pipe rejects it.
   */
  @Get('shortlists/for-query')
  async findShortlistForQuery(@CurrentUser() user: User, @Query('q') q?: string) {
    return { success: true, data: await this.shortlists.find(user, q ?? '') };
  }

  /** Reopens a stored session by id, restoring its pipeline. */
  @Get('shortlists/:id')
  async getShortlist(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.shortlists.getById(user, id) };
  }

  /** Pin or rename a session. */
  @RequiresCapability('candidates:write')
  @Patch('shortlists/:id')
  async updateShortlist(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShortlistDto,
  ) {
    return { success: true, data: await this.shortlists.update(user, id, dto) };
  }

  @RequiresCapability('candidates:write')
  @Delete('shortlists/:id')
  async removeShortlist(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.shortlists.remove(user, id) };
  }

  /** Opens (or creates) the persistent shortlist for a search, with its items. */
  /**
   * Creates a named project with no search behind it.
   *
   * Every route that changes a project or a candidate's place in one needs
   * `candidates:write`: the guard lets through any route that names no
   * capability, so these were open to Viewer and Interviewer seats — and a
   * stage move travels to a linked application, which the candidate sees.
   */
  @RequiresCapability('candidates:write')
  @Post('projects')
  async createProject(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return { success: true, data: await this.shortlists.createProject(user, dto.name) };
  }

  @RequiresCapability('candidates:write')
  @Post('shortlists')
  async openShortlist(@CurrentUser() user: User, @Body() dto: OpenShortlistDto) {
    return { success: true, data: await this.shortlists.open(user, dto) };
  }

  /** Upserts one shortlist item — add to pipeline, move stage, or save/unsave. */
  @RequiresCapability('candidates:write')
  @Put('shortlists/:id/items/:candidateId')
  async upsertShortlistItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: UpsertShortlistItemDto,
  ) {
    return { success: true, data: await this.shortlists.upsertItem(user, id, candidateId, dto) };
  }

  /**
   * Moves a sourced candidate by their card's id.
   *
   * The merged candidate board knows a row's own id, not which saved search it
   * came from, so it cannot use the route above. Same rules underneath: the
   * move is announced to whoever is working this candidate, and a linked
   * application moves with it.
   */
  /**
   * Gathers a candidate into another project.
   *
   * Three searches for one job leave people scattered across three
   * containers; this is how a recruiter pulls them together without losing
   * anyone's stage.
   */
  @RequiresCapability('candidates:write')
  @Patch('shortlist-items/:itemId/project')
  async moveItemToProject(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: MoveItemToProjectDto,
  ) {
    return {
      success: true,
      data: await this.shortlists.moveItemToProject(user, itemId, dto.shortlistId),
    };
  }

  @RequiresCapability('candidates:write')
  @Patch('shortlist-items/:itemId/stage')
  async moveShortlistItem(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: MoveShortlistItemDto,
  ) {
    return { success: true, data: await this.shortlists.moveItemById(user, itemId, dto.stage) };
  }

  @RequiresCapability('candidates:write')
  @Delete('shortlists/:id/items/:candidateId')
  async removeShortlistItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
  ) {
    return { success: true, data: await this.shortlists.removeItem(user, id, candidateId) };
  }

  /** AI-drafts an editable outreach message for a candidate. */
  @Post('outreach/draft')
  async draftOutreach(@CurrentUser() user: User, @Body() dto: DraftOutreachDto) {
    const data = await this.outreach.draft(user, dto);
    void this.billing.record(user.id, 'ai.assist');
    return { success: true, data };
  }

  /**
   * One of the company's saved templates, filled in for this candidate. Costs
   * no AI call. Like the AI draft it saves nothing — sending needs messaging:write.
   */
  @Post('outreach/from-template')
  async outreachFromTemplate(@CurrentUser() user: User, @Body() dto: OutreachFromTemplateDto) {
    return { success: true, data: await this.outreach.fromTemplate(user, dto) };
  }

  /** Sends the (edited) outreach via notification + email (consent-gated). */
  @RequiresCapability('messaging:write')
  @Post('outreach/send')
  async sendOutreach(@CurrentUser() user: User, @Body() dto: SendOutreachDto) {
    if (user.role !== UserRole.ADMIN) await this.verification.assertCanReachCandidates(user.id);
    return { success: true, data: await this.outreach.send(user, dto) };
  }

  /** Stops a scheduled message before it goes out. */
  @RequiresCapability('messaging:write')
  @Post('outreach/:id/cancel')
  async cancelScheduledOutreach(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.outreach.cancelScheduled(user, id) };
  }

  /**
   * Whether now is within the candidate's working hours, and when it next is.
   * A rule over their own browser's timezone — see outreach-timing.ts.
   */
  @RequiresCapability('candidates:read')
  @Get('outreach/timing/:candidateId')
  async outreachTiming(@Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return { success: true, data: await this.outreach.timing(candidateId) };
  }

  /** Open, reply and interest rates, company-wide. */
  @RequiresCapability('candidates:read')
  @Get('outreach/stats')
  async outreachStats(@CurrentUser() user: User) {
    return { success: true, data: await this.outreach.stats(user) };
  }

  /**
   * Which of these candidates have already been approached.
   *
   * One request for a page of cards. Comma-separated rather than a POST
   * because it is a read, and a dozen ids fit in a URL comfortably.
   */
  @RequiresCapability('candidates:read')
  @Get('outreach/contacted')
  async outreachContacted(@CurrentUser() user: User, @Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    return { success: true, data: await this.outreach.contactedAmong(user, list) };
  }

  /** Every approach this company has made to one person, and what came back. */
  @RequiresCapability('candidates:read')
  @Get('outreach/candidate/:candidateId')
  async outreachForCandidate(
    @CurrentUser() user: User,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
  ) {
    return { success: true, data: await this.outreach.forCandidate(user, candidateId) };
  }

  /** Proposes an interview (time slots) to a candidate. */
  @RequiresCapability('interviews:write')
  @Post('interviews')
  async proposeInterview(@CurrentUser() user: User, @Body() dto: ProposeInterviewDto) {
    // New candidate-facing invitations require the same verification as outreach.
    if (user.role !== UserRole.ADMIN) await this.verification.assertCanReachCandidates(user.id);
    return { success: true, data: await this.interviews.propose(user, dto) };
  }

  /** The employer's proposed/confirmed interviews. */
  @Get('interviews')
  async listInterviews(@CurrentUser() user: User) {
    return { success: true, data: await this.interviews.listForEmployer(user) };
  }

  /** Cancels a proposed/confirmed interview. */
  @RequiresCapability('interviews:write')
  @Post('interviews/:id/cancel')
  async cancelInterview(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.interviews.cancel(user, id) };
  }

  /** Logs a post-interview scorecard (private) + a candidate-visible outcome. */
  @RequiresCapability('interviews:write')
  @Post('interviews/:id/scorecard')
  async submitScorecard(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitScorecardDto,
  ) {
    return { success: true, data: await this.interviews.submitScorecard(user, id, dto) };
  }

  /** The employer's private scorecard + outcome for one interview. */
  @Get('interviews/:id/scorecard')
  async getScorecard(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.interviews.getScorecard(user, id) };
  }

  /** Invites a candidate to an async AI screening (generates questions). */
  @RequiresCapability('candidates:write')
  @Post('ai-screens')
  async inviteScreen(@CurrentUser() user: User, @Body() dto: InviteScreenDto) {
    if (user.role !== UserRole.ADMIN) await this.verification.assertCanReachCandidates(user.id);
    return { success: true, data: await this.screens.invite(user, dto) };
  }

  /** Lists the employer's screenings (optionally for one candidate). */
  @Get('ai-screens')
  async listScreens(@CurrentUser() user: User, @Query('candidateId') candidateId?: string) {
    return { success: true, data: await this.screens.listForEmployer(user, candidateId) };
  }

  /** Full scorecard for one completed screening. */
  @Get('ai-screens/:id')
  async getScreen(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.getForEmployer(user, id) };
  }

  /**
   * Confirms to the candidate that their requested adjustments were seen.
   * A message to the candidate on the company's behalf — not a read.
   */
  @RequiresCapability('candidates:write')
  @Post('ai-screens/:id/accommodations/acknowledge')
  async acknowledgeAccommodations(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { success: true, data: await this.screens.acknowledgeAccommodations(user, id) };
  }

  /* ── Job-scoped screening: one question set, many candidates ── */

  /** The job's shared question set (empty until generated). */
  @Get('jobs/:jobId/screening-questions')
  async jobQuestions(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return { success: true, data: await this.screens.getJobQuestions(user, jobId) };
  }

  /** Generates the set, or replaces it when `regenerate` is set. */
  @RequiresCapability('jobs:write')
  @Post('jobs/:jobId/screening-questions')
  async generateJobQuestions(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: GenerateJobQuestionsDto,
  ) {
    const data = await this.screens.generateJobQuestions(user, jobId, dto);
    void this.billing.record(user.id, 'ai.screening');
    return { success: true, data };
  }

  /** All applicants for a job ranked by screening result — the comparison board. */
  @Get('jobs/:jobId/screening-board')
  async screeningBoard(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return { success: true, data: await this.screens.screeningBoard(user, jobId) };
  }

  /** Screens already sent for this job, best score first. */
  @Get('jobs/:jobId/ai-screens')
  async jobScreens(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return { success: true, data: await this.screens.listForJob(user, jobId) };
  }

  /** Invites many of the job's applicants at once, all on the same questions. */
  @RequiresCapability('candidates:write')
  @Post('jobs/:jobId/ai-screens')
  async inviteScreenBatch(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: InviteScreenBatchDto,
  ) {
    // Screening invites request recordings and CVs — same boundary as posting.
    if (user.role !== UserRole.ADMIN) await this.verification.assertCanReachCandidates(user.id);
    return { success: true, data: await this.screens.inviteBatch(user, jobId, dto) };
  }
}

/**
 * The candidate's side of outreach: reading an approach and answering it.
 *
 * Its own controller because the hiring controller is employer-only, and the
 * person answering is the job seeker who was written to.
 */
@Controller('outreach')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class CandidateOutreachController {
  constructor(private readonly outreach: OutreachService) {}

  @Get(':id')
  async read(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.outreach.readForCandidate(user.id, id) };
  }

  @Post(':id/respond')
  async respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondOutreachDto,
  ) {
    return {
      success: true,
      data: await this.outreach.respond(user.id, id, dto.response, dto.note),
    };
  }
}

/** Candidate-side interview actions (invitations live in /activity). */
@Controller('interviews')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class CandidateInterviewsController {
  constructor(private readonly interviews: InterviewService) {}

  @Get('me')
  async listMine(@CurrentUser() user: User) {
    return { success: true, data: await this.interviews.listForCandidate(user) };
  }

  @Post(':id/respond')
  async respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondInterviewDto,
  ) {
    return { success: true, data: await this.interviews.respond(user, id, dto) };
  }
}

/**
 * Native video-interview room metadata — hit by BOTH the employer and the
 * candidate, so it allows either role (participation is enforced in the service).
 */
@Controller('interviews')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.JOB_SEEKER, UserRole.ADMIN)
export class InterviewRoomController {
  constructor(private readonly interviews: InterviewService) {}

  @Get(':id/room')
  async room(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.interviews.getRoom(user, id) };
  }

  /** Downloadable `.ics` calendar file for the interview (any calendar app). */
  @Get(':id/calendar.ics')
  async ics(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { filename, content } = await this.interviews.getIcs(user, id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}

/** Employer-side self-serve booking: publish & manage open interview slots. */
@Controller('employers/availability')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: { employerId: user.id, slots: await this.availability.listMine(user) } };
  }

  @Post()
  async add(@CurrentUser() user: User, @Body() dto: AddSlotsDto) {
    return { success: true, data: { employerId: user.id, slots: await this.availability.addSlots(user, dto) } };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.availability.removeSlot(user, id) };
  }
}

/** Candidate-side booking page: view an employer's open slots and book one. */
@Controller('booking')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class BookingController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get(':employerId')
  async page(@Param('employerId', ParseUUIDPipe) employerId: string) {
    return { success: true, data: await this.availability.bookingPage(employerId) };
  }

  @Post('slots/:slotId')
  async book(@CurrentUser() user: User, @Param('slotId', ParseUUIDPipe) slotId: string) {
    return { success: true, data: await this.availability.book(user, slotId) };
  }
}

/** Candidate-side AI screening: take it, submit answers, or decline. */
@Controller('ai-screens')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class CandidateScreensController {
  constructor(private readonly screens: AiScreenService) {}

  @Get('me')
  async listMine(@CurrentUser() user: User) {
    return { success: true, data: await this.screens.listForCandidate(user) };
  }

  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.getForCandidate(user, id) };
  }

  /**
   * Requests adjustments for taking this screening. Records what they need,
   * never why — there is no diagnosis field and none should be added.
   */
  @Post(':id/accommodations')
  async requestAccommodations(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestAccommodationsDto,
  ) {
    return { success: true, data: await this.screens.requestAccommodations(user, id, dto) };
  }

  /* ── Live (conversational) screening ── */

  /** Records acceptance of the AI-interview notice. Required before starting. */
  @Post(':id/live/consent')
  async consentLive(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.consentToLive(user, id) };
  }

  /** Opens (or resumes) the one run for this screening. */
  @Post(':id/live/start')
  async startLive(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.startLive(user, id) };
  }

  /** Scores the finished run and notifies the employer. Idempotent. */
  @Post(':id/live/complete')
  async completeLive(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.finishLive(user, id) };
  }

  /**
   * The candidate's own coaching feedback from their interview. Never the
   * employer's scorecard — a different reader gets a different report.
   */
  @Get(':id/live/feedback')
  async liveFeedback(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.liveFeedback(user, id) };
  }

  /** Uploads a recorded video answer for one question (video-mode screening). */
  @Post(':id/video/:index')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return { success: true, data: await this.screens.uploadVideo(user, id, index, file) };
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitScreenDto,
  ) {
    return { success: true, data: await this.screens.submit(user, id, dto) };
  }

  @Post(':id/decline')
  async decline(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.screens.decline(user, id) };
  }
}
