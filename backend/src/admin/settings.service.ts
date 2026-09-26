import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Setting keys stored in the system_settings table. */
export const SETTING_KEYS = {
  auditRetentionDays: 'audit.retentionDays',
} as const;

export const AUDIT_RETENTION_DEFAULT_DAYS = 90;
export const AUDIT_RETENTION_MIN_DAYS = 1;
export const AUDIT_RETENTION_MAX_DAYS = 3650; // ~10 years

/**
 * Small key-value settings store for admin-adjustable system config.
 * Values are cached in-memory (short TTL) so hot reads — like the retention
 * cron — don't hit the DB every time; writes bust the cache immediately.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) {
      this.cache.set(key, { value: row.value, expiresAt: Date.now() + this.cacheTtlMs });
      return row.value;
    }
    return null;
  }

  private async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private clampRetention(n: number): number {
    return Math.min(Math.max(Math.floor(n), AUDIT_RETENTION_MIN_DAYS), AUDIT_RETENTION_MAX_DAYS);
  }

  /**
   * Resolved audit-retention window in days.
   * Precedence: stored setting → AUDIT_LOG_RETENTION_DAYS env → default.
   */
  async getAuditRetentionDays(): Promise<number> {
    try {
      const stored = await this.get(SETTING_KEYS.auditRetentionDays);
      if (stored !== null) {
        const n = Number(stored);
        if (Number.isFinite(n)) return this.clampRetention(n);
      }
    } catch (err) {
      this.logger.error(`Failed to read audit retention setting: ${err instanceof Error ? err.message : err}`);
    }

    const envRaw = Number(this.config.get('AUDIT_LOG_RETENTION_DAYS'));
    if (Number.isFinite(envRaw) && envRaw >= AUDIT_RETENTION_MIN_DAYS) {
      return this.clampRetention(envRaw);
    }
    return AUDIT_RETENTION_DEFAULT_DAYS;
  }

  async setAuditRetentionDays(days: number): Promise<number> {
    const clamped = this.clampRetention(days);
    await this.set(SETTING_KEYS.auditRetentionDays, String(clamped));
    return clamped;
  }
}
