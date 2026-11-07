import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  ChevronsRight,
  Clock,
  ExternalLink,
  EyeOff,
  FileText,
  Globe,
  Lock,
  MapPin,
  Wand2,
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
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label="Close job details"
          title="Close"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground">Job details</span>
      </div>
      {/* Keyed so each job opens at its top. */}
      <div key={match.id} className="flex-1 overflow-y-auto">
        <MatchDetails m={match} actions={actions} />
      </div>
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
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-4 pr-12">
          <span className="text-xs font-medium text-muted-foreground">Job details</span>
        </div>
        {shown && (
          <>
            <SheetTitle className="sr-only">{shown.title}</SheetTitle>
            <SheetDescription className="sr-only">{shown.company}</SheetDescription>
            <div key={shown.id} className="flex-1 overflow-y-auto">
              <MatchDetails m={shown} actions={actionsFor(shown)} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MatchDetails({ m, actions }: { m: MatchedJob; actions: MatchActions }) {
  const save = useMatchSave(m);
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
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{m.company}</p>
        <SourceBadge source={m.source} publishedOn={m.publishedOn} />
      </div>

      <div>
        <h2
          ref={headingRef}
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
          {m.url &&
            (external ? (
              <Button asChild variant="coral" className="rounded-full">
                <a href={m.url} target="_blank" rel="noopener noreferrer" onClick={actions.onTrack}>
                  {site ? `Apply on ${site}` : "Open the listing"} <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button asChild variant="coral" className="rounded-full">
                <Link to={m.url}>View job and apply</Link>
              </Button>
            ))}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={save.toggle}
            disabled={save.isPending}
            aria-pressed={save.isSaved}
          >
            {save.isSaved ? <BookmarkCheck className="h-4 w-4 text-coral" /> : <Bookmark className="h-4 w-4" />}
            {save.isSaved ? "Saved" : "Save"}
          </Button>
          <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={actions.onNotInterested}>
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
