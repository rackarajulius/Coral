import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EMPTY_CRITERIA,
  activeCriteriaCount,
  useSearchCriteria,
  type SearchCriteria,
} from "@/stores/searchCriteriaStore";

/** Matches the values the profile's own experience-level field is set from. */
const SENIORITY = ["Intern", "Junior", "Mid", "Senior", "Lead", "Principal", "Director"];

/**
 * Server-side search criteria — the ones that change which candidates come
 * back, as opposed to the chips below, which narrow what is already on screen.
 *
 * Edits are staged locally and applied on a button, not per keystroke: each
 * change re-queries the whole talent pool and re-ranks it with an AI call, and
 * doing that per character typed would be both slow and expensive.
 */
export function RefineSearchPanel({ className }: { className?: string }) {
  const applied = useSearchCriteria((s) => s.criteria);
  const setCriteria = useSearchCriteria((s) => s.setCriteria);
  const reset = useSearchCriteria((s) => s.reset);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchCriteria>(applied);
  const [skillText, setSkillText] = useState("");

  // Reopening shows what is actually in force, not an abandoned draft.
  useEffect(() => {
    if (open) {
      setDraft(applied);
      setSkillText("");
    }
  }, [open, applied]);

  const count = activeCriteriaCount(applied);

  const addSkill = () => {
    const value = skillText.trim();
    if (!value || draft.skills.length >= 12) return;
    // Case-insensitive, so "React" typed twice does not become two requirements.
    if (draft.skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillText("");
      return;
    }
    setDraft({ ...draft, skills: [...draft.skills, value] });
    setSkillText("");
  };

  const years = (raw: string): number | undefined => {
    const n = Number(raw);
    // An empty box means "no bound", which is not the same as zero.
    return raw.trim() === "" || Number.isNaN(n) ? undefined : Math.max(0, Math.min(60, n));
  };

  const apply = () => {
    // A min above a max returns nothing and looks like a broken search, so the
    // two are swapped rather than obeyed literally.
    const lo = draft.minYears;
    const hi = draft.maxYears;
    const swap = lo !== undefined && hi !== undefined && lo > hi;
    setCriteria({ ...draft, minYears: swap ? hi : lo, maxYears: swap ? lo : hi });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
            count > 0
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground",
            className,
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Refine search
          {count > 0 && (
            <span className="rounded-full bg-background/20 px-1.5 text-[10px] tabular-nums">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[22rem] bg-card p-4">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Refine search</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Searches the whole talent pool again, not just these results.
            </p>
          </div>

          {/* Location. Words in the brief are matched against what someone
              does, not where they are, so a prompt saying "in Toronto" never
              filtered by Toronto — this is the only place that does. */}
          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <Input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="City or country"
              className="h-8 text-xs"
            />
          </div>

          {/* Required skills */}
          <div className="space-y-1.5">
            <Label className="text-xs">Must have these skills</Label>
            <Input
              value={skillText}
              onChange={(e) => setSkillText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              onBlur={addSkill}
              placeholder="Type a skill and press Enter"
              className="h-8 text-xs"
            />
            {draft.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {draft.skills.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, skills: draft.skills.filter((x) => x !== s) })
                    }
                    className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground hover:border-foreground/20"
                  >
                    {s}
                    <X className="h-2.5 w-2.5" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              All of them, not any — each one narrows the search.
            </p>
          </div>

          {/* Seniority + industry */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Seniority</Label>
              <Select
                value={draft.seniority || "any"}
                onValueChange={(v) => setDraft({ ...draft, seniority: v === "any" ? "" : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {SENIORITY.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Industry</Label>
              <Input
                value={draft.industry}
                onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                placeholder="Any"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Years of experience */}
          <div className="space-y-1.5">
            <Label className="text-xs">Years of experience</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={60}
                value={draft.minYears ?? ""}
                onChange={(e) => setDraft({ ...draft, minYears: years(e.target.value) })}
                placeholder="Min"
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="number"
                min={0}
                max={60}
                value={draft.maxYears ?? ""}
                onChange={(e) => setDraft({ ...draft, maxYears: years(e.target.value) })}
                placeholder="Max"
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Counted from the roles on their profile, so someone who has not listed
              dates will not match a range.
            </p>
          </div>

          {/* Switches */}
          <div className="space-y-2.5 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-normal">Open to remote work</Label>
              <Switch
                checked={draft.remoteOnly}
                onCheckedChange={(v) => setDraft({ ...draft, remoteOnly: v })}
                aria-label="Open to remote work"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-normal">Actively looking only</Label>
                <p className="text-[10px] text-muted-foreground">
                  Hides people who have not said they are job hunting.
                </p>
              </div>
              <Switch
                checked={draft.openToWorkOnly}
                onCheckedChange={(v) => setDraft({ ...draft, openToWorkOnly: v })}
                aria-label="Actively looking only"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                reset();
                setDraft(EMPTY_CRITERIA);
                setSkillText("");
                setOpen(false);
              }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
