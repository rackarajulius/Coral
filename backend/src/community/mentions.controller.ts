import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { suggestMentions } from './mentions';

/** The "@" menu in the composer and the comment box. */
@Controller('community/mentions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MentionsController {
  constructor(private readonly prisma: PrismaService) {}

  /** People and companies matching what was typed after "@". Signed in only: it is for writing. */
  @Get()
  async suggest(@Query('q') q: string | undefined, @CurrentUser() user: User) {
    return { success: true, data: await suggestMentions(this.prisma, user.id, String(q ?? '').slice(0, 100)) };
  }
}
