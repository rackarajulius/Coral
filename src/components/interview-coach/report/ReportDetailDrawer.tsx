import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HistoryEntry } from "@/data/interview-coach/types";
import CompetencyCards from "./CompetencyCards";
import InsightsPanel from "./InsightsPanel";
import ReportHeader from "./ReportHeader";
import ResourceList from "./ResourceList";
import SampleAnswers from "./SampleAnswers";

// Matches the sheet's slide-out duration, so the report stays rendered until the
// drawer is off screen instead of blanking mid-animation.
const DRAWER_CLOSE_MS = 320;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function ReportDetailDrawer({
  entry,
  onClose,
}: {
  entry: HistoryEntry | null;
  onClose: () => void;
}) {
  const isOpen = !!entry?.report;
  const [displayed, setDisplayed] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    if (entry?.report) setDisplayed(entry);
  }, [entry]);

  useEffect(() => {
    if (!isOpen && displayed) {
      const t = window.setTimeout(() => setDisplayed(null), DRAWER_CLOSE_MS);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, displayed]);

  if (!displayed?.report) return null;
  const report = displayed.report;

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="booth-light flex w-full flex-col gap-0 border-ink/10 bg-booth p-0 text-ink sm:max-w-3xl">
        <SheetTitle className="sr-only">
          {displayed.config.role} interview report
        </SheetTitle>
        <SheetDescription className="sr-only">
          Scored competency breakdown and AI feedback for this practice session.
        </SheetDescription>

        <ScrollArea className="flex-1">
          <div className="space-y-10 px-5 py-6 md:px-6">
            <ReportHeader entry={displayed} />

            <Section title="Competency breakdown">
              <CompetencyCards report={report} />
            </Section>

            <Section title="AI insights">
              <InsightsPanel report={report} />
            </Section>

            {report.sampleAnswers.length > 0 && (
              <Section title="Sample better answers">
                <SampleAnswers samples={report.sampleAnswers} />
              </Section>
            )}

            <Section title="Recommended learning">
              <ResourceList resources={report.resources} />
            </Section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
