/**
 * Scorer stability harness.
 *
 * Re-scores the same transcripts several times and reports how much the result
 * moves. An LLM screening score is only usable if it is reproducible: if the
 * same interview swings 20 points between runs, the ranking on the board is
 * partly noise, and no amount of calibration downstream fixes that.
 *
 * This measures RELIABILITY (does it agree with itself), which is a
 * precondition for validity (does it predict anything real). It does not
 * measure validity, and it is not a bias audit — those need outcome data and
 * demographic data respectively. See docs/scoring-validation.md.
 *
 * Source of transcripts:
 *   - real completed screens from the database when any exist (preferred —
 *     fixture answers are cleaner and better punctuated than real speech), or
 *   - the bundled synthetic fixtures otherwise.
 *
 * Usage (from backend/):
 *   npm run audit:stability                 # 5 runs per transcript
 *   RUNS=10 npm run audit:stability
 *   SOURCE=fixtures npm run audit:stability # force fixtures even if real data exists
 *   LIMIT=8 npm run audit:stability         # cap how many real transcripts to use
 *
 * COST: this makes RUNS x transcripts real AI calls. Defaults to 5 x 5 = 25.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/services/ai/ai.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FIXTURES } from './fixtures/screening-transcripts';

interface Transcript {
  id: string;
  role: string;
  note: string;
  medium: 'written' | 'spoken';
  qa: { question: string; answer: string }[];
}

interface RunResult {
  overallScore: number;
  recommendation: string;
  perAnswer: number[];
}

// Minimum 1: variance needs 2+, but RUNS=1 is a legitimate cheap check of
// where the scorer lands (calibration) when API budget is tight.
const RUNS = clampInt(process.env.RUNS, 5, 1, 20);
const LIMIT = clampInt(process.env.LIMIT, 5, 1, 25);

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), min), max) : fallback;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population SD — we have the whole set of runs, not a sample of them. */
function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function modal(xs: string[]): { value: string; count: number } {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best = { value: xs[0] ?? '', count: 0 };
  for (const [value, count] of counts) if (count > best.count) best = { value, count };
  return best;
}

/** Real completed screens, newest first — the transcripts we actually score. */
async function loadReal(prisma: PrismaService): Promise<Transcript[]> {
  const screens = await prisma.aiScreen.findMany({
    where: { status: 'completed', mode: { in: ['text', 'live'] } },
    orderBy: { completedAt: 'desc' },
    take: LIMIT,
    select: { id: true, role: true, mode: true, answers: true },
  });

  return screens
    .map((s) => {
      const qa = Array.isArray(s.answers)
        ? (s.answers as unknown[])
            .map((a) => {
              const rec = (a ?? {}) as { question?: unknown; answer?: unknown };
              return { question: String(rec.question ?? ''), answer: String(rec.answer ?? '').trim() };
            })
            .filter((x) => x.question && x.answer)
        : [];
      return {
        id: s.id.slice(0, 8),
        role: s.role ?? 'the role',
        note: `real ${s.mode} screen`,
        medium: (s.mode === 'live' ? 'spoken' : 'written') as 'written' | 'spoken',
        qa,
      };
    })
    .filter((t) => t.qa.length > 0);
}

