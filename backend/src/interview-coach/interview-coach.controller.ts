import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { InterviewCoachService } from './interview-coach.service';
import { SpeechService } from './speech.service';
import { SpeakDto } from './dto/speak.dto';
import {
  EvaluateAnswerDto, StartSessionDto,
} from './dto/interview-coach.dto';

/** AI Interview Coach (/interview-prep) — owner-scoped mock-interview sessions. */
@Controller('interview-coach')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.ADMIN)
export class InterviewCoachController {
  constructor(
    private readonly coach: InterviewCoachService,
    private readonly speech: SpeechService,
  ) {}

  /**
   * Whether high-quality voice is available, plus the selectable voices. Both
   * in one call because the client always needs them together; the picker and
   * the synthesiser must agree on the list. The client degrades to browser
   * speech when `configured` is false.
   */
  @Get('speech/status')
  speechStatus() {
    return { success: true, data: this.speech.status() };
  }

  /** Synthesises Nova's speech. Returns MP3 bytes. */
  @Post('speech')
  async speak(@Body() dto: SpeakDto, @Res() res: Response) {
    const audio = await this.speech.synthesize(dto.text, dto.voiceId);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  }

  /**
   * A job to practise for: title, company, level and skills to set up the run.
   * 404 unless the caller has applied to the job (and not withdrawn).
   */
  @Get('practice-job/:jobId')
  async practiceJob(@CurrentUser() user: User, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return { success: true, data: await this.coach.practiceJob(user, jobId) };
  }

  /** Finished runs, newest first (history page). */
  @Get('sessions')
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.coach.list(user) };
  }

  /** The still-running session, if any — used to resume after a refresh. */
  @Get('sessions/active')
  async active(@CurrentUser() user: User) {
    return { success: true, data: await this.coach.getActive(user) };
  }

  @Get('sessions/:id')
  async getOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.coach.getOne(user, id) };
  }

  @Post('sessions')
  async start(@CurrentUser() user: User, @Body() dto: StartSessionDto) {
    return { success: true, data: await this.coach.start(user, dto) };
  }

  /* ── AI engine ── */

  /** Plans the interview with the AI (greeting + role-specific questions). */
  @Post('sessions/:id/plan')
  async plan(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.coach.plan(user, id) };
  }

  /** Scores one spoken answer and decides whether to probe deeper. */
  @Post('sessions/:id/evaluate')
  async evaluate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluateAnswerDto,
  ) {
    return { success: true, data: await this.coach.evaluate(user, id, dto) };
  }

  /** Builds the end-of-interview report from the real transcript. */
  @Post('sessions/:id/report')
  async report(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.coach.report(user, id) };
  }

  @Post('sessions/:id/complete')
  async complete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.coach.complete(user, id) };
  }

  @Post('sessions/:id/abandon')
  async abandon(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.coach.abandon(user, id) };
  }

  @Delete('sessions/:id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.coach.remove(user, id) };
  }
}
