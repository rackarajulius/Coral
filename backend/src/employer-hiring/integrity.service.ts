import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Integrity signals for AI screenings.
 *
 * Everything here is an OBSERVATION, never a verdict. A paste can be a prepared
 * note. A blurred tab can be a screen reader or an accessibility tool. A long
 * pause can be thinking, a slow connection, or nerves. Two candidates phrasing
 * an answer alike can be coincidence on a narrow technical question.
 *
 * So: signals are surfaced to a human reviewer as context, are never mixed into
 * the score, and nothing here triggers an automatic action. Treating any of
 * them as proof would punish the honest cases — disabled candidates and people
 * on poor connections first.
 */

/** Signals the client reports during a screening. */
export interface ClientSignals {
  pasteCount?: number;
  pastedChars?: number;
  blurCount?: number;
  blurMs?: number;
  /** Seconds between the question ending and the answer starting. */
  latencies?: number[];
}

export interface IntegrityNote {
  /** Machine key, so the UI controls the wording. */
  code: 'paste' | 'away' | 'similarity' | 'latency';
  /** Neutral, factual statement of what was observed. */
  detail: string;
}

/** Jaccard overlap of word trigrams — cheap, no AI, no false precision. */
function trigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Above this, two answers to the same question share enough exact phrasing that
 * independent authorship is unlikely. Set high on purpose: short answers to
 * narrow questions legitimately converge, and a false accusation is far more
 * damaging here than a missed one.
 */
const SIMILARITY_THRESHOLD = 0.45;

/** Answers shorter than this are too short for overlap to mean anything. */
const MIN_WORDS_FOR_SIMILARITY = 25;

@Injectable()
export class IntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Merges client-reported signals onto a screening. Additive, never trusted. */
  async record(screenId: string, signals: ClientSignals) {
    const screen = await this.prisma.aiScreen.findUnique({
      where: { id: screenId },
      select: { integritySignals: true },
    });
    if (!screen) return;

    const prev = (screen.integritySignals ?? {}) as ClientSignals;
    const merged = {
      pasteCount: (prev.pasteCount ?? 0) + (signals.pasteCount ?? 0),
      pastedChars: (prev.pastedChars ?? 0) + (signals.pastedChars ?? 0),
      blurCount: (prev.blurCount ?? 0) + (signals.blurCount ?? 0),
      blurMs: (prev.blurMs ?? 0) + (signals.blurMs ?? 0),
      latencies: [...(prev.latencies ?? []), ...(signals.latencies ?? [])].slice(0, 50),
      collectedAt: new Date().toISOString(),
    };

    await this.prisma.aiScreen.update({
      where: { id: screenId },
      data: { integritySignals: merged },
    });
  }

  /**
   * Notes for one screening, including how its answers compare with everyone
   * else's in the same round. Returns an empty list when nothing stood out —
   * absence of notes is the normal case and should read as unremarkable.
   */
  async notesFor(screenId: string): Promise<{ notes: IntegrityNote[]; measured: boolean }> {
    const screen = await this.prisma.aiScreen.findUnique({
      where: { id: screenId },
      select: {
        id: true, jobId: true, answers: true, integritySignals: true, accommodations: true,
      },
    });
    if (!screen) return { notes: [], measured: false };

    const notes: IntegrityNote[] = [];
    const s = screen.integritySignals as (ClientSignals & { collectedAt?: string }) | null;

    // A declared screen reader or assistive tool produces focus changes as a
    // matter of course. Reporting those as "left the tab" would turn using
    // access software into a suspicion — the exact harm this must not cause.
    const needs = this.needsOf(screen.accommodations);
    const usesAssistiveTech = needs.includes('assistive_tech');

    if (s?.pasteCount && s.pasteCount > 0) {
      notes.push({
        code: 'paste',
        detail: `Pasted text ${s.pasteCount} time${s.pasteCount === 1 ? '' : 's'}${
          s.pastedChars ? ` (${s.pastedChars} characters)` : ''
        }.`,
      });
    }

    // 30s+ away is the floor: brief switches are ordinary computer use.
    if (!usesAssistiveTech && s?.blurCount && s.blurMs && s.blurMs > 30_000) {
      notes.push({
        code: 'away',
        detail: `Left the interview tab ${s.blurCount} time${
          s.blurCount === 1 ? '' : 's'
        }, ${Math.round(s.blurMs / 1000)}s in total.`,
      });
    }

    const similar = await this.similarAnswers(screen.id, screen.jobId, screen.answers);
    if (similar > 0) {
      notes.push({
        code: 'similarity',
        detail: `${similar} answer${similar === 1 ? '' : 's'} closely match another candidate's in this round.`,
      });
    }

    return { notes, measured: !!s?.collectedAt };
  }

  /**
   * How many of this screening's answers closely match another candidate's
   * answer to the same question in the same round.
   *
   * Same round only: candidates for one job answer identical questions, so
   * overlap there is comparable. Across jobs it would be meaningless.
   */
  private async similarAnswers(
    screenId: string,
    jobId: string | null,
    answers: unknown,
  ): Promise<number> {
    if (!jobId) return 0;

    const mine = this.toQa(answers).filter(
      (a) => a.answer.split(/\s+/).length >= MIN_WORDS_FOR_SIMILARITY,
    );
    if (mine.length === 0) return 0;

    const others = await this.prisma.aiScreen.findMany({
      where: { jobId, status: 'completed', id: { not: screenId } },
      select: { answers: true },
      take: 200,
    });
    if (others.length === 0) return 0;

    // Index other candidates' answers by question so we only ever compare
    // like with like.
    const byQuestion = new Map<string, Set<string>[]>();
    for (const o of others) {
      for (const qa of this.toQa(o.answers)) {
        if (qa.answer.split(/\s+/).length < MIN_WORDS_FOR_SIMILARITY) continue;
        const key = qa.question.trim().toLowerCase();
        const list = byQuestion.get(key) ?? [];
        list.push(trigrams(qa.answer));
        byQuestion.set(key, list);
      }
    }

    let hits = 0;
    for (const qa of mine) {
      const peers = byQuestion.get(qa.question.trim().toLowerCase());
      if (!peers?.length) continue;
      const mineGrams = trigrams(qa.answer);
      if (peers.some((p) => jaccard(mineGrams, p) >= SIMILARITY_THRESHOLD)) hits++;
    }
    return hits;
  }

  /** Accommodation needs on a screening, or an empty list. */
  private needsOf(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const needs = (value as { needs?: unknown }).needs;
    return Array.isArray(needs) ? needs.filter((n): n is string => typeof n === 'string') : [];
  }

  private toQa(value: unknown): { question: string; answer: string }[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((a) => {
        const rec = (a ?? {}) as { question?: unknown; answer?: unknown };
        return { question: String(rec.question ?? ''), answer: String(rec.answer ?? '').trim() };
      })
      .filter((x) => x.question && x.answer);
  }
}
