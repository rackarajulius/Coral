import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService, ParsedResume } from '../services/ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { isPremiumUser, isPremiumEnforced } from '../auth/guards/premium.guard';
import { SeekerEntitlementsService } from '../seeker-entitlements/seeker-entitlements.service';
import { User } from '../common/types/user.types';
import { RunMatchDto } from './dto/run-match.dto';
import { AssistDto } from './dto/assist.dto';
import { DismissMatchDto } from './dto/dismiss-match.dto';
import { PlatformJobSource } from './job-sources/platform.source';
import { AdzunaJobSource } from './job-sources/adzuna.source';
import { JSearchJobSource } from './job-sources/jsearch.source';
import { GreenhouseJobSource } from './job-sources/greenhouse.source';
import { LeverJobSource } from './job-sources/lever.source';
import { AshbyJobSource } from './job-sources/ashby.source';
import {
  CandidateJob,
  EmploymentType,
  JobSource,
  JobSourceName,
  SearchInput,
  Workplace,
  YearlyPay,
  normalizeName,
} from './job-sources/types';
import { CompanyLogoService } from './company-logos.service';
import { CitiesService } from '../locations/cities.service';
import { RoleTranslationService } from './role-translation.service';
import { jobAdLanguage, languageName } from './job-ad-language';
import { jobDigest } from './job-digest';

const MAX_PER_SOURCE = 15;
/**
 * How long a search waits for a role's local title. Only the first search of
 * a role in a language asks the AI (a second or two); later ones read it from
 * the table. A slower answer is kept for the next search.
 */
const LOCAL_TITLE_WAIT_MS = 4000;
/** A description shorter than this is a snippet (Adzuna's are 500 characters), not the ad. */
const SNIPPET_CHARS = 600;
/** The best score a job known only by its snippet can get. */
const SNIPPET_MAX_SCORE = 80;
/** A background search (a job alert) waits for slow sources as long as they take to answer at all. */
const BACKGROUND_WAIT_MS = 45_000;
/** And for logos still loading after it, a little longer than a person would. */
const BACKGROUND_LOGO_WAIT_MS = 5000;
/**
 * Every scored job is returned, so the page's filters (remote, job type, pay,
 * date) have the whole set to narrow rather than only the top 20.
 */
const MAX_TO_SCORE = 30;
/** Dismissed matches remembered per person, newest first. */
const MAX_DISMISSED = 1000;
/** How long a search will wait past scoring for logos still loading. */
const LOGO_GRACE_MS = 1500;

/**
 * Where a listing was published, and whether that is the employer's own site:
 * JSearch names TD Bank's careers site "TD Bank", and Scotiabank's
 * "Scotiabank". Long names are cut so the badge stays a badge.
 */
function publishedOn(publisher: string, company: string): { name: string; isEmployer: boolean } {
  const site = normalizeName(publisher);
  const employer = normalizeName(company);
  // "TD Bank Careers" is TD Bank's own site; "TD Bank" is not a company called "Bank".
  const isEmployer = !!site && !!employer && (site === employer || site.startsWith(`${employer} `));
  const name = publisher.length > 30 ? `${publisher.slice(0, 29).trimEnd()}…` : publisher;
  return { name, isEmployer };
}

/** "Senior Engineer" at "Acme Inc." and "senior engineer" at "ACME" are one job. */
function sameJobKey(title: string, company: string): string {
  return `${title.toLowerCase().replace(/\s+/g, ' ').trim()}|${normalizeName(company)}`;
}

/** Waits for `work`, but no longer than `ms`. */
async function settleWithin(work: Promise<unknown>, ms: number): Promise<void> {
  await answerWithin(work, ms);
}

