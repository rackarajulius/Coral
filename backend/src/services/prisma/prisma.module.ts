import { Module } from '@nestjs/common';
import { PrismaModule as CorePrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [CorePrismaModule],
  exports: [CorePrismaModule],
})
export class PrismaInfrastructureModule {}

