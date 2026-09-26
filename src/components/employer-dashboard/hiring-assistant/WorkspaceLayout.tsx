// Two-column workspace: scrollable main + fixed-height copilot; mobile copilot in a sheet.

import { Sparkles } from "lucide-react";
import { WorkspaceMain } from "@/components/employer-dashboard/hiring-assistant/WorkspaceMain";
import {
  CopilotPanel,
  type CopilotPanelProps,
} from "@/components/employer-dashboard/hiring-assistant/CopilotPanel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Message, ParsedIntent } from "@/data/employer/HiringAssistant/Index";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps extends CopilotPanelProps {
  messages: Message[];
  className?: string;
  parsedIntent: ParsedIntent | null;
  onNewSearch: () => void;
}

export function WorkspaceLayout({
  dockedPrompt,
  revealStep,
  parsedIntent,
  onNewSearch,
  className,
  ...copilotProps
}: WorkspaceLayoutProps) {
  // Fills <main> exactly — the dashboard header already sits above us, so no
  // viewport height (h-screen) or navbar offset (pt-16) here.
  return (
    <div className={cn("flex h-full w-full min-h-0 overflow-hidden", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <WorkspaceMain
          dockedPrompt={dockedPrompt}
          revealStep={revealStep}
          parsedIntent={parsedIntent}
          onNewSearch={onNewSearch}
        />
      </div>

      <CopilotPanel
        dockedPrompt={dockedPrompt}
        revealStep={revealStep}
        variant="sidebar"
        {...copilotProps}
      />

      <div className="pointer-events-none fixed bottom-6 right-6 z-40 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="pointer-events-auto h-14 w-14 rounded-full shadow-elevated"
              aria-label="Open Hiring Copilot"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 p-0 sm:max-w-[380px]"
          >
            <SheetTitle className="sr-only">Hiring Copilot</SheetTitle>
            <SheetDescription className="sr-only">
              Chat with the hiring assistant to refine your search
            </SheetDescription>
            <CopilotPanel
              dockedPrompt={dockedPrompt}
              revealStep={revealStep}
              variant="embedded"
              className="h-full"
              {...copilotProps}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