/** What `work` answers, or undefined if it takes longer than `ms`. */
async function answerWithin<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([work, new Promise<undefined>((done) => (timer = setTimeout(() => done(undefined), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

export interface ResumeMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  source: CandidateJob['source'];
  matchScore: number;
  scoringMode: 'ai' | 'heuristic';
  reason?: string;
  url?: string;
  salary?: string;
  description?: string; // truncated — powers cover-letter / tailoring
  /** The employer's logo, when there is a real one. The card shows a letter otherwise. */
  logoUrl?: string;
  /**
   * Where the listing was published, when the source says (JSearch).
   * `isEmployer` when that is the company's own careers site.
   */
  publishedOn?: { name: string; isEmployer: boolean };
  /** When it was posted (ISO), when the source says. */
  postedAt?: string;
  employmentType?: EmploymentType;
  workplace?: Workplace;
  /** Pay as a yearly range, for sorting and filtering by pay. */
  yearlyPay?: YearlyPay;
}

interface Candidate {
  parsed: ParsedResume;
  currentTitle: string;
  city: string;
  country: string;
}

@Injectable()
export class ResumeMatcherService {
  private readonly logger = new Logger(ResumeMatcherService.name);
  private readonly sources: JobSource[];

  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: SeekerEntitlementsService,
    platform: PlatformJobSource,
    adzuna: AdzunaJobSource,
    jsearch: JSearchJobSource,
    greenhouse: GreenhouseJobSource,
    lever: LeverJobSource,
    ashby: AshbyJobSource,
    private readonly logos: CompanyLogoService,
    private readonly cities: CitiesService,
    private readonly translations: RoleTranslationService,
  ) {
    this.sources = [platform, adzuna, jsearch, greenhouse, lever, ashby];
  }

  /** Whether the user can use the matcher (open in dev; premium when enforced). */
  getAccess(user: User) {
    return { isPremium: !isPremiumEnforced(this.config, 'matcher.web') || isPremiumUser(user) };
  }

  /**
   * Matches the signed-in seeker's stored profile (from onboarding) to jobs.
   * `visitorCountry` is where the request came from, when the CDN says: the
   * last way of knowing which country to search.
   */
  async run(user: User, dto: RunMatchDto, context: { visitorCountry?: string } = {}) {
    const candidate = await this.loadCandidate(user);
    if (!candidate) {
      return {
        hasProfile: false,
        query: (dto.query || '').trim(),
        matches: [] as ResumeMatch[],
        scope: 'platform' as const,
        webBlockedReason: null,
        searchedSources: [] as JobSourceName[],
        unavailableSources: [] as JobSourceName[],
      };
    }

    const query = this.buildQuery(candidate, dto.query);
    const location = this.buildLocation(candidate, dto);
    const homeCountryCode = this.homeCountry(candidate, context.visitorCountry);
    const { search, language } = await this.planSearch(query, location, dto.countryCode, homeCountryCode);
    const { countryCode, localQuery } = search;

    /**
     * Platform jobs for everyone; the web for Premium.
     *
     * Free users used to be refused the matcher outright. Now they get what
     * the free tier promises — jobs posted here, which cost no outside data —
     * and web sources join only when the allowance covers them. While
     * enforcement is off that is everyone, and the use is still counted, so
     * the numbers are real before anyone is charged.
     */
    const web = await this.entitlements.status(user, 'matcher.web');
    const webAllowed = !web.enforced || web.allowed;
    const enabled = this.sources.filter(
      (s) => s.isEnabled() && (s.name === 'platform' || webAllowed),
    );
    const usedWeb = enabled.some((s) => s.name !== 'platform');

    const settled = await Promise.allSettled(enabled.map((s) => s.search(search)));
    const results = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      this.logger.warn(`Source ${enabled[i].name} failed: ${r.reason}`);
      return [];
    });
    const notWanted = await this.dismissedFilter(user.id);
    const candidates = this.selectCandidates(
      results.map((jobs) => jobs.filter((j) => !notWanted(j) && this.inCountry(j, countryCode))),
    );
    const hasWebResults = results.some((jobs, i) => enabled[i].name !== 'platform' && jobs.length > 0);

    // Logos are looked up while the jobs are scored, which usually takes
    // longer. Whatever is ready when scoring ends, after a short grace, is
    // shown; the rest is cached for the next search.
    const subjects = new Map(
      candidates
        .filter((c) => !c.logoUrl)
        .map((c) => [
          c.id,
          { domain: c.companyDomain, company: c.company, imageUrl: c.logoImageUrl, byName: c.source !== 'platform' },
        ]),
    );
    const logosLoaded = this.logos.prefetch([...subjects.values()]);
    const ranked = await this.scoreAndRank(candidate.parsed, candidates);
    await settleWithin(logosLoaded, LOGO_GRACE_MS);
    const matches = ranked.map((m) => {
      const subject = subjects.get(m.id);
      const logoUrl = m.logoUrl ?? (subject && this.logos.logoFor(subject));
      return logoUrl ? { ...m, logoUrl } : m;
    });
    if (hasWebResults) await this.entitlements.record(user.id, 'matcher.web');

    return {
      hasProfile: true,
      query,
      /**
       * Where was searched ("" = anywhere in the country), so the page can
       * show it in the location box: "Ontario, Canada" for a profile that
       * says "ONTARIO CANADA".
       */
      location: search.location,
      countryCode,
      /** The person's own country: what an empty location box searches, so the page can name it. */
      homeCountryCode,
      /** The role as local job ads write it, searched as well, so the page can say so. */
      ...(localQuery && language ? { localQuery, localLanguage: languageName(language) } : {}),
      matches,
      /**
       * What was searched, so the page can say so. `platform` with a reason
       * means web results were withheld, not that the web had nothing.
       */
      scope: usedWeb ? ('web' as const) : ('platform' as const),
      webBlockedReason: usedWeb ? null : web.reason,
      /**
       * Which sources were asked, and which could not be reached. With no
       * matches, the page said to add more to your profile even when every
       * source had failed or none was set up; this lets it say what happened.
       */
      searchedSources: enabled.map((s) => s.name),
      unavailableSources: enabled.filter((_, i) => settled[i].status === 'rejected').map((s) => s.name),
    };
  }

  /**
   * Web jobs for a role and place, found as a search here finds them, but not
   * scored: job alerts check in the background, and can't spend the shared AI
   * allowance on every check. Jobs the person dismissed, or clearly in another
   * country, are left out. Null when their plan doesn't include the web.
   *
   * The plan decides, not the day's search allowance: those searches are the
   * person's own, and an alert that skipped the day they searched a lot would
   * miss jobs for good. Alerts have their own budget.
   */
  async findWebJobs(
    person: Pick<User, 'id' | 'role' | 'subscriptionTier'>,
    input: { query: string; location: string },
    options: { without?: JobSourceName[] } = {},
  ): Promise<{ jobs: CandidateJob[]; searched: JobSourceName[] } | null> {
    // The tier is read from these fields only.
    if (this.entitlements.isEnforced('matcher.web') && this.entitlements.tierOf(person as User) !== 'premium') return null;

    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: person.id },
      select: { city: true, country: true },
    });
    const home = this.homeCountry({ city: profile?.city ?? '', country: profile?.country ?? '' });
    const { search } = await this.planSearch(input.query, input.location.trim(), undefined, home);
    const sources = this.sources.filter(
      (s) => s.name !== 'platform' && !options.without?.includes(s.name) && s.isEnabled(),
    );
    // Nobody is waiting on a background check, so a slow source gets its full time.
    const settled = await Promise.allSettled(sources.map((s) => s.search({ ...search, waitMs: BACKGROUND_WAIT_MS })));
    const results = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      this.logger.warn(`Source ${sources[i].name} failed for an alert: ${r.reason}`);
      return [];
    });
    const notWanted = await this.dismissedFilter(person.id);
    const jobs = this.selectCandidates(
      results.map((list) => list.filter((j) => !notWanted(j) && this.inCountry(j, search.countryCode))),
    );

    const subjects = new Map(
      jobs
        .filter((j) => !j.logoUrl)
        .map((j) => [j.id, { domain: j.companyDomain, company: j.company, imageUrl: j.logoImageUrl, byName: true }]),
    );
    await settleWithin(this.logos.prefetch([...subjects.values()]), BACKGROUND_LOGO_WAIT_MS);
    return {
      jobs: jobs.map((j) => {
        const subject = subjects.get(j.id);
        const logoUrl = j.logoUrl ?? (subject && this.logos.logoFor(subject));
        return logoUrl ? { ...j, logoUrl } : j;
      }),
      searched: sources.map((s) => s.name),
    };
  }

  /**
   * How to search for a role in a place: its country, its province or state,
   * the role in the local language where ads aren't in English (searched as
   * well: "nurse" alone found 1% of Germany's nursing ads), and the currency.
   */
  private async planSearch(
    query: string,
    location: string,
    chosenCountry: string | undefined,
    home: string | undefined,
  ): Promise<{ search: SearchInput; language: string | undefined }> {
    const place = this.placeOf(location, chosenCountry, home);
    const { countryCode } = place;
    const language = jobAdLanguage(countryCode, place.region);
    const localQuery = language
      ? await answerWithin(this.translations.localTitle(query, language), LOCAL_TITLE_WAIT_MS)
      : undefined;
    return {
      language,
      search: {
        query,
        localQuery,
        location: place.location,
        region: place.widenTo,
        countryCode,
        currency: this.cities.currencyOf(countryCode),
        limit: MAX_PER_SOURCE,
      },
    };
  }

  /* ------------------------------ not interested ------------------------- */

  /** Remembers that the seeker doesn't want this match. Saying it twice is harmless. */
  async dismiss(user: User, dto: DismissMatchDto): Promise<void> {
    await this.prisma.dismissedMatch.upsert({
      where: { userId_jobId: { userId: user.id, jobId: dto.jobId } },
      create: { userId: user.id, jobId: dto.jobId, title: dto.title, company: dto.company },
      update: {},
    });
  }

  /** Undoes a dismissal. */
  async undismiss(user: User, jobId: string): Promise<void> {
    await this.prisma.dismissedMatch.deleteMany({ where: { userId: user.id, jobId } });
  }

  /**
   * Whether a job was dismissed: by its id, or by title and company, since
   * the same job arrives from more than one source under different ids.
   */
  private async dismissedFilter(userId: string): Promise<(job: CandidateJob) => boolean> {
    const rows = await this.prisma.dismissedMatch.findMany({
      where: { userId },
      select: { jobId: true, title: true, company: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_DISMISSED,
    });
    if (rows.length === 0) return () => false;
    const ids = new Set(rows.map((r) => r.jobId));
    const named = new Set(rows.map((r) => sameJobKey(r.title, r.company)));
    return (job) => ids.has(job.id) || named.has(sameJobKey(job.title, job.company));
  }

  coverLetter(user: User, dto: AssistDto) {
    return this.withResumeText(user, (resumeText) => this.ai.generateCoverLetter(resumeText, dto.job));
  }

  tailor(user: User, dto: AssistDto) {
    return this.withResumeText(user, (resumeText) => this.ai.tailorResume(resumeText, dto.job));
  }

  private async withResumeText<T>(user: User, fn: (resumeText: string) => Promise<T>): Promise<T> {
    const candidate = await this.loadCandidate(user);
    if (!candidate) {
      throw new BadRequestException('Complete your profile before using this feature.');
    }
    return fn(this.synthesizeResumeText(candidate.parsed));
  }

  /* --------------------------- profile loading --------------------------- */

  /** Builds a resume-shaped profile from the seeker's stored JobSeekerProfile. */
  private async loadCandidate(user: User): Promise<Candidate | null> {
    const p = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId: user.id },
      include: {
        experiences: { orderBy: { startDate: 'desc' }, take: 15 },
        educations: { orderBy: { startDate: 'desc' }, take: 10 },
      },
    });
    if (!p) return null;

    const parsed: ParsedResume = {
      name: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || '',
      headline: p.headline ?? '',
      summary: p.summary ?? '',
      skills: p.skills ?? [],
      languages: p.languages ?? [],
      experiences: p.experiences.map((e) => ({
        title: e.title,
        company: e.company,
        location: e.location ?? '',
        period: this.formatPeriod(e.startDate, e.endDate, e.current),
        description: e.description ?? '',
      })),
      educations: p.educations.map((e) => ({
        degree: [e.degree, e.fieldOfStudy].filter(Boolean).join(', '),
        school: e.institution,
        location: e.location ?? '',
        period: this.formatPeriod(e.startDate, e.endDate, e.current),
        description: e.description ?? '',
      })),
    };

    // Needs at least something to match on.
    if (parsed.skills.length === 0 && parsed.experiences.length === 0 && !parsed.headline && !p.currentTitle) {
      return null;
    }

    return { parsed, currentTitle: p.currentTitle ?? '', city: p.city ?? '', country: p.country ?? '' };
  }

  private formatPeriod(start: Date | null, end: Date | null, current: boolean): string {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!start) return '';
    return `${fmt(start)} - ${current ? 'Present' : end ? fmt(end) : 'Present'}`;
  }

  private synthesizeResumeText(p: ParsedResume): string {
    const lines: string[] = [];
    if (p.name) lines.push(p.name);
    if (p.headline) lines.push(p.headline);
    if (p.summary) lines.push(`\nSummary:\n${p.summary}`);
    if (p.skills.length) lines.push(`\nSkills: ${p.skills.join(', ')}`);
    if (p.experiences.length) {
      lines.push('\nExperience:');
      for (const e of p.experiences) {
        lines.push(`- ${e.title} @ ${e.company} (${e.period})${e.description ? `: ${e.description}` : ''}`);
      }
    }
    if (p.educations.length) {
      lines.push('\nEducation:');
      for (const e of p.educations) lines.push(`- ${e.degree}, ${e.school} (${e.period})`);
    }
    return lines.join('\n');
  }

  /* ----------------------------- matching -------------------------------- */

  private buildQuery(c: Candidate, provided?: string): string {
    if (provided?.trim()) return provided.trim().slice(0, 120);
    const role =
      c.currentTitle ||
      c.parsed.experiences[0]?.title ||
      c.parsed.headline ||
      c.parsed.skills.slice(0, 2).join(' ') ||
      'jobs';
    return role.slice(0, 120);
  }

  /**
   * The location box wins, even empty (anywhere). Without one, a typed role
   * searches anywhere, as it always has, and the profile's own match uses the
   * profile's city.
   */
  private buildLocation(c: Candidate, dto: RunMatchDto): string {
    if (dto.location !== undefined) return dto.location.trim();
    return dto.query?.trim() ? '' : c.city.trim();
  }

  /**
   * Whether a job can be in the searched country. Employer boards list jobs
   * wherever the company hires, so a search in Kampala drew Toronto and
   * "Remote (Canada)" roles, and one in Toronto drew Berlin. A job whose
   * location is clearly elsewhere is left out; one that doesn't say
   * ("Remote") stays. A country the source states beats reading the text:
   * Google lists many jobs with a country and no city ("GH").
   */
  private inCountry(job: CandidateJob, countryCode: string | undefined): boolean {
    if (!countryCode) return true;
    const jobCountry = job.countryCode ?? this.cities.countryOfText(job.location, countryCode);
    return !jobCountry || jobCountry === countryCode;
  }

  /**
   * The country to search: the city picked from suggestions; else the place
   * in the box or on the profile, read as the person's ("London" for a
   * Canadian is London, ON; "ONTARIO CANADA" is Canada); else the person's
   * own country.
   *
   * JSearch and Adzuna search one country at a time, and without one this
   * fell back to their default, Canada — so a job seeker in Uganda with no
   * city on their profile, or who cleared the box to look "anywhere", was
   * shown Canadian jobs. "Anywhere" now means anywhere in their country.
   */
  private countryOf(location: string, chosen: string | undefined, home: string | undefined): string | undefined {
    if (chosen) return chosen.toUpperCase();
    return (location ? this.cities.countryOfText(location, home) : undefined) ?? home;
  }

  /**
   * Where to search, read from what was written.
   *
   * A city is searched as written, and its province or state ("Quebec",
   * "Texas") decides the language of local job ads and how far a thin search
   * widens. A province or state is searched whole, as "Ontario, Canada": a
   * profile's city field held "ONTARIO CANADA", and as a city name it was
   * taken for Ontario, California. A country on its own means anywhere in it.
   */
  private placeOf(
    location: string,
    chosen: string | undefined,
    home: string | undefined,
  ): { location: string; countryCode?: string; region?: string; widenTo?: string } {
    const picked = chosen?.toUpperCase();
    if (!location) return { location: '', countryCode: picked ?? home };
    const reading = this.cities.readPlace(location, picked ?? home);
    // A country picked from suggestions outranks a reading that disagrees with it.
    if (reading && reading.kind !== 'city' && (!picked || picked === reading.countryCode)) {
      return reading.kind === 'region'
        ? { location: `${reading.region}, ${reading.country}`, countryCode: reading.countryCode, region: reading.region }
        : { location: '', countryCode: reading.countryCode };
    }
    const countryCode = this.countryOf(location, chosen, home);
    const city = reading?.kind === 'city' && reading.city.countryCode === countryCode ? reading.city : undefined;
    return { location, countryCode, region: city?.region, widenTo: city?.region };
  }

  /**
   * The person's own country: as the profile says; else as the profile's
   * city says; else where they are browsing from, when the CDN tells us.
   * Undefined when none of these is known, and each source keeps its default.
   */
  private homeCountry(c: Pick<Candidate, 'city' | 'country'>, visitorCountry?: string): string | undefined {
    const visitor = visitorCountry?.toUpperCase();
    return (
      this.cities.countryCodeOf(c.country) ??
      (c.city.trim() ? this.cities.countryOfText(c.city, visitor) : undefined) ??
      visitor
    );
  }

  /** Give every source a turn before filling the scoring budget. */
  private selectCandidates(results: CandidateJob[][]): CandidateJob[] {
    const seen = new Set<string>();
    const seenIds = new Set<string>();
    const cursors = results.map(() => 0);
    const out: CandidateJob[] = [];
    while (out.length < MAX_TO_SCORE) {
      let added = false;
      for (let source = 0; source < results.length; source++) {
        const jobs = results[source];
        while (cursors[source] < Math.min(jobs.length, MAX_PER_SOURCE)) {
          const job = jobs[cursors[source]++];
          const key = `${job.title}|${job.company}`.toLowerCase().replace(/\s+/g, ' ').trim();
          if (seen.has(key) || seenIds.has(job.id)) continue;
          seen.add(key);
          seenIds.add(job.id);
          out.push(job);
          added = true;
          if (out.length === MAX_TO_SCORE) return out;
          break;
        }
      }
      if (!added) break;
    }
    return out;
  }

  private async scoreAndRank(profile: ParsedResume, candidates: CandidateJob[]): Promise<ResumeMatch[]> {
    if (candidates.length === 0) return [];

    const aiById = new Map<string, { score: number; reason: string }>();
    try {
      // The AI reads what each job asks for, not its opening blurb about the company.
      const scores = await this.ai.scoreJobMatches(
        profile,
        candidates.map((c) => ({ ...c, description: jobDigest(c.description) })),
      );
      for (const s of scores) aiById.set(s.id, { score: s.score, reason: s.reason });
    } catch (err) {
      this.logger.warn(`AI scoring unavailable, using heuristic: ${err instanceof Error ? err.message : err}`);
    }

    return candidates
      .map<ResumeMatch>((j) => {
        const ai = aiById.get(j.id);
        // A snippet can't show what a job asks for, so it can't confirm a fit.
        // Adzuna only ever gives 500 characters, and with no requirements in
        // sight the AI scored them all above jobs whose stated requirements
        // the person plainly meets (seen 2026-10-16; asking it not to didn't
        // hold). Capped here, so a confirmed fit ranks first.
        const snippet = (j.description ?? '').replace(/\s+/g, ' ').trim().length < SNIPPET_CHARS;
        const aiScore = ai && (snippet ? Math.min(ai.score, SNIPPET_MAX_SCORE) : ai.score);
        return {
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          source: j.source,
          url: j.url,
          salary: j.salary,
          matchScore: aiScore ?? this.heuristicScore(profile, j),
          scoringMode: ai ? 'ai' : 'heuristic',
          reason: ai?.reason || undefined,
          description: (j.description || '').slice(0, 1500) || undefined,
          postedAt: j.postedAt,
          employmentType: j.employmentType,
          workplace: j.workplace,
          yearlyPay: j.yearlyPay,
          ...(j.logoUrl ? { logoUrl: j.logoUrl } : {}),
          ...(j.publisher ? { publishedOn: publishedOn(j.publisher, j.company) } : {}),
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MAX_TO_SCORE);
  }

  private heuristicScore(profile: ParsedResume, job: CandidateJob): number {
    const hay = `${job.title} ${job.description}`.toLowerCase();
    const skills = profile.skills.map((s) => s.toLowerCase()).filter((s) => s.length > 2);
    const hits = skills.reduce((n, s) => (hay.includes(s) ? n + 1 : n), 0);
    return Math.min(95, 40 + hits * 12);
  }
}
