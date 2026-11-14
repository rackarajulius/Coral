import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Clock,
  ExternalLink,
  EyeOff,
  FileText,
  Globe,
  Lock,
  MapPin,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import CompanyLogo from "@/components/company/CompanyLogo";
import MatchScore, { MatchScorePending } from "@/components/jobs/MatchScore";
import { SourceBadge } from "@/components/resumeMatcher/SourceBadge";
import type { MatchedJob } from "@/lib/api/resumeMatcher";
import { applySite } from "@/lib/resumeMatcher/applySite";
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS, postedAgo } from "@/lib/resumeMatcher/matchFilters";
import { jobTextBlocks, type JobTextBlock } from "@/lib/resumeMatcher/jobText";
import { useMatchSave } from "@/hooks/useMatchSave";

/** What can be done with a match, from its card or its drawer. */
export interface MatchActions {
  onCover: () => void;
  onTailor: () => void;
  onResearch: () => void;
  onNotInterested: () => void;
  /** Files a web listing in the External tracker as it is opened. */
  onTrack: () => void;
  /** Which tools the plan doesn't cover right now; shown with a lock. */
  locked?: { cover: boolean; tailor: boolean; research: boolean };
}

/**
 * The open match beside the list, like a mail reader's reading pane. It sticks
 * below the header while the list scrolls, so another card can be opened
 * without losing this one's place.
 */
