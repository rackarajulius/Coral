import { Fragment } from "react";
import { Sparkles } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import type { SampleAnswer } from "@/data/interview-coach/types";

/** Render the improved answer with its highlight ranges marked. */
function Improved({ sample }: { sample: SampleAnswer }) {
  const parts: { text: string; mark: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of sample.improvedRanges) {
    if (start > cursor) parts.push({ text: sample.improved.slice(cursor, start), mark: false });
    parts.push({ text: sample.improved.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < sample.improved.length) parts.push({ text: sample.improved.slice(cursor), mark: false });

  return (
    <p className="text-sm leading-relaxed text-ink">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p.mark ? (
            <mark className="rounded bg-coral/20 px-0.5 text-ink">{p.text}</mark>
          ) : (
            p.text
          )}
        </Fragment>
      ))}
    </p>
  );
}

export default function SampleAnswers({ samples }: { samples: SampleAnswer[] }) {
  if (samples.length === 0) return null;
  return (
    <Accordion type="multiple">
      {samples.map((sample, i) => (
        <Fragment key={sample.questionText}>
          {i > 0 && <Separator className="bg-ink/10" />}
          <AccordionItem value={sample.questionText} className="border-b-0">
            <AccordionTrigger className="py-5 text-left hover:no-underline">
              <span>
                <span className="text-xs font-medium uppercase tracking-wide text-ink-dim">
                  Question
                </span>
                <span className="mt-1 block font-display text-base font-medium text-ink">
                  {sample.questionText}
                </span>
              </span>
            </AccordionTrigger>

            <AccordionContent className="pb-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-ink/10 bg-booth/50 p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
                    Your answer
                  </p>
                  <p className="text-sm leading-relaxed text-ink-dim">{sample.original}</p>
                </div>
                <div className="rounded-xl border border-coral/30 bg-coral/5 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-coral">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Stronger version — highlights show what changed
                  </p>
                  <Improved sample={sample} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Fragment>
      ))}
    </Accordion>
  );
}
