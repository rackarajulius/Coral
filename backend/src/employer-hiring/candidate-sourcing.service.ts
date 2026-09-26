import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../services/ai/ai.service';
import { SourceCandidatesDto } from './dto/source-candidates.dto';
import { isEmptyQuery, parseQuery } from './search-query';

const FETCH_LIMIT = 40;
/**
 * A wider net when years of experience are filtered.
 *
 * Years are computed from a profile's roles, not stored, so that filter runs
 * after the query. Without a bigger net the filter would mostly be deciding
 * how few of the first forty survive.
 */
const FETCH_LIMIT_WITH_YEARS = 160;
const TOP_N = 12;
/**
 * The most profiles read to count a pool when years are filtered.
 *
 * Years can't go in the COUNT, so each match has to be read to apply them.
 * Beyond this the answer is reported as "at least", not extrapolated.
 */
const POOL_SCAN_LIMIT = 5000;

/**
 * How many people match the search, not how many came back.
 *
 * The list is the top few, ranked; this is the size of the pool they were
 * drawn from. `exact` is false only when a years filter met a pool too large
 * to read in full, and `total` is then a floor.
 */
export interface TalentPool {
  total: number;
  exact: boolean;
}

type SourcedProfile = Prisma.JobSeekerProfileGetPayload<{
  include: {
    user: { select: { displayName: true; firstName: true; lastName: true; lastLoginAt: true } };
    experiences: true;
    educations: true;
  };
}>;

/**
 * A sourced candidate. Contact PII (email/phone) is deliberately WITHHELD —
 * it's only revealed once the candidate accepts outreach (privacy-first).
 */
export interface SourcedCandidate {
  id: string; // userId — for follow-up actions
  name: string;
  role: string;
  company: string;
  location: string;
  match: number;
  reason: string;
  initials: string;
  skills: string[];
  yearsExp: number;
  education: string;
  connection: '1st' | '2nd' | '3rd+';
  openToWork: boolean;
  lastActive: string;
}

