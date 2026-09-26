import {
  Body,
  Controller,
  UploadedFile,
  UseInterceptors,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/types/user.types';
import { CreatePostDto } from './dto/create-post.dto';
import { ResharePostDto } from './dto/reshare-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { CommunityMediaService } from '../media.service';

@Controller('community/posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly media: CommunityMediaService,
  ) {}

  /**
   * Uploads one image and returns its URL, to be included when the post is
   * created. Separate from post creation so a large upload does not have to
   * succeed and be re-sent every time the text fails validation.
   */
  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    return { success: true, data: await this.media.upload(user, file) };
  }

  @Public()
  @Get()
  async list(@Query() query: ListPostsQueryDto, @CurrentUser() user?: User) {
    return {
      success: true,
      ...(await this.postsService.list(query, user?.id)),
    };
  }

  /**
   * Whether the caller can publish in a company's name, and whose.
   *
   * Declared above `:id` on purpose — Nest matches in order, and
   * "company-voice" would otherwise be read as a post id. Not @Public: it is
   * a statement about who you are.
   */
  @Get('company-voice')
  async companyVoice(@CurrentUser() user: User) {
    return { success: true, data: { company: await this.postsService.companyVoiceFor(user.id) } };
  }

  @Public()
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: User) {
    return {
      success: true,
      data: await this.postsService.getById(id, user),
    };
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user, dto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.delete(id, user);
  }

  @Post(':id/reshare')
  async reshare(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResharePostDto,
  ) {
    return this.postsService.reshare(id, user.id, dto.content);
  }

  @Post(':id/like')
  async like(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.like(id, user.id);
  }

  @Delete(':id/like')
  async unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.unlike(id, user.id);
  }

  @Post(':id/bookmark')
  async bookmark(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.bookmark(id, user.id);
  }

  @Delete(':id/bookmark')
  async unbookmark(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.unbookmark(id, user.id);
  }
}
