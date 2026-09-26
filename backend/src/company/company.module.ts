import { Global, Module } from '@nestjs/common';
import { CompanyContextService } from './company-context.service';
import { CompanyCapabilityGuard } from './company-capability.guard';
import { CompanyMembersService } from './company-members.service';
import { CompanyAuditService } from './company-audit.service';
import { CompanyAuditController } from './company-audit.controller';
import { CompanyMembersController } from './company-members.controller';
import { CompanyEnrolmentService } from './company-enrolment.service';
import { CompanyJoinLinkService } from './company-join-link.service';
import { CompanyJoinLinkController, CompanyJoinController } from './company-join-link.controller';
import { EmailModule } from '../services/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CandidateWatchersService } from './candidate-watchers.service';
import { PipelineLinkService } from './pipeline-link.service';

/**
 * Global because company scoping is needed almost everywhere an employer is
 * involved — jobs, applications, messaging, hiring and analytics. Analytics is
 * already imported by EmployersModule, so exporting this from there would make
 * the graph circular.
 */
@Global()
@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [CompanyMembersController, CompanyJoinLinkController, CompanyJoinController, CompanyAuditController],
  providers: [
    CompanyContextService,
    CompanyCapabilityGuard,
    CompanyMembersService,
    CompanyJoinLinkService,
    CompanyEnrolmentService,
    CompanyAuditService,
    // Here, beside company scoping, because notes, stage moves and shortlists
    // all live in different modules and all need the same answer to
    // "who is working this candidate".
    CandidateWatchersService,
    // Same reason: applications and shortlists are separate modules, and a
    // link recorded on only one side is not a link.
    PipelineLinkService,
  ],
  exports: [
    CompanyContextService,
    CompanyCapabilityGuard,
    CompanyAuditService,
    CandidateWatchersService,
    PipelineLinkService,
  ],
})
export class CompanyModule {}