export function DockedMatchDrawer({
  match,
  actions,
  onClose,
}: {
  match: MatchedJob;
  actions: MatchActions;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Job details"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="sticky top-20 flex h-[calc(100vh-6rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:animate-none"
    >
      {/* Keyed so each job opens at its top. */}
      <DetailsPane key={match.id} m={match} actions={actions} onClose={onClose} />
    </aside>
  );
}

/** The same details on a narrow screen, as a sheet over the page. */
export function MatchDrawerSheet({
  match,
  actionsFor,
  onClose,
}: {
  match: MatchedJob | undefined;
  actionsFor: (m: MatchedJob) => MatchActions;
  onClose: () => void;
}) {
  // Kept while the sheet slides shut, so it doesn't empty first.
  const [shown, setShown] = useState(match);
  if (match && match !== shown) setShown(match);

  return (
    <Sheet open={!!match} onOpenChange={(open) => !open && onClose()}>
      {/* The sheet's own close is hidden: the details carry one in their top row. */}
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl [&>button:last-child]:hidden">
        {shown && (
          <>
            <SheetTitle className="sr-only">{shown.title}</SheetTitle>
            <SheetDescription className="sr-only">{shown.company}</SheetDescription>
            <DetailsPane key={shown.id} m={shown} actions={actionsFor(shown)} onClose={onClose} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The scrolling details, with a bar that slides down from the top once the
 * job title has scrolled away, so the reader still knows which job this is.
 */
function DetailsPane({ m, actions, onClose }: { m: MatchedJob; actions: MatchActions; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [titleGone, setTitleGone] = useState(false);
  // One for the bar and the details, so both show the same state.
  const save = useMatchSave(m);
  const barTab = titleGone ? 0 : -1;

  useEffect(() => {
    const root = scrollRef.current;
    const title = root?.querySelector("[data-match-title]");
    if (!root || !title) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only once it has left over the top, not while it is still below.
        const top = entry.rootBounds?.top ?? 0;
        setTitleGone(!entry.isIntersecting && entry.boundingClientRect.top < top);
      },
      { root },
    );
    observer.observe(title);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        aria-hidden={!titleGone}
        className={`absolute inset-x-0 top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-5 py-2.5 shadow-sm backdrop-blur transition-transform duration-200 ease-out motion-reduce:transition-none sm:px-6 ${
          titleGone ? "translate-y-0" : "pointer-events-none -translate-y-full"
        }`}
      >
        <button
          type="button"
          tabIndex={barTab}
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Back to top"
        >
          <CompanyLogo company={m.company} src={m.logoUrl} className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-foreground group-hover:text-coral">
              {m.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{m.company}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <ApplyButton m={m} actions={actions} compact tabIndex={barTab} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-muted hover:bg-muted-foreground/25 hover:text-foreground"
            tabIndex={barTab}
            onClick={save.toggle}
            disabled={save.isPending}
            aria-pressed={save.isSaved}
            aria-label={save.isSaved ? "Saved" : "Save"}
            title={save.isSaved ? "Saved" : "Save"}
          >
            {save.isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-coral" strokeWidth={2.75} />
            ) : (
              <Bookmark className="h-4 w-4" strokeWidth={2.75} />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-muted text-foreground hover:bg-muted-foreground/25 hover:text-foreground"
            tabIndex={barTab}
            onClick={actions.onNotInterested}
            aria-label="Not interested"
            title="Not interested"
          >
            <EyeOff className="h-4 w-4" strokeWidth={2.75} />
          </Button>
          <CloseButton onClose={onClose} tabIndex={barTab} />
        </div>
      </div>
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <MatchDetails m={m} actions={actions} save={save} onClose={onClose} />
      </div>
    </div>
  );
}

function CloseButton({ onClose, tabIndex }: { onClose: () => void; tabIndex?: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 rounded-full hover:bg-muted hover:text-foreground"
      tabIndex={tabIndex}
      onClick={onClose}
      aria-label="Close job details"
      title="Close"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

/** The way to apply: the outside listing in a new tab, or the job's page here. */
function ApplyButton({
  m,
  actions,
  compact,
  tabIndex,
}: {
  m: MatchedJob;
  actions: MatchActions;
  compact?: boolean;
  tabIndex?: number;
}) {
  if (!m.url) return null;
  const site = applySite(m);
  const className = compact ? "h-8 shrink-0 rounded-full px-3" : "rounded-full";
  return /^https?:\/\//.test(m.url) ? (
    <Button asChild variant="coral" size={compact ? "sm" : undefined} className={className}>
      <a href={m.url} target="_blank" rel="noopener noreferrer" onClick={actions.onTrack} tabIndex={tabIndex}>
        {compact ? "Apply" : site ? `Apply on ${site}` : "Open the listing"} <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  ) : (
    <Button asChild variant="coral" size={compact ? "sm" : undefined} className={className}>
      <Link to={m.url} tabIndex={tabIndex}>
        {compact ? "Apply" : "View job and apply"}
      </Link>
    </Button>
  );
}

function MatchDetails({
  m,
  actions,
  save,
  onClose,
}: {
  m: MatchedJob;
  actions: MatchActions;
  save: ReturnType<typeof useMatchSave>;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const blocks = useMemo(() => jobTextBlocks(m.description), [m.description]);
  const posted = postedAgo(m.postedAt);
  const site = applySite(m);
  const external = !!m.url && /^https?:\/\//.test(m.url);
  const keyword = m.scoringMode === "heuristic";

  // Opening a job takes keyboard and screen reader focus to it, without
  // scrolling a page the person is reading.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const facts = [
    m.location && { icon: MapPin, text: m.location },
    m.workplace && { icon: m.workplace === "remote" ? Globe : Building2, text: WORKPLACE_LABELS[m.workplace] },
    m.employmentType && { icon: Briefcase, text: EMPLOYMENT_LABELS[m.employmentType] },
    posted && { icon: Clock, text: `Posted ${posted.toLowerCase()}` },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <CompanyLogo company={m.company} src={m.logoUrl} className="h-11 w-11" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{m.company}</p>
        <SourceBadge source={m.source} publishedOn={m.publishedOn} />
        <CloseButton onClose={onClose} />
      </div>

      <div>
        <h2
          ref={headingRef}
          data-match-title
          tabIndex={-1}
          className="font-display text-xl font-bold leading-snug text-foreground outline-none"
        >
          {m.title}
        </h2>
        {m.salary && <p className="mt-1 font-medium text-foreground">{m.salary}</p>}
        {facts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ApplyButton m={m} actions={actions} />
          <Button
            variant="outline"
            className="rounded-full border-gray-300 hover:bg-muted-foreground/15 hover:text-foreground"
            onClick={save.toggle}
            disabled={save.isPending}
            aria-pressed={save.isSaved}
          >
            {save.isSaved ? <BookmarkCheck className="h-4 w-4 text-coral" /> : <Bookmark className="h-4 w-4" />}
            {save.isSaved ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" className="rounded-full border-gray-300 hover:bg-muted-foreground/15 hover:text-foreground"
            onClick={actions.onNotInterested}
          >
            <EyeOff className="h-4 w-4" /> Not interested
          </Button>
        </div>
        {external && (
          <p className="mt-2 text-xs text-muted-foreground">
            Opens in a new tab and adds the job to your External tracker.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">How you match</h3>
          {m.scoringMode === "pending" ? <MatchScorePending /> : <MatchScore score={m.matchScore} keyword={keyword} />}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {m.scoringMode === "pending"
            ? "Comparing this job with your resume…"
            : m.reason ||
              (keyword
                ? "AI scoring was unavailable, so this counts the skills on your profile that the ad mentions."
                : "No explanation came with this score.")}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Get ready to apply</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8" onClick={actions.onCover}>
            {actions.locked?.cover ? <Lock className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />} Cover letter
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={actions.onTailor}>
            {actions.locked?.tailor ? <Lock className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />} Tailor resume
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={actions.onResearch}>
            {actions.locked?.research ? <Lock className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}{" "}
            Research company
          </Button>
        </div>
      </section>

      <section className="border-t border-border pt-5">
        <h3 className="font-display text-lg font-semibold text-foreground">About the job</h3>
        {blocks.length > 0 ? (
          <JobText blocks={blocks} />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">This listing came without a description.</p>
        )}
        {/* Adzuna shares only an ad's first lines, and a very long ad is cut. */}
        {m.descriptionPartial && external && (
          <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            This is only the start of the ad.{" "}
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-coral hover:underline">
              Read all of it on {site ?? "the listing"}
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

function JobText({ blocks }: { blocks: JobTextBlock[] }) {
  return (
    <div className="mt-3 space-y-3 break-words text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, i) =>
        block.kind === "heading" ? (
          <h4 key={i} className="pt-2 font-semibold text-foreground">
            {block.text}
          </h4>
        ) : block.kind === "paragraph" ? (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        ) : (
          <ListBlock key={i} ordered={block.ordered} items={block.items} />
        ),
      )}
    </div>
  );
}

function ListBlock({ ordered, items }: { ordered: boolean; items: string[] }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className={`space-y-1.5 pl-5 marker:text-coral ${ordered ? "list-decimal" : "list-disc"}`}>
      {items.map((item, j) => (
        <li key={j}>{item}</li>
      ))}
    </List>
  );
}
