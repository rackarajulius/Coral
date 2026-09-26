import { Module } from '@nestjs/common';
import { SupabaseModule as CoreSupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [CoreSupabaseModule],
  exports: [CoreSupabaseModule],
})
export class SupabaseInfrastructureModule {}

