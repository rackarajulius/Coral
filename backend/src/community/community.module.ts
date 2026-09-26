import { Module } from '@nestjs/common';
import { CommentsController } from './comments/comments.controller';
import { CommentsService } from './comments/comments.service';
import { FeedController } from './feed/feed.controller';
import { FeedService } from './feed/feed.service';
import { SpacesController } from './spaces/spaces.controller';
import { SpacesService } from './spaces/spaces.service';
import { CommunityIdentityService } from './identity.service';
import { ModerationService } from './moderation.service';
import { CommunityMediaService } from './media.service';
import { PollsService } from './polls.service';
import { GifsService } from './gifs.service';
import { LinkPreviewService } from './link-preview.service';
import { PollsController } from './polls.controller';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationController } from './moderation.controller';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';
import { TidesController } from './tides/tides.controller';
import { TidesService } from './tides/tides.service';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [PostsController, CommentsController, FeedController, SpacesController, ModerationController, PollsController, TidesController],
  providers: [PostsService, CommentsService, FeedService, SpacesService, CommunityIdentityService, ModerationService, CommunityMediaService, PollsService, GifsService, LinkPreviewService, TidesService],
  exports: [PostsService, CommentsService, FeedService],
})
export class CommunityModule {}
