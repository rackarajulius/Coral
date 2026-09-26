import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OfferStatus, ScorecardRecommendation, UserRole } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { CompanyCapabilityGuard, RequiresCapability } from '../company/company-capability.guard';
import { CandidateNotesService } from './candidate-notes.service';
import { CandidateReactionsService } from './candidate-reactions.service';
import { ReactionDto } from './dto/reaction.dto';
import { OffersService } from './offers.service';
import { OfferSignalsService } from './offer-signals.service';
import { EmailTemplatesService } from './email-templates.service';
import { ScorecardsService } from './scorecards.service';

/* ---------------------------------- DTOs ---------------------------------- */

export class NoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

export class TagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;
}

export class OfferDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  salaryPeriod?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNotes?: string;
}

/**
 * Offer values still being typed, checked before they are saved. With
 * `preview=true` these replace the saved draft wholesale — an empty field on
 * screen is empty here too.
 */
export class OfferSignalsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(5)
  preview?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  salaryPeriod?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class TemplateDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @MinLength(1) @MaxLength(200) subject!: string;
  @IsString() @MinLength(1) @MaxLength(20000) body!: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
}

export class TemplatePatchDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
}

export class RatingDto {
  @IsString() @MinLength(1) @MaxLength(60) criterion!: string;
  @IsInt() @Min(1) score!: number;
}

export class ScorecardDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RatingDto)
  ratings?: RatingDto[];

  @IsOptional() @IsEnum(ScorecardRecommendation) recommendation?: ScorecardRecommendation;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsBoolean() submit?: boolean;
}

export class CriterionDto {
  @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
}

export class BulkSendDto {
  @IsUUID()
  templateId!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  applicationIds!: string[];

  @IsOptional()
  @IsBoolean()
  markRejected?: boolean;
}

/* ------------------------------- controller ------------------------------- */

/**
 * The ATS primitives an employer touches all day: notes, tags, offers and
 * candidate messaging.
 *
 * Nothing here is gated on `candidates:read` alone. All of it either records an
 * opinion, changes a pipeline stage, or sends a person a message — none of
 * which a read-only viewer should be able to do.
 *
 * Writing a note takes `candidates:comment`; everything else takes
 * `candidates:write`. That line is the difference between having an opinion
 * about a candidate and deciding their outcome.
 */
