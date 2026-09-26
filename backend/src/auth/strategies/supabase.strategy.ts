import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseStrategy {
  constructor(private readonly supabaseService: SupabaseService) {}

  async validate(token: string) {
    return this.supabaseService.verifyToken(token);
  }
}

