import { Injectable } from '@nestjs/common';
import { PipelineStage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyContextService } from '../company/company-context.service';
import { User } from '../common/types/user.types';
import {
  PIPELINE_LADDER,
  PIPELINE_STAGE_LABELS,
  stageFromApplicationStatus,
  statusForStage,
} from '../common/pipeline-stage';
import { PipelineQueryDto } from './dto/pipeline-query.dto';

/** One row of the merged board, before its fields are filled in. */
interface PipelineKey {
  id: string;
  source: 'applied' | 'sourced';
  sort_date: Date;
  match_score: number | null;
}

/** How a sourced card was captured at shortlist time. */
interface Snapshot {
  name?: string;
  role?: string;
  company?: string;
  location?: string;
  skills?: string[];
  match?: number;
  education?: string;
  initials?: string;
}

const MAX_LIMIT = 100;

/**
 * The one candidate board: people who applied and people the company went out
 * and found, in a single list.
 *
 * There used to be two boards with two vocabularies. Linking them (see
 * PipelineLinkService) stopped them contradicting each other; this is what
 * makes them one list. A sourced card whose application has arrived is
 * **excluded** here — its application is already in the list, and showing both
 * is the duplication the link exists to remove.
 *
 * Paging is the reason this is one SQL query rather than two fetches merged in
 * the browser: sorting and filtering run across the whole pipeline, and merging
 * page 1 of each source would rank only what happened to be fetched. The union
 * returns identities in the right order, and the rows are then hydrated from
 * each table.
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyContext: CompanyContextService,
  ) {}

  async list(actor: User, query: PipelineQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), MAX_LIMIT);
    const offset = (page - 1) * limit;
    // Resolved once: the member ids scope the board, the company id scopes tags.
    const context = await this.companyContext.forUser(actor.id);
    const memberIds = context?.memberUserIds ?? [actor.id];
    const companyId = context?.companyId ?? null;

    const tagLabels = [...new Set(this.csv(query.tags).map((t) => t.toLowerCase()))].slice(0, 20);
    // Tags belong to a company. Someone with none has no tagged candidates, so
    // asking for a tag finds nobody rather than being silently ignored.
    if (tagLabels.length > 0 && !companyId) {
      return { candidates: [], page, total: 0, totalPages: 1 };
    }
    /**
     * A tag is on the person, not on a row, so one condition on candidate_id
     * narrows applicants and sourced cards alike — and since every row of a
     * person carries the same tags, filtering before the dedupe below gives the
     * same answer as filtering after it.
     */
    const tagFilter =
      tagLabels.length > 0
        ? Prisma.sql`WHERE u.candidate_id IN (
            SELECT ct.candidate_id FROM candidate_tags ct
             WHERE ct.company_id = ${companyId}
               AND lower(ct.label) IN (${Prisma.join(tagLabels)}))`
        : Prisma.empty;

    const stages = this.requestedStages(query.stage);
    const search = query.q?.trim() ? `%${query.q.trim()}%` : null;
    const jobIds = this.csv(query.jobId);
    const wantApplied = query.source !== 'sourced';
    /**
     * A job filter has no meaning for someone who never applied to a job, so
     * filtering by job excludes sourced candidates rather than silently
     * showing them as if they had applied to it.
     */
    const wantSourced = query.source !== 'applied' && jobIds.length === 0;

    const appliedWhere = this.appliedConditions({
      memberIds,
      stages,
      jobIds,
      search,
      includeRejected: query.includeRejected === 'true',
    });
    const sourcedWhere = this.sourcedConditions({ memberIds, stages, search });

    const union = Prisma.join(
      [
        ...(wantApplied
          ? [
              Prisma.sql`
                SELECT a.id::text AS id,
                       'applied'::text AS source,
                       a.applicant_id::text AS candidate_id,
                       a.applied_at AS sort_date,
                       a.match_score AS match_score,
                       0 AS stage_rank
                  FROM applications a
                  JOIN jobs j ON j.id = a.job_id
                 WHERE ${appliedWhere}`,
            ]
          : []),
        ...(wantSourced
          ? [
              Prisma.sql`
                SELECT si.id::text AS id,
                       'sourced'::text AS source,
                       si.candidate_id::text AS candidate_id,
                       si.added_at AS sort_date,
                       NULLIF(si.snapshot->>'match', '')::int AS match_score,
                       ${this.ladderRankSql()} AS stage_rank
                  FROM shortlist_items si
                  JOIN shortlists sl ON sl.id = si.shortlist_id
                 WHERE ${sourcedWhere}`,
            ]
          : []),
      ],
      ' UNION ALL ',
    );

    // Neither side was asked for — say so without running an empty UNION.
    if (!wantApplied && !wantSourced) {
      return { candidates: [], page, total: 0, totalPages: 1 };
    }

    /**
     * Match sorts nulls last: a sourced card with no score, or an application
     * to a job that lists no skills, has an unknown score rather than a bad
     * one, and does not belong at the top of a "best first" list.
     */
    const orderBy =
      query.sort === 'match'
        ? Prisma.sql`ORDER BY match_score DESC NULLS LAST, sort_date DESC`
        : Prisma.sql`ORDER BY sort_date DESC`;

    /**
     * One row per person, except where duplication means something.
     *
     * Applications are kept as they are: two applications are two real
     * decisions about two jobs, and collapsing them would hide one. Sourcing
     * records are not like that — a shortlist is a saved search, so the same
     * person turning up in "Go engineers" and "Backend engineers" is one
     * candidate found twice, and the board showed them twice.
     *
     * So: every application survives; a sourced card survives only if it is the
     * furthest along for that person AND they have no application here, because
     * an application is the stronger record of the same relationship.
     *
     * This is a dedupe, not a fix for the cause. Once a project is a real folder
     * rather than a saved search, two rows would mean two genuine pipelines and
     * this rule should be revisited.
     */
    const deduped = Prisma.sql`
      SELECT id, source, sort_date, match_score
        FROM (
          SELECT u.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY u.candidate_id
                   ORDER BY u.stage_rank DESC, u.sort_date DESC, u.id
                 ) AS rn,
                 BOOL_OR(u.source = 'applied') OVER (PARTITION BY u.candidate_id) AS has_application
            FROM (${union}) AS u
            ${tagFilter}
        ) AS m
       WHERE m.source = 'applied' OR (NOT m.has_application AND m.rn = 1)`;

    const [keys, counted] = await Promise.all([
      this.prisma.$queryRaw<PipelineKey[]>`
        SELECT id, source, sort_date, match_score
          FROM (${deduped}) AS merged
          ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`,
      // ::int because a raw COUNT() comes back as BigInt, which does not
      // survive JSON.stringify and 500s the response. The count runs over the
      // same deduped set, or the board would page through a total it never shows.
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM (${deduped}) AS merged`,
    ]);

    const total = counted[0]?.total ?? 0;
    const candidates = await this.hydrate(keys, companyId);

    return {
      candidates,
      page,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  /**
   * A sourced card's position on the ladder, as SQL.
   *
   * Generated from PIPELINE_LADDER rather than written out, so adding a rung
   * cannot leave the database ranking by a stale list. Exits score -1: being
   * rejected is not further along than being interviewed, so a rejected card
   * never wins the "furthest along" tie-break against a live one.
   */
  private ladderRankSql(): Prisma.Sql {
    const cases = PIPELINE_LADDER.map(
      (stage, i) => Prisma.sql`WHEN si.stage = ${stage}::"PipelineStage" THEN ${i}`,
    );
    return Prisma.sql`(CASE ${Prisma.join(cases, ' ')} ELSE -1 END)`;
  }

  /** Board stages the caller asked for, ignoring anything unrecognised. */
  private requestedStages(raw?: string): PipelineStage[] {
    const wanted = this.csv(raw).map((s) => s.trim().toUpperCase());
    return Object.values(PipelineStage).filter((s) => wanted.includes(s));
  }

  private csv(value?: string): string[] {
    return (value ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private appliedConditions(input: {
    memberIds: string[];
    stages: PipelineStage[];
    jobIds: string[];
    search: string | null;
    includeRejected: boolean;
  }): Prisma.Sql {
    const parts: Prisma.Sql[] = [
      Prisma.sql`j.posted_by_id IN (${Prisma.join(input.memberIds)})`,
    ];

    /**
     * Filtered on `status`, which is what the board actually displays.
     *
     * This used to filter `applications.stage` — a legacy column holding
     * "Application Sent" — against board stage names, so picking any stage
     * chip returned nothing and emptied the board.
     */
    if (input.stages.length > 0) {
      const statuses = input.stages
        .map((s) => statusForStage(s))
        .filter((s): s is string => !!s);
      // A stage with no matching status (SOURCED, CONTACTED) cannot describe an
      // application, so asking only for those means no applicants match.
      parts.push(
        statuses.length > 0
          ? Prisma.sql`a.status IN (${Prisma.join(statuses)})`
          : Prisma.sql`FALSE`,
      );
    }

    if (input.jobIds.length > 0) {
      parts.push(Prisma.sql`a.job_id IN (${Prisma.join(input.jobIds)})`);
    }
    if (!input.includeRejected && !input.stages.includes(PipelineStage.REJECTED)) {
      parts.push(Prisma.sql`a.status <> 'rejected'`);
    }
    if (input.search) {
      parts.push(Prisma.sql`(
        EXISTS (
          SELECT 1 FROM users u
           WHERE u.id = a.applicant_id
             AND (u.display_name ILIKE ${input.search}
               OR u.first_name ILIKE ${input.search}
               OR u.last_name ILIKE ${input.search}
               OR u.email ILIKE ${input.search})
        )
        OR j.title ILIKE ${input.search}
      )`);
    }
    return Prisma.join(parts, ' AND ');
  }

  private sourcedConditions(input: {
    memberIds: string[];
    stages: PipelineStage[];
    search: string | null;
  }): Prisma.Sql {
    const parts: Prisma.Sql[] = [
      Prisma.sql`sl.employer_id IN (${Prisma.join(input.memberIds)})`,
      // Saved-but-not-in-the-pipeline is a bookmark, not a board entry.
      Prisma.sql`si.stage IS NOT NULL`,
      // Their application is already in this list; showing the card too is the
      // duplication the link exists to remove.
      Prisma.sql`si.application_id IS NULL`,
    ];

    if (input.stages.length > 0) {
      parts.push(
        Prisma.sql`si.stage IN (${Prisma.join(input.stages.map((s) => Prisma.sql`${s}::"PipelineStage"`))})`,
      );
    } else {
      // Matches the applicant side, which hides rejections unless asked for.
      parts.push(Prisma.sql`si.stage <> 'REJECTED'::"PipelineStage"`);
    }

    if (input.search) {
      parts.push(Prisma.sql`(
        si.snapshot->>'name' ILIKE ${input.search}
        OR si.snapshot->>'role' ILIKE ${input.search}
        OR si.snapshot->>'company' ILIKE ${input.search}
      )`);
    }
    return Prisma.join(parts, ' AND ');
  }

  /** Fills in the page's rows from whichever table each one came from. */
  private async hydrate(keys: PipelineKey[], companyId: string | null) {
    const appliedIds = keys.filter((k) => k.source === 'applied').map((k) => k.id);
    const sourcedIds = keys.filter((k) => k.source === 'sourced').map((k) => k.id);

    const [applications, items] = await Promise.all([
      appliedIds.length
        ? this.prisma.application.findMany({
            where: { id: { in: appliedIds } },
            include: {
              job: { select: { id: true, title: true, skills: true } },
              applicant: {
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  jobSeekerProfile: {
                    select: {
                      phone: true,
                      currentTitle: true,
                      currentCompany: true,
                      city: true,
                      country: true,
                      skills: true,
                      summary: true,
                    },
                  },
                },
              },
            },
          })
        : [],
      sourcedIds.length
        ? this.prisma.shortlistItem.findMany({
            where: { id: { in: sourcedIds } },
            include: { shortlist: { select: { name: true, roleTitle: true, query: true } } },
          })
        : [],
    ]);

    // The company's tags for the people on this page, so cards can show them
    // and a filtered board can be seen to be filtered. Company-private — this
    // board is never shown to a candidate.
    const people = [...new Set([...applications.map((a) => a.applicant.id), ...items.map((i) => i.candidateId)])];
    const tagRows =
      companyId && people.length
        ? await this.prisma.candidateTag.findMany({
            where: { companyId, candidateId: { in: people } },
            select: { candidateId: true, label: true },
            orderBy: { label: 'asc' },
          })
        : [];
    const tagsFor = new Map<string, string[]>();
    for (const t of tagRows) tagsFor.set(t.candidateId, [...(tagsFor.get(t.candidateId) ?? []), t.label]);

    const byId = new Map<string, unknown>();
    for (const a of applications) byId.set(a.id, { ...this.shapeApplied(a), tags: tagsFor.get(a.applicant.id) ?? [] });
    for (const i of items) byId.set(i.id, { ...this.shapeSourced(i), tags: tagsFor.get(i.candidateId) ?? [] });

    // Kept in the order the union decided, not the order the fetches returned.
    return keys.map((k) => byId.get(k.id)).filter(Boolean);
  }

  private shapeApplied(a: {
    id: string;
    status: string;
    matchScore: number | null;
    appliedAt: Date;
    resumeUrl: string | null;
    job: { id: string; title: string; skills: string[] };
    applicant: {
      id: string;
      email: string;
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
      jobSeekerProfile: {
        phone: string | null;
        currentTitle: string | null;
        currentCompany: string | null;
        city: string | null;
        country: string | null;
        skills: string[];
        summary: string | null;
      } | null;
    };
  }) {
    const p = a.applicant.jobSeekerProfile;
    const name =
      a.applicant.displayName ||
      [a.applicant.firstName, a.applicant.lastName].filter(Boolean).join(' ') ||
      'Candidate';
    const wanted = new Set(a.job.skills.map((s) => s.toLowerCase()));

    return {
      id: a.id,
      source: 'applied' as const,
      applicantId: a.applicant.id,
      jobId: a.job.id,
      name,
      initials: this.initials(name),
      // Applying shared these deliberately, so the board may show them.
      email: a.applicant.email,
      phone: p?.phone ?? '',
      currentRole: p?.currentTitle ?? '',
      currentCompany: p?.currentCompany ?? '',
      role: a.job.title,
      location: [p?.city, p?.country].filter(Boolean).join(', '),
      stage: PIPELINE_STAGE_LABELS[stageFromApplicationStatus(a.status)],
      matchScore: a.matchScore,
      appliedDate: a.appliedAt.toISOString(),
      status: a.status === 'withdrawn' ? 'Withdrawn' : 'Active',
      skills: (p?.skills ?? []).map((n) => ({
        name: n,
        ...(wanted.has(n.toLowerCase()) ? { match: 100 } : {}),
      })),
      summary: p?.summary ?? '',
      resumeUrl: a.resumeUrl ?? undefined,
    };
  }

  private shapeSourced(i: {
    id: string;
    candidateId: string;
    stage: PipelineStage | null;
    snapshot: Prisma.JsonValue;
    addedAt: Date;
    shortlist: { name: string | null; roleTitle: string | null; query: string | null };
  }) {
    const s = (i.snapshot ?? {}) as Snapshot;
    const name = s.name || 'Candidate';

    return {
      id: `sourced:${i.id}`,
      source: 'sourced' as const,
      applicantId: i.candidateId,
      // No job: they never applied to one, and pretending otherwise would put
      // them in a job's screening round they never entered.
      jobId: undefined,
      name,
      initials: s.initials || this.initials(name),
      /**
       * Withheld, not missing. A sourced candidate has not shared anything with
       * this company — outreach goes through the platform until they answer.
       */
      email: '',
      phone: '',
      currentRole: s.role ?? '',
      currentCompany: s.company ?? '',
      /**
       * What they were sourced for, so the row is not blank where the
       * applicant rows name a job.
       *
       * The project name wins: a team that has named one means that name,
       * over a role the AI inferred or the raw words someone typed.
       */
      role: i.shortlist.name?.trim() || i.shortlist.roleTitle?.trim() || i.shortlist.query || 'Sourced',
      location: s.location ?? '',
      stage: PIPELINE_STAGE_LABELS[i.stage ?? PipelineStage.SOURCED],
      matchScore: typeof s.match === 'number' ? s.match : null,
      /** When they entered the pipeline. They have no application date. */
      appliedDate: i.addedAt.toISOString(),
      status: 'Active' as const,
      skills: (s.skills ?? []).map((n) => ({ name: n })),
      summary: '',
      resumeUrl: undefined,
    };
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