@Controller('employers/ats')
@UseGuards(JwtAuthGuard, RolesGuard, CompanyCapabilityGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class AtsController {
  constructor(
    private readonly notes: CandidateNotesService,
    private readonly reactions: CandidateReactionsService,
    private readonly offers: OffersService,
    private readonly offerSignals: OfferSignalsService,
    private readonly templates: EmailTemplatesService,
    private readonly scorecards: ScorecardsService,
  ) {}

  /* --------------------------------- notes -------------------------------- */

  @RequiresCapability('candidates:read')
  @Get('candidates/:candidateId/notes')
  async listNotes(@CurrentUser() user: User, @Param('candidateId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.notes.list(user, id) };
  }

  // Notes take `candidates:comment`, not `candidates:write`: an interviewer
  // should be able to record what they made of someone without also holding the
  // power to advance or reject them. Tags below keep `candidates:write` — the
  // team filters on those, so applying one is a decision, not a remark.
  @RequiresCapability('candidates:comment')
  @Post('candidates/:candidateId/notes')
  async addNote(
    @CurrentUser() user: User,
    @Param('candidateId', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
  ) {
    return { success: true, data: await this.notes.create(user, id, dto.body) };
  }

  @RequiresCapability('candidates:comment')
  @Patch('notes/:noteId')
  async editNote(
    @CurrentUser() user: User,
    @Param('noteId', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
  ) {
    return { success: true, data: await this.notes.update(user, id, dto.body) };
  }

  @RequiresCapability('candidates:comment')
  @Delete('notes/:noteId')
  async deleteNote(@CurrentUser() user: User, @Param('noteId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.notes.remove(user, id) };
  }

  /* -------------------------------- reactions ----------------------------- */

  @RequiresCapability('candidates:read')
  @Get('candidates/:candidateId/reactions')
  async listReactions(@CurrentUser() user: User, @Param('candidateId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.reactions.forCandidate(user, id) };
  }

  /**
   * A thumbs up or down, or null to take it back.
   *
   * Takes `candidates:comment`, not `candidates:write` — a reaction is an
   * opinion offered, which is exactly what the comment-only seat is for. PUT
   * because there is one per person: reacting again replaces.
   */
  @RequiresCapability('candidates:comment')
  @Put('candidates/:candidateId/reaction')
  async setReaction(
    @CurrentUser() user: User,
    @Param('candidateId', ParseUUIDPipe) id: string,
    @Body() dto: ReactionDto,
  ) {
    return { success: true, data: await this.reactions.set(user, id, dto.value ?? null) };
  }

  /* ---------------------------------- tags -------------------------------- */

  @RequiresCapability('candidates:read')
  @Get('candidates/:candidateId/tags')
  async listTags(@CurrentUser() user: User, @Param('candidateId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.notes.listTags(user, id) };
  }

  @RequiresCapability('candidates:write')
  @Post('candidates/:candidateId/tags')
  async addTag(
    @CurrentUser() user: User,
    @Param('candidateId', ParseUUIDPipe) id: string,
    @Body() dto: TagDto,
  ) {
    return { success: true, data: await this.notes.addTag(user, id, dto.label) };
  }

  @RequiresCapability('candidates:write')
  @Delete('tags/:tagId')
  async removeTag(@CurrentUser() user: User, @Param('tagId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.notes.removeTag(user, id) };
  }

  /** Labels this company already uses, for autocomplete. */
  @RequiresCapability('candidates:read')
  @Get('tags')
  async labels(@CurrentUser() user: User) {
    return { success: true, data: await this.notes.labelsInUse(user) };
  }

  /* --------------------------------- offers ------------------------------- */

  @RequiresCapability('candidates:read')
  @Get('offers')
  async listOffers(@CurrentUser() user: User, @Query('status') status?: OfferStatus) {
    return { success: true, data: await this.offers.list(user, status) };
  }

  /**
   * What this company knows that bears on the offer being accepted — facts,
   * not a score. See ats/offer-signal.rules.ts.
   */
  @RequiresCapability('candidates:read')
  @Get('applications/:applicationId/offer-signals')
  async getOfferSignals(
    @CurrentUser() user: User,
    @Param('applicationId', ParseUUIDPipe) id: string,
    @Query() query: OfferSignalsQueryDto,
  ) {
    const preview =
      query.preview === 'true'
        ? {
            salaryAmount: query.salaryAmount ?? null,
            salaryCurrency: query.salaryCurrency,
            salaryPeriod: query.salaryPeriod ?? null,
            startDate: query.startDate ?? null,
            expiresAt: query.expiresAt ?? null,
          }
        : undefined;
    return { success: true, data: await this.offerSignals.forApplication(user, id, preview) };
  }

  /** Acceptance by the signals offers went out with. Silent until there are enough. */
  @RequiresCapability('candidates:read')
  @Get('offers/outcomes')
  async getOfferOutcomes(@CurrentUser() user: User) {
    return { success: true, data: await this.offerSignals.outcomes(user) };
  }

  @RequiresCapability('candidates:read')
  @Get('applications/:applicationId/offer')
  async getOffer(
    @CurrentUser() user: User,
    @Param('applicationId', ParseUUIDPipe) id: string,
  ) {
    return { success: true, data: await this.offers.getForApplication(user, id) };
  }

  @RequiresCapability('candidates:write')
  @Post('applications/:applicationId/offer')
  async saveOffer(
    @CurrentUser() user: User,
    @Param('applicationId', ParseUUIDPipe) id: string,
    @Body() dto: OfferDto,
  ) {
    return { success: true, data: await this.offers.upsertDraft(user, id, dto) };
  }

  @RequiresCapability('candidates:write')
  @Post('offers/:offerId/send')
  async sendOffer(@CurrentUser() user: User, @Param('offerId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.offers.send(user, id) };
  }

  @RequiresCapability('candidates:write')
  @Post('offers/:offerId/withdraw')
  async withdrawOffer(@CurrentUser() user: User, @Param('offerId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.offers.withdraw(user, id) };
  }

  /* ------------------------------- scorecards ----------------------------- */

  /** The company's rubric. Shared so two interviewers score the same things. */
  @RequiresCapability('interviews:read')
  @Get('scorecard-criteria')
  async listCriteria(@CurrentUser() user: User) {
    return { success: true, data: await this.scorecards.listCriteria(user) };
  }

  @RequiresCapability('interviews:write')
  @Post('scorecard-criteria')
  async addCriterion(@CurrentUser() user: User, @Body() dto: CriterionDto) {
    return { success: true, data: await this.scorecards.addCriterion(user, dto.label, dto.position) };
  }

  @RequiresCapability('interviews:write')
  @Delete('scorecard-criteria/:id')
  async archiveCriterion(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.scorecards.archiveCriterion(user, id) };
  }

  /** Every reviewer's card for one interview, plus where the panel disagrees. */
  @RequiresCapability('interviews:read')
  @Get('interviews/:interviewId/scorecards')
  async listScorecards(
    @CurrentUser() user: User,
    @Param('interviewId', ParseUUIDPipe) id: string,
  ) {
    return { success: true, data: await this.scorecards.listForInterview(user, id) };
  }

  /** Saves the caller's own card. A reviewer can never write a colleague's. */
  @RequiresCapability('interviews:write')
  @Post('interviews/:interviewId/scorecards')
  async saveScorecard(
    @CurrentUser() user: User,
    @Param('interviewId', ParseUUIDPipe) id: string,
    @Body() dto: ScorecardDto,
  ) {
    return { success: true, data: await this.scorecards.save(user, id, dto) };
  }

  /* ------------------------------- templates ------------------------------ */

  @RequiresCapability('candidates:read')
  @Get('templates')
  async listTemplates(@CurrentUser() user: User) {
    return { success: true, data: await this.templates.list(user) };
  }

  @RequiresCapability('candidates:read')
  @Get('templates/tokens')
  tokens() {
    return { success: true, data: this.templates.tokens() };
  }

  @RequiresCapability('candidates:write')
  @Post('templates')
  async createTemplate(@CurrentUser() user: User, @Body() dto: TemplateDto) {
    return { success: true, data: await this.templates.create(user, dto) };
  }

  @RequiresCapability('candidates:write')
  @Patch('templates/:id')
  async updateTemplate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TemplatePatchDto,
  ) {
    return { success: true, data: await this.templates.update(user, id, dto) };
  }

  @RequiresCapability('candidates:write')
  @Delete('templates/:id')
  async deleteTemplate(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.templates.remove(user, id) };
  }

  /** Closing the loop with everyone at once — the point of the whole feature. */
  @RequiresCapability('candidates:write')
  @Post('templates/send')
  async bulkSend(@CurrentUser() user: User, @Body() dto: BulkSendDto) {
    return { success: true, data: await this.templates.sendBulk(user, dto) };
  }
}

/**
 * The candidate's side of offers.
 *
 * A separate controller because it is a different audience with a different
 * role gate — folding it into the employer controller would put a jobseeker
 * route behind an employer guard, which is how these things go wrong.
 */
@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class CandidateOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get('me')
  async mine(@CurrentUser() user: User) {
    return { success: true, data: await this.offers.listForCandidate(user) };
  }

  @Post(':offerId/accept')
  async accept(@CurrentUser() user: User, @Param('offerId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.offers.respond(user, id, true) };
  }

  @Post(':offerId/decline')
  async decline(@CurrentUser() user: User, @Param('offerId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.offers.respond(user, id, false) };
  }
}
