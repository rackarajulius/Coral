import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import {
  IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/types/user.types';
import { SPACE_SCOPES, SpaceScope, SpacesService } from './spaces.service';
import { SpaceSuggestionsService } from './space-suggestions.service';

/**
 * Spaces are public to read and require sign-in to join.
 *
 * Reading without an account is deliberate: these pages are the community's
 * durable, searchable surface, and putting them behind a login would make them
 * invisible to everyone who has not already arrived.
 */
export class BannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string;
}

export class CreateSpaceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  /** Must already be uploaded here; the service refuses anything else. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string;
}

export class ListSpacesQueryDto {
  /** 'mine' for the sidebar, 'popular' when that is empty, 'all' for the directory. */
  @IsOptional()
  @IsIn(SPACE_SCOPES)
  scope?: SpaceScope;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class SuggestionsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

@Controller('community/spaces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SpacesController {
  constructor(
    private readonly spaces: SpacesService,
    private readonly suggestions: SpaceSuggestionsService,
  ) {}

  @Public()
  @Get()
  async list(@Query() query: ListSpacesQueryDto, @CurrentUser() user?: User) {
    const { data, meta } = await this.spaces.list(user?.id, query);
    return { success: true, data, meta };
  }

  /**
   * Spaces for this person, each with the reason it is suggested.
   *
   * Signed in only: it is built from what you have done, and signed out there
   * is nothing to build it from — the popular list already covers that case.
   * Declared before `:slug`, which would otherwise take "suggestions" as one.
   */
  @Get('suggestions')
  async suggest(@CurrentUser() user: User, @Query() query: SuggestionsQueryDto) {
    return { success: true, data: await this.suggestions.suggest(user.id, query.limit ?? 10) };
  }

  @Public()
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string, @CurrentUser() user?: User) {
    return { success: true, data: await this.spaces.getBySlug(slug, user?.id) };
  }

  /** Anyone signed in. The creator becomes its moderator. */
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateSpaceDto) {
    return { success: true, data: await this.spaces.create(user, dto) };
  }

  /** Moderators only. Omitting the url clears the banner. */
  @Post(':id/banner')
  async setBanner(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BannerDto,
  ) {
    return { success: true, data: await this.spaces.setBanner(user, id, dto.bannerUrl ?? null) };
  }

  @Post(':id/join')
  async join(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.spaces.join(user, id) };
  }

  @Delete(':id/join')
  async leave(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.spaces.leave(user, id) };
  }

  /** "Not interested" on a suggestion. */
  @Post(':id/dismiss')
  async dismiss(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.suggestions.dismiss(user.id, id) };
  }

  @Delete(':id/dismiss')
  async undismiss(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.suggestions.undismiss(user.id, id) };
  }
}
