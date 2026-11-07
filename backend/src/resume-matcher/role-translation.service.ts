import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../services/ai/ai.service';
import { languageName } from './job-ad-language';

/** After a failed translation (quota used up, an outage), how long before asking again. */
const RETRY_AFTER_MS = 10 * 60_000;
/** Answers kept in memory; the table keeps them all. */
const MAX_KNOWN = 5000;

/** "  Senior   Nurse " and "senior nurse" are the same role. */
function roleKey(role: string): string {
  return role.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Job titles as job ads in other languages write them, so a search in
 * Germany for "nurse" also looks for "Pflegefachkraft".
 *
 * Each title and language is asked of the AI once and kept in
 * `role_translations`: the AI allowance is small and shared by every feature,
 * and the same few roles are searched over and over. Only the title is sent.
 */
@Injectable()
export class RoleTranslationService {
  private readonly logger = new Logger(RoleTranslationService.name);
  /** The local title, or null where ads use the role as it is. */
  private readonly known = new Map<string, string | null>();
  private readonly pending = new Map<string, Promise<string | null>>();
  /**
   * After a failed AI call, no new title is asked for until then. One failure
   * pauses them all: it is almost always the shared allowance running out
   * (seen 2026-10-16, 5.8s to fail), and every search would wait for its own
   * failure otherwise. Titles already kept are still used.
   */
  private aiPausedUntil = 0;

  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * The role as job ads in `language` write it. Undefined when they use it
   * unchanged, or when it can't be known right now. Never throws: the search
   * goes ahead with the role as given.
   */
  async localTitle(role: string, language: string): Promise<string | undefined> {
    const key = roleKey(role);
    if (!key) return undefined;
    const id = `${language}|${key}`;
    if (this.known.has(id)) return this.known.get(id) ?? undefined;

    let answer = this.pending.get(id);
    if (!answer) {
      answer = this.lookUp(id, key, language).finally(() => this.pending.delete(id));
      this.pending.set(id, answer);
    }
    return (await answer) ?? undefined;
  }

  private async lookUp(id: string, role: string, language: string): Promise<string | null> {
    try {
      const stored = await this.prisma.roleTranslation.findUnique({
        where: { role_language: { role, language } },
        select: { title: true },
      });
      const title = stored?.title ?? (await this.translate(role, language));
      // Not known yet, and not asked for now: nothing is remembered, so a later search asks.
      if (title === undefined) return null;
      const local = roleKey(title) === role ? null : title;
      if (this.known.size >= MAX_KNOWN) this.known.clear();
      this.known.set(id, local);
      return local;
    } catch (e) {
      this.logger.warn(`No ${language} title for "${role}" yet: ${(e as Error).message}`);
      return null;
    }
  }

  /** Asks the AI and keeps the answer; undefined while asking is paused. */
  private async translate(role: string, language: string): Promise<string | undefined> {
    if (Date.now() < this.aiPausedUntil) return undefined;
    let title: string;
    try {
      title = await this.ai.translateJobTitle(role, languageName(language));
    } catch (e) {
      this.aiPausedUntil = Date.now() + RETRY_AFTER_MS;
      throw e;
    }
    // Kept even when it couldn't be stored: the answer is good, only the copy failed.
    await this.prisma.roleTranslation
      .upsert({
        where: { role_language: { role, language } },
        create: { role, language, title },
        update: {},
      })
      .catch((e: Error) => this.logger.warn(`Could not keep the ${language} title for "${role}": ${e.message}`));
    return title;
  }
}
