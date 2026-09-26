import { BookOpen, Dumbbell, GraduationCap, PlayCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { competencyLabel } from "@/data/interview-coach/constants";
import type { LearningResource } from "@/data/interview-coach/types";

const KIND_ICON: Record<LearningResource["kind"], LucideIcon> = {
  article: BookOpen,
  video: PlayCircle,
  course: GraduationCap,
  exercise: Dumbbell,
};

export default function ResourceList({ resources }: { resources: LearningResource[] }) {
  if (resources.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((r) => {
        const Icon = KIND_ICON[r.kind];
        return (
          <a
            key={r.title}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="group flex gap-4 rounded-2xl border border-ink/10 bg-surface p-4 transition-colors hover:border-coral/40"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2">
              <Icon className="h-4 w-4 text-coral" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink group-hover:text-coral">{r.title}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-dim">
                {r.kind} · ~{r.durationMin} min · {competencyLabel(r.competency)}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{r.reason}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
