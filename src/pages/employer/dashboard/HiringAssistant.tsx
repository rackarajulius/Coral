// HiringAssistant.tsx — thin orchestrator; state in useHiringAssistant.

import { useState } from "react";
import { PanelLeftDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CenteredPrompt } from "@/components/employer-dashboard/hiring-assistant/CenteredPrompt";
import { WorkspaceLayout } from "@/components/employer-dashboard/hiring-assistant/WorkspaceLayout";
import { HiringHistoryRail } from "@/components/employer-dashboard/hiring-assistant/HiringHistoryRail";
import { useHiringAssistant } from "@/data/employer/HiringAssistant/useHiringAssistant";

export default function HiringAssistant() {
  const {
    phase,
    prompt,
    setPrompt,
    dockedPrompt,
    followUp,
    setFollowUp,
    revealStep,
    messages,
    isCopilotTyping,
    parsedIntent,
    handleSubmit,
    sendFollowUp,
    resetToPrompt,
  } = useHiringAssistant();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  /**
   * Reopens a stored session.
   *
   * The query comes from the row itself — fetching the shortlist first only to
   * read its query cost a round trip for a string the list already had, and the
   * workspace refetches it by query anyway.
   *
   * `instant` because nothing is being computed: the candidates and their
   * stages already exist, so the staged reveal would be theatre.
   */
  const openSession = (id: string, query: string) => {
    setActiveId(id);
    handleSubmit(query, { instant: true });
    // On a phone the rail is a drawer covering the workspace it just loaded.
    setRailOpen(false);
  };

  const startNew = () => {
    setActiveId(null);
    resetToPrompt();
    setRailOpen(false);
  };

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-background">
      {/* Present in both phases: past work is the reason to come back here, and
          hiding it behind an active search made every session feel like the
          first one.

          Below md it becomes a drawer instead. At 256px fixed it left barely a
          hundred pixels of workspace on a phone, which made the column it was
          protecting unusable. */}
      <HiringHistoryRail
        className="hidden md:flex"
        activeId={activeId}
        onNew={startNew}
        onOpen={openSession}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/*
          One quiet icon, no divider. "New search" is not repeated here: it is
          the first thing in the drawer, and two buttons competing above a page
          whose whole purpose is a single prompt made the prompt look secondary.

          PanelLeftDashed rather than PanelLeft, which the dashboard header
          already uses a few pixels above this. The same glyph twice, stacked,
          opening two different drawers would be a guessing game.
        */}
        <div className="px-1 pt-1 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setRailOpen(true)}
            aria-label="Open search history"
          >
            <PanelLeftDashed className="h-[18px] w-[18px]" />
          </Button>
        </div>

        {phase === "prompt" ? (
          <div className="relative flex min-h-0 flex-1 flex-col bg-background">
            <CenteredPrompt prompt={prompt} setPrompt={setPrompt} onSubmit={handleSubmit} />
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <WorkspaceLayout
              className="relative z-10"
              dockedPrompt={dockedPrompt}
              messages={messages}
              followUp={followUp}
              setFollowUp={setFollowUp}
              sendFollowUp={sendFollowUp}
              revealStep={revealStep}
              isCopilotTyping={isCopilotTyping}
              parsedIntent={parsedIntent}
              onNewSearch={startNew}
            />
          </div>
        )}
      </div>

      {/* Same rail, same state — rendered into a drawer rather than duplicated,
          so pinning or deleting behaves identically on either size.

          Offset by the dashboard header's height so it opens *under* the icon
          instead of over the whole viewport, and carries its own copy of that
          icon in the same spot. The icon therefore reads as staying put while
          the panel slides out beneath it. */}
      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        {/* No `md:hidden`: that would hide the panel but keep the overlay,
            trapping anyone who widened the window while it was open. Only the
            trigger is mobile-only, so this can only be opened there.
            `[&>button]:hidden` drops the sheet's default corner X — the icon
            below is the toggle, and two ways to close it is one too many. */}
        <SheetContent
          side="left"
          // `!top-14`: the sheet's own `inset-y-0` also sets top, and
          // tailwind-merge does not treat a later `top-*` as conflicting with
          // it, so both survive. Without the important flag this would rely on
          // Tailwind's stylesheet ordering rather than on anything stated.
          className="!top-14 h-[calc(100svh-3.5rem)] w-[86vw] max-w-xs p-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Search history</SheetTitle>
          <SheetDescription className="sr-only">
            Your pinned and recent candidate searches
          </SheetDescription>

          <div className="flex h-full flex-col">
            {/* Same size and offset as the page's icon, so it lands on the
                same pixel and the swap is invisible. */}
            <div className="px-1 pt-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setRailOpen(false)}
                aria-label="Close search history"
              >
                <PanelLeftDashed className="h-[18px] w-[18px]" />
              </Button>
            </div>

            <HiringHistoryRail
              className="flex min-h-0 w-full flex-1 border-r-0"
              activeId={activeId}
              onNew={startNew}
              onOpen={openSession}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
