import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../services/ai/ai.service';

export interface CheckFinding {
  code: 'contact_details' | 'named_individual' | 'abusive' | 'unverifiable_claim' | 'too_short';
  detail: string;
}

export interface CheckResult {
  /** True when the review may publish immediately. */
  pass: boolean;
  findings: CheckFinding[];
  /** Whether the AI pass actually ran. False means we queued out of caution. */
  aiChecked: boolean;
}

/** Deterministic patterns — cheap, exact, and never wrong about what they match. */
const PATTERNS: { code: CheckFinding['code']; label: string; re: RegExp }[] = [
  { code: 'contact_details', label: 'an email address', re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/ },
  {
    code: 'contact_details',
    label: 'a phone number',
    re: /(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}/,
  },
  { code: 'contact_details', label: 'a web address', re: /https?:\/\/|www\.\w+\.\w{2,}/i },
];

/**
 * Automated pre-publication checks for reviews.
 *
 * Two layers, in order of confidence:
 *
 * 1. **Patterns** — contact details and length. Exact, instant, free.
 * 2. **AI judgement** — naming individuals, abuse, claims presented as fact
 *    that no reader could verify. These need reading comprehension.
 *
 * The important rule is that this **fails closed**: anything the checks can't
 * clear — including the AI being unavailable — is queued for a human rather
 * than published. Publishing on an unchecked path is how a defamatory review
 * goes live, and the whole reason the automatic route is acceptable is that
 * its failure mode is a delay, not an incident.
 */
@Injectable()
export class ReviewModerationService {
  private readonly logger = new Logger(ReviewModerationService.name);

  constructor(private readonly ai: AiService) {}

  async check(input: { title: string; body: string }): Promise<CheckResult> {
    const text = `${input.title}\n${input.body}`;
    const findings: CheckFinding[] = [];

    if (input.body.trim().length < 60) {
      findings.push({
        code: 'too_short',
        detail: 'Too short to be useful to a reader.',
      });
    }

    for (const p of PATTERNS) {
      if (p.re.test(text)) {
        findings.push({ code: p.code, detail: `Looks like it contains ${p.label}.` });
      }
    }

    // Deterministic failure is enough — no need to spend an AI call.
    if (findings.length > 0) return { pass: false, findings, aiChecked: false };

    const ai = await this.aiCheck(text);
    if (!ai) {
      // Unavailable, rate-limited, or malformed: queue rather than assume fine.
      return {
        pass: false,
        findings: [
          {
            code: 'unverifiable_claim',
            detail: 'Automated review was unavailable; queued for a person.',
          },
        ],
        aiChecked: false,
      };
    }

    return { pass: ai.length === 0, findings: ai, aiChecked: true };
  }

  /** Returns findings, or null when the check could not be completed. */
  private async aiCheck(text: string): Promise<CheckFinding[] | null> {
    const systemPrompt = [
      'You screen reviews of a company’s hiring process before publication. You are NOT judging whether the review is positive or negative — a harshly critical review of a real experience is exactly what should be published.',
      'Flag ONLY these:',
      '1. named_individual — identifies a specific person by name, or by a description so specific they are identifiable ("the bald recruiter with the Welsh accent").',
      '2. abusive — slurs, threats, or sexual content. Strong criticism, anger and profanity directed at the process or the company are NOT abusive.',
      '3. unverifiable_claim — a serious factual allegation of illegality stated as fact (fraud, discrimination, assault). These may be true and may matter enormously, which is exactly why a person and not a model should decide whether to publish them.',
      'Return STRICT JSON only: { "findings": [{ "code": string, "detail": string }] }. Empty array when nothing applies. `detail` is one short sentence for a human moderator.',
    ].join(' ');

    try {
      const raw = await this.ai.moderateText(systemPrompt, JSON.stringify({ review: text.slice(0, 4000) }));
      const list = Array.isArray((raw as { findings?: unknown }).findings)
        ? ((raw as { findings: unknown[] }).findings)
        : [];
      const allowed = new Set(['named_individual', 'abusive', 'unverifiable_claim']);
      return list
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
        .map((f) => ({
          code: String(f.code) as CheckFinding['code'],
          detail: String(f.detail ?? '').slice(0, 300),
        }))
        .filter((f) => allowed.has(f.code));
    } catch (err) {
      this.logger.warn(`Review moderation check failed: ${(err as Error).message}`);
      return null;
    }
  }
}