function loadFixtures(): Transcript[] {
  // ONLY=a,b restricts the run — useful for re-measuring one case cheaply.
  const only = (process.env.ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const chosen = only.length ? FIXTURES.filter((f) => only.includes(f.id)) : FIXTURES;
  return chosen.map((f) => ({
    id: f.id,
    role: f.role,
    note: f.note,
    medium: f.id.includes('spoken') ? ('spoken' as const) : ('written' as const),
    qa: f.qa,
  }));
}

async function main() {
  Logger.overrideLogger(['error']); // the report is the output; suppress boot noise
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  try {
    const ai = app.get(AiService);
    const prisma = app.get(PrismaService);

    const forced = process.env.SOURCE;
    const real = forced === 'fixtures' ? [] : await loadReal(prisma);
    const transcripts = real.length > 0 ? real : loadFixtures();
    const source = real.length > 0 ? 'real completed screens' : 'synthetic fixtures';

    console.log('\n  Scorer stability audit');
    console.log('  ' + '─'.repeat(74));
    console.log(`  Source      : ${source} (${transcripts.length} transcripts)`);
    console.log(`  Runs each   : ${RUNS}`);
    console.log(`  AI calls    : ${transcripts.length * RUNS}`);
    if (real.length === 0 && forced !== 'fixtures') {
      console.log('  Note        : no completed screens in the database yet — fixtures used.');
    }
    console.log('');

    const rows: {
      t: Transcript;
      results: RunResult[];
      failures: number;
    }[] = [];

    for (const t of transcripts) {
      process.stdout.write(`  scoring ${t.id} `);
      const results: RunResult[] = [];
      let failures = 0;

      for (let i = 0; i < RUNS; i++) {
        try {
          const r = await ai.evaluateScreen({
            role: t.role,
            qa: t.qa,
            medium: t.medium,
          });
          results.push({
            overallScore: r.overallScore,
            recommendation: r.recommendation,
            perAnswer: r.perAnswer.map((p) => p.score),
          });
          process.stdout.write('.');
        } catch (err) {
          failures++;
          process.stdout.write('x');
          if (failures === RUNS) {
            console.log(`\n  ! ${(err as Error).message}`);
          }
        }
      }
      process.stdout.write('\n');
      rows.push({ t, results, failures });
    }

    // One run still tells you where the scorer lands (calibration), even though
    // variance needs two. A rate-limited run shouldn't throw that away.
    const scored = rows.filter((r) => r.results.length >= 1);
    const measurable = rows.filter((r) => r.results.length >= 2);
    if (scored.length === 0) {
      console.log('\n  Nothing could be scored — no results to report.');
      console.log('  Check GEMINI_API_KEY in backend/.env, and whether the quota is exhausted.\n');
      process.exitCode = 1;
      return;
    }
    if (measurable.length === 0) {
      console.log('\n  Only one run per transcript completed — scores below are usable for');
      console.log('  calibration, but variance could not be measured. Re-run for stability.');
    }

    console.log('\n  Per transcript');
    console.log('  ' + '─'.repeat(74));
    console.log(
      '  ' +
        'id'.padEnd(24) +
        'mean'.padStart(7) +
        'sd'.padStart(7) +
        'range'.padStart(11) +
        'rec'.padStart(13) +
        '  flips',
    );

    const sds: number[] = [];
    const ranges: number[] = [];
    let totalFlips = 0;
    let totalRuns = 0;

    for (const { t, results } of scored) {
      const scores = results.map((r) => r.overallScore);
      const sd = stdDev(scores);
      const lo = Math.min(...scores);
      const hi = Math.max(...scores);
      const recs = results.map((r) => r.recommendation);
      const top = modal(recs);
      const flips = recs.length - top.count;

      // Single-run rows have SD 0 by definition — including them would report
      // a stability the run never actually demonstrated.
      if (results.length >= 2) {
        sds.push(sd);
        ranges.push(hi - lo);
        totalFlips += flips;
        totalRuns += recs.length;
      }

      const single = results.length < 2;
      console.log(
        '  ' +
          t.id.slice(0, 23).padEnd(24) +
          mean(scores).toFixed(1).padStart(7) +
          (single ? '—' : sd.toFixed(1)).padStart(7) +
          (single ? `${lo}` : `${lo}–${hi}`).padStart(11) +
          top.value.padStart(13) +
          `  ${single ? 'n=1' : `${flips}/${recs.length}`}`,
      );
    }

    if (measurable.length === 0) {
      console.log('');
      return;
    }

    const meanSd = mean(sds);
    const worstSd = Math.max(...sds);
    const worstRange = Math.max(...ranges);
    const flipRate = totalFlips / totalRuns;

    console.log('\n  Summary');
    console.log('  ' + '─'.repeat(74));
    console.log(`  Mean SD of overall score      : ${meanSd.toFixed(2)} points`);
    console.log(`  Worst SD (single transcript)  : ${worstSd.toFixed(2)} points`);
    console.log(`  Widest spread seen            : ${worstRange} points`);
    console.log(`  Recommendation disagreement   : ${(flipRate * 100).toFixed(1)}% of runs`);

    // Thresholds are judgement calls, stated so they can be argued with —
    // there is no standard for "how stable an LLM scorer must be".
    console.log('\n  Reading');
    console.log('  ' + '─'.repeat(74));
    if (worstSd <= 3 && flipRate <= 0.1) {
      console.log('  Stable enough to rank candidates, provided a human reviews the scorecard.');
    } else if (worstSd <= 6) {
      console.log('  Moderately noisy. Scores this variable should not separate adjacent');
      console.log('  candidates — treat gaps under ~10 points as indistinguishable.');
    } else {
      console.log('  Too noisy to rank on. A candidate\'s position on the board depends');
      console.log('  materially on which run they got. Fix before relying on the ordering.');
    }
    console.log('');
    console.log('  Reliability is not validity. This says the scorer agrees with itself,');
    console.log('  not that it predicts job performance, and it is NOT a bias audit.');
    console.log('');

    if (source === 'synthetic fixtures') {
      const written = scored.find((r) => r.t.id === 'strong-detailed');
      const spoken = scored.find((r) => r.t.id === 'strong-spoken-disfluent');
      if (written && spoken) {
        const gap =
          mean(written.results.map((r) => r.overallScore)) -
          mean(spoken.results.map((r) => r.overallScore));
        console.log('  Transcription penalty check');
        console.log('  ' + '─'.repeat(74));
        console.log(
          `  Same substance, written vs raw ASR: ${gap >= 0 ? '+' : ''}${gap.toFixed(1)} points`,
        );
        console.log(
          gap > 8
            ? '  The scorer is marking down speech artefacts. Spoken candidates are penalised\n  for how they were transcribed, which hits accented speech hardest.'
            : '  Within tolerance — spoken answers are not being penalised for disfluency.',
        );
        console.log('');
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
