import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/user.types';
import { PostCollaboratorsService, type CollaborationAction } from './post-collaborators.service';
import {
  CollaborationAnswerDto,
  CollaborationSettingsDto,
  SetCollaboratorsDto,
  SuggestCollaboratorsQueryDto,
} from './collaborators.dto';

const ACTIONS: CollaborationAction[] = ['accept', 'decline', 'leave'];

/** Collaborators on community posts. Everything here needs a signed-in person. */
@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostCollaboratorsController {
  constructor(private readonly collaborators: PostCollaboratorsService) {}

  /** Who the "Add collaborators" picker offers. */
  @Get('collaborators/suggest')
  async suggest(@CurrentUser() user: User, @Query() query: SuggestCollaboratorsQueryDto) {
    return { success: true, data: await this.collaborators.suggest(user.id, query.q) };
  }

  /** Whether people may invite you to collaborate (LinkedIn's "Allow collaborations"). */
  @Get('collaboration-settings')
  async settings(@CurrentUser() user: User) {
    return { success: true, data: await this.collaborators.getSettings(user.id) };
  }

  @Put('collaboration-settings')
  async setSettings(@CurrentUser() user: User, @Body() dto: CollaborationSettingsDto) {
    return { success: true, data: await this.collaborators.setSettings(user.id, dto.allowCollaborations) };
  }

  /** A post's collaborators and outstanding invitations, for whoever manages the post. */
  @Get('posts/:id/collaborators')
  async list(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.collaborators.listForManager(id, user.id) };
  }

  @Put('posts/:id/collaborators')
  async set(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCollaboratorsDto) {
    return { success: true, data: await this.collaborators.setForPost(id, user.id, dto.collaborators) };
  }

  /** Accept or decline an invitation, or leave a post — as yourself, or for a company page you run. */
  @Post('posts/:id/collaboration/:action')
  async respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: string,
    @Body() dto: CollaborationAnswerDto,
  ) {
    if (!ACTIONS.includes(action as CollaborationAction)) throw new BadRequestException('Accept, decline or leave.');
    return { success: true, data: await this.collaborators.respond(id, user.id, action as CollaborationAction, dto.companyId) };
  }
}
