import {
  Bookmark,
  BookmarkCheck,
  Building2,
  Clock,
  EyeOff,
  FileText,
  Lock,
  MapPin,
  Wallet,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/company/CompanyLogo";
import MatchScore, { MatchScorePending } from "@/components/jobs/MatchScore";
import type { MatchedJob } from "@/lib/api/resumeMatcher";
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS, postedAgo } from "@/lib/resumeMatcher/matchFilters";
import { useMatchSave } from "@/hooks/useMatchSave";
import type { MatchActions } from "./MatchDrawer";
import { SourceBadge } from "./SourceBadge";

export function MatchCard({
  m,
  actions,
  isOpen,
  onOpen,
  cardRef,
}: {
  m: MatchedJob;
  actions: MatchActions;
  /** Shown in the job details drawer now. */
  isOpen: boolean;
  onOpen: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const { onCover, onTailor, onResearch, onNotInterested, onTrack, locked } = actions;
  const save = useMatchSave(m);
  const posted = postedAgo(m.postedAt);
  const details = [
    m.employmentType && EMPLOYMENT_LABELS[m.employmentType],
    m.workplace && WORKPLACE_LABELS[m.workplace],
  ].filter(Boolean);

  // The whole card opens the drawer. Its buttons and links do their own
  // thing, and selecting text to copy it is not a click.
  const openFromCard = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a") || window.getSelection()?.toString()) return;
    onOpen();
  };

  return (
    <div
      ref={cardRef}
      onClick={openFromCard}
      className={`flex flex-col cursor-pointer rounded-2xl border bg-card p-5 pb-3 transition-all duration-200 hover:shadow-md ${
        isOpen ? "border-coral shadow-md ring-1 ring-coral/30" : "border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <CompanyLogo company={m.company} src={m.logoUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">
                {/* The keyboard's way in to what the card's click does. */}
                <button
                  type="button"
                  data-match-open
                  onClick={onOpen}
                  aria-expanded={isOpen}
                  className="block w-full truncate rounded-sm text-left hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {m.title}
                </button>
              </h3>
              <p className="text-sm text-muted-foreground truncate">{m.company}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {m.scoringMode === "pending" ? (
                <MatchScorePending />
              ) : (
                <MatchScore score={m.matchScore} keyword={m.scoringMode === "heuristic"} />
              )}
              {m.scoringMode === "heuristic" && <span className="text-[10px] text-muted-foreground">Keyword match</span>}
              <SourceBadge source={m.source} publishedOn={m.publishedOn} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {m.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {m.location}
          </span>
        )}
        {m.salary && (
          <span className="flex items-center gap-1">
            <Wallet className="h-3 w-3" /> {m.salary}
          </span>
        )}
        {details.length > 0 && <span>{details.join(" · ")}</span>}
        {posted && (
          <span className="flex items-center  gap-1">
            <Clock className="h-3 w-3" /> {posted}
          </span>
        )}
      </div>
      {m.reason && <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[3.25em]" title={m.reason}>{m.reason}</p>}

      <div className="mt-auto pt-4 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="outline" className="h-8" onClick={onCover}>
          {locked?.cover ? <Lock className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />} Cover letter
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onTailor}>
          {locked?.tailor ? <Lock className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />} Tailor
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onResearch}>
          {locked?.research ? <Lock className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />} Research
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-1 pt-3 border-t border-gray-300">
        {m.url && (
          <Button size="sm" variant="coral" asChild>
            <a
              href={m.url}
              onClick={onTrack}
              target={m.url.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {m.source === "platform" ? "View job →" : "Open & track →"}
            </a>
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8 hover:bg-muted hover:text-foreground"
          onClick={save.toggle}
          disabled={save.isPending}
          aria-pressed={save.isSaved}
          aria-label={save.isSaved ? `Saved: ${m.title}` : `Save ${m.title}`}
          title={save.isSaved ? "Saved" : "Save for later"}
        >
          {save.isSaved ? (
            <BookmarkCheck className="h-5 w-5 text-coral" strokeWidth={8 / 3} absoluteStrokeWidth />
          ) : (
            <Bookmark className="h-5 w-5" strokeWidth={8 / 3} absoluteStrokeWidth />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 hover:bg-muted  hover:text-foreground"
          onClick={onNotInterested}
          aria-label={`Not interested in ${m.title}`}
          title="Not interested"
        >
          <EyeOff className="h-5 w-5" strokeWidth={8 / 3} absoluteStrokeWidth />
        </Button>
      </div>
    </div>
  );
}
