import { Module } from '@nestjs/common';
import { AiModule } from '../services/ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminReviewsController, EmployerReviewsController, ReviewsController,
} from './reviews.controller';
import { ReviewModerationService } from './review-moderation.service';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AiModule, NotificationsModule],
  controllers: [ReviewsController, EmployerReviewsController, AdminReviewsController],
  providers: [ReviewModerationService, ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
