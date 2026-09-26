import { Loader2 } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved";

export function relative(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SaveIndicator({ state, at }: { state: SaveState; at: Date | null }) {
  if (state === "idle" && !at) return null;
  return (
    <div className="ml-2 hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
      {state === "saving" ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Saved {at ? relative(at) : "just now"}
        </>
      )}
    </div>
  );
}
