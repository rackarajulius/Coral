import {
  Body,
  Controller,
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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('community/posts/:postId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Get()
  async list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    return {
      success: true,
      ...(await this.commentsService.listByPost(postId, query)),
    };
  }

  @Post()
  async create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, user.id, dto);
  }

  @Patch(':commentId')
  async update(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(postId, commentId, user, dto);
  }

  @Delete(':commentId')
  async delete(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.delete(postId, commentId, user);
  }
}
