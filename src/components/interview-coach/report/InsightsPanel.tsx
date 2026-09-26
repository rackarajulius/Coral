import { AlertTriangle, Crosshair, Repeat2, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionReport } from "@/data/interview-coach/types";

function InsightCard({
  icon: Icon,
  title,
  items,
  iconTone,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  iconTone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-ink/10 bg-surface p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-dim">
        <Icon className={`h-3.5 w-3.5 ${iconTone}`} aria-hidden="true" />
        {title}
      </p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-ink">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InsightsPanel({ report }: { report: SessionReport }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InsightCard icon={ThumbsUp} title="Top strengths" items={report.strengths} iconTone="text-emerald-400" />
      <InsightCard icon={AlertTriangle} title="Biggest gaps" items={report.weaknesses} iconTone="text-amber-400" />
      <InsightCard icon={Repeat2} title="Repeated patterns" items={report.repeatedMistakes} iconTone="text-rose-400" />
      <InsightCard
        icon={Crosshair}
        title="Focus next on"
        items={report.focusAreas.map((f) => `${f} — drill this before your next session.`)}
        iconTone="text-coral"
      />
    </div>
  );
}