@Injectable()
export class CandidateSourcingService {
  private readonly logger = new Logger(CandidateSourcingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async source(
    dto: SourceCandidatesDto,
  ): Promise<{ query: string; candidates: SourcedCandidate[]; pool: TalentPool }> {
    const query = (dto.query || '').trim();
    const where = this.matchWhere(dto);

    const [profiles, pool] = await Promise.all([
      this.prisma.jobSeekerProfile.findMany({
        where,
        include: {
          user: { select: { displayName: true, firstName: true, lastName: true, lastLoginAt: true } },
          experiences: { orderBy: { startDate: 'asc' } },
          educations: { orderBy: { startDate: 'desc' }, take: 1 },
        },
        take: this.hasYearsFilter(dto) ? FETCH_LIMIT_WITH_YEARS : FETCH_LIMIT,
      }),
      this.poolSize(dto, where),
    ]);

    if (profiles.length === 0) return { query, candidates: [], pool };

    const kept = this.hasYearsFilter(dto)
      ? profiles.filter((p) => this.withinYears(dto, this.yearsExp(p.experiences)))
      : profiles;
    if (kept.length === 0) return { query, candidates: [], pool };

    const candidates = kept.map((p) => this.toCandidate(p));
    const ranked = await this.rank(query || 'general role', candidates, kept);
    return { query, candidates: ranked, pool };
  }

  /**
   * Everyone the same filters match, from the same `matchWhere`.
   *
   * A separate query would drift from the list, and "348 match" would stop
   * describing the people on screen.
   */
  private async poolSize(
    dto: SourceCandidatesDto,
    where: Prisma.JobSeekerProfileWhereInput,
  ): Promise<TalentPool> {
    const matching = await this.prisma.jobSeekerProfile.count({ where });
    if (!this.hasYearsFilter(dto) || matching === 0) return { total: matching, exact: true };

    const rows = await this.prisma.jobSeekerProfile.findMany({
      where,
      select: { experiences: { select: { startDate: true } } },
      take: POOL_SCAN_LIMIT,
    });
    const total = rows.filter((r) => this.withinYears(dto, this.yearsExp(r.experiences))).length;
    return { total, exact: matching <= POOL_SCAN_LIMIT };
  }

  /**
   * Who counts as a match, in one place.
   *
   * Both the workspace and the scheduled watcher filter through this. If they
   * built the query separately they would drift, and a notification saying
   * "3 new matches" would open onto a different set of people.
   */
  private matchWhere(dto: SourceCandidatesDto): Prisma.JobSeekerProfileWhereInput {
    const parsed = parseQuery(dto.query || '');

    /**
     * Everything goes in one AND list rather than as sibling keys.
     *
     * A `where` object can only carry one `OR`, so building this as spread
     * properties meant the location filter silently overwrote the "has
     * something on their profile" guard, and the industry filter then
     * overwrote the location. Nothing errored; the query just quietly stopped
     * meaning what it said.
     */
    const and: Prisma.JobSeekerProfileWhereInput[] = [
      /**
       * Something to show. An all-but-empty profile in a result list helps
       * nobody and exposes someone who has barely signed up.
       */
      {
        OR: [
          { skills: { isEmpty: false } },
          { headline: { not: null } },
          { currentTitle: { not: null } },
        ],
      },
      ...parsed.all.map((t) => this.termWhere(t)),
      ...parsed.any.map((group) => ({ OR: group.map((t) => this.termWhere(t)) })),
      // Every named skill, not any of them: a filter the recruiter set
      // explicitly is a requirement, unlike words in the free text.
      ...(dto.skills ?? []).map(
        (skill) =>
          ({
            skillsNormalized: { has: skill.trim().toLowerCase() },
          }) as Prisma.JobSeekerProfileWhereInput,
      ),
      ...(dto.location?.trim()
        ? [
            {
              OR: [
                { city: { contains: dto.location.trim(), mode: 'insensitive' as const } },
                { country: { contains: dto.location.trim(), mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
      ...(dto.industry?.trim()
        ? [
            {
              OR: [
                { industry: { contains: dto.industry.trim(), mode: 'insensitive' as const } },
                { preferredIndustries: { has: dto.industry.trim() } },
              ],
            },
          ]
        : []),
    ];

    return {
      /**
       * Everyone, unless they turned it off.
       *
       * `openToWork` used to gate this, which meant nobody passive was ever
       * found. It is now a badge and a ranking signal; `discoverable` decides.
       */
      discoverable: true,
      /**
       * Someone who hid their profile has already opted out in substance.
       * Without this, search results would show a name, role and skill list for
       * a person whose full profile the platform refuses to open.
       *
       * Written as an OR so a profile that has never touched privacy settings
       * — where the column is NULL — still counts as visible. A bare JSON path
       * filter does not match NULL, and would have hidden almost everyone.
       */
      OR: [
        { privacySettings: { equals: Prisma.DbNull } },
        { privacySettings: { path: ['profileVisible'], not: false } },
      ],
      ...(parsed.none.length ? { NOT: { OR: parsed.none.map((t) => this.termWhere(t)) } } : {}),
      ...(dto.openToWorkOnly ? { openToWork: true } : {}),
      ...(dto.seniority?.trim()
        ? { experienceLevel: { contains: dto.seniority.trim(), mode: 'insensitive' as const } }
        : {}),
      ...(dto.remoteOnly ? { remoteWork: true } : {}),
      AND: and,
    };
  }

  /**
   * One term, matched anywhere it could reasonably appear.
   *
   * Terms arrive lower-cased, so the skills branch reads the normalised
   * mirror; the text columns compare case-insensitively themselves.
   */
  private termWhere(term: string): Prisma.JobSeekerProfileWhereInput {
    return {
      OR: [
        { skillsNormalized: { has: term } },
        { headline: { contains: term, mode: 'insensitive' } },
        { currentTitle: { contains: term, mode: 'insensitive' } },
        { currentCompany: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
      ],
    };
  }

  /** True when years of experience were asked about. */
  private hasYearsFilter(dto: SourceCandidatesDto): boolean {
    return dto.minYears !== undefined || dto.maxYears !== undefined;
  }

  /** Applied after the query, because years are computed and not stored. */
  private withinYears(dto: SourceCandidatesDto, years: number): boolean {
    if (dto.minYears !== undefined && years < dto.minYears) return false;
    if (dto.maxYears !== undefined && years > dto.maxYears) return false;
    return true;
  }

  /**
   * Matching candidate ids only — no AI, no ranking.
   *
   * The watcher needs to know *whether* the set changed, not how to order it.
   * Ranking costs an AI call per run per watcher and answers a question nobody
   * has asked yet; it happens when someone opens the workspace and looks.
   */
  async matchingIds(dto: SourceCandidatesDto): Promise<string[]> {
    /**
     * A search that asked for nothing matches nobody, not everybody.
     *
     * This feeds the saved-search watcher, which tells an employer "N new
     * matches". A shortlist saved with an empty query would otherwise return
     * every discoverable profile — and since discovery became the default,
     * that is every new sign-up on the platform, announced to an employer who
     * never asked about them.
     *
     * Only here. Someone who opens the workspace and browses with no query is
     * asking to see who is around, and should get an answer.
     */
    if (this.asksForNothing(dto)) return [];

    const rows = await this.prisma.jobSeekerProfile.findMany({
      where: this.matchWhere(dto),
      // Years are computed, so the watcher needs the roles to apply them.
      select: this.hasYearsFilter(dto)
        ? { userId: true, experiences: { select: { startDate: true, endDate: true, current: true } } }
        : { userId: true },
      take: this.hasYearsFilter(dto) ? FETCH_LIMIT_WITH_YEARS : FETCH_LIMIT,
    });
    if (!this.hasYearsFilter(dto)) return rows.map((r) => r.userId);
    return rows
      .filter((r) => this.withinYears(dto, this.yearsExp((r as { experiences?: [] }).experiences ?? [])))
      .map((r) => r.userId);
  }

  /** True when neither the query nor any filter narrows anything. */
  private asksForNothing(dto: SourceCandidatesDto): boolean {
    if (!isEmptyQuery(parseQuery(dto.query || ''))) return false;
    return !(
      dto.skills?.length ||
      dto.location?.trim() ||
      dto.seniority?.trim() ||
      dto.industry?.trim() ||
      dto.remoteOnly ||
      dto.openToWorkOnly ||
      this.hasYearsFilter(dto)
    );
  }

  private keywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
      .slice(0, 8);
  }

  private toCandidate(p: SourcedProfile): SourcedCandidate {
    const name =
      p.user.displayName || [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || 'Candidate';
    const edu = p.educations[0];
    return {
      id: p.userId,
      name,
      role: p.currentTitle || p.headline || 'Professional',
      company: p.currentCompany || '',
      location: [p.city, p.country].filter(Boolean).join(', '),
      match: 0, // filled by rank()
      reason: '',
      initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      skills: (p.skills ?? []).slice(0, 8),
      yearsExp: this.yearsExp(p.experiences),
      education: edu ? [edu.degree, edu.institution].filter(Boolean).join(' · ') : '',
      connection: '3rd+',
      openToWork: true,
      lastActive: this.relative(p.user.lastLoginAt ?? p.updatedAt),
    };
  }

  private async rank(
    role: string,
    candidates: SourcedCandidate[],
    profiles: SourcedProfile[],
  ): Promise<SourcedCandidate[]> {
    const byId = new Map(profiles.map((p) => [p.userId, p]));
    const aiById = new Map<string, { score: number; reason: string }>();
    try {
      const scores = await this.ai.scoreCandidates(
        role,
        candidates.map((c) => {
          const p = byId.get(c.id);
          const experience = (p?.experiences ?? [])
            .slice(0, 4)
            .map((e) => `${e.title} @ ${e.company}`)
            .join('; ');
          return { id: c.id, headline: c.role, skills: c.skills, experience };
        }),
      );
      for (const s of scores) aiById.set(s.id, { score: s.score, reason: s.reason });
    } catch (err) {
      this.logger.warn(`AI candidate scoring unavailable, using heuristic: ${err instanceof Error ? err.message : err}`);
    }

    return candidates
      .map((c) => {
        const ai = aiById.get(c.id);
        return {
          ...c,
          match: ai?.score ?? this.heuristic(role, c),
          reason: ai?.reason || `${c.yearsExp}+ yrs · ${c.skills.slice(0, 3).join(', ')}`,
        };
      })
      .sort((a, b) => b.match - a.match)
      .slice(0, TOP_N);
  }

  private heuristic(role: string, c: SourcedCandidate): number {
    const terms = this.keywords(role);
    const hay = `${c.role} ${c.skills.join(' ')}`.toLowerCase();
    const hits = terms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
    return Math.min(95, 50 + hits * 10);
  }

  private yearsExp(experiences: { startDate: Date | null }[]): number {
    const starts = experiences.map((e) => e.startDate).filter((d): d is Date => !!d);
    if (starts.length === 0) return 0;
    const earliest = Math.min(...starts.map((d) => d.getTime()));
    return Math.max(0, Math.round((Date.now() - earliest) / (365.25 * 24 * 3600 * 1000)));
  }

  private relative(d: Date): string {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }
}
