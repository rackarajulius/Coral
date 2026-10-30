import { StorageModule } from '../storage/storage.module';
import { VideoPreviewService } from './video-preview.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketplaceController, ServicesController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceModerationController } from './marketplace-moderation.controller';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { MarketplaceRequestsController } from './marketplace-requests.controller';
import { MarketplaceRequestsService } from './marketplace-requests.service';
import { MarketplaceActivityService } from './marketplace-activity.service';
import { MarketplaceActivityController } from './marketplace-activity.controller';
@Module({ imports: [PrismaModule, StorageModule], controllers: [MarketplaceController, ServicesController, MarketplaceModerationController, MarketplaceRequestsController, MarketplaceActivityController], providers: [MarketplaceService, MarketplaceModerationService, MarketplaceRequestsService, MarketplaceActivityService, VideoPreviewService], exports: [MarketplaceService, MarketplaceRequestsService, MarketplaceActivityService] })
export class MarketplaceModule {}
