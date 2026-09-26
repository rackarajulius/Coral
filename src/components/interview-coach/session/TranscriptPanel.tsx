import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Bookmark, Copy, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { TranscriptItem } from "@/data/interview-coach/types";

function transcriptToText(items: TranscriptItem[]) {
  return items
    .map((t) => `[${format(new Date(t.at), "HH:mm:ss")}] ${t.speaker === "ai" ? "Nova" : "You"}: ${t.text}`)
    .join("\n\n");
}

export default function TranscriptPanel({
  open,
  onOpenChange,
  transcript,
  onToggleBookmark,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: TranscriptItem[];
  onToggleBookmark: (index: number) => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transcript
      .map((t, i) => ({ ...t, index: i }))
      .filter((t) => !q || t.text.toLowerCase().includes(q));
  }, [transcript, query]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(transcriptToText(transcript));
      toast.success("Transcript copied");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const exportTxt = () => {
    const blob = new Blob([transcriptToText(transcript)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-transcript-${format(new Date(), "yyyy-MM-dd-HHmm")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* booth-light must be re-applied here: the Sheet portals to <body>, so it
          escapes the session's wrapper and would otherwise use the dark tokens. */}
      <SheetContent
        side="right"
        className="booth-light flex w-full flex-col border-ink/10 bg-surface text-ink sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-ink">Transcript</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink/10 bg-surface-2 px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-dim" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcript…"
              aria-label="Search transcript"
              className="h-9 w-full bg-transparent text-sm placeholder:text-ink-dim focus:outline-none"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={copyAll} aria-label="Copy transcript" className="h-9 w-9 text-ink-dim hover:bg-surface-2 hover:text-ink">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={exportTxt} aria-label="Export transcript" className="h-9 w-9 text-ink-dim hover:bg-surface-2 hover:text-ink">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
          {visible.length === 0 && (
            <p className="pt-10 text-center text-sm text-ink-dim">
              {transcript.length === 0 ? "No transcript yet — it fills in as you talk." : "No matches."}
            </p>
          )}
          {visible.map((t) => (
            <div
              key={t.index}
              className={cn(
                "group rounded-2xl border p-3.5",
                t.speaker === "ai" ? "border-ink/10 bg-surface-2/60" : "border-coral/20 bg-coral/10",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
                  {t.speaker === "ai" ? "Nova" : "You"} · {format(new Date(t.at), "HH:mm")}
                </p>
                <button
                  onClick={() => onToggleBookmark(t.index)}
                  aria-label={t.bookmarked ? "Remove bookmark" : "Bookmark this moment"}
                  aria-pressed={!!t.bookmarked}
                  className={cn(
                    "rounded p-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                    t.bookmarked ? "text-amber-400" : "text-ink-dim opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <Bookmark className="h-3.5 w-3.5" fill={t.bookmarked ? "currentColor" : "none"} />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-ink">{t.text}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
