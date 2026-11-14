import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyEntitlements, refusalFor, type SeekerMetric } from "@/lib/api/entitlements";
import { createExternalApplication } from "@/lib/api/externalApplications";
import type { MatchedJob } from "@/lib/api/resumeMatcher";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";
import { useWideLayout } from "@/hooks/useWideLayout";
import { DockedMatchDrawer, MatchDrawerSheet, type MatchActions } from "./MatchDrawer";
import { MatchCard } from "./MatchCard";
import { AssistDialog, type AssistRequest } from "./AssistDialog";
import { ResearchDialog } from "./ResearchDialog";

export function MatchList({
  matches,
  loading,
  onNotInterested,
}: {
  matches: MatchedJob[];
  loading: boolean;
  onNotInterested: (m: MatchedJob) => void;
}) {
  const [assist, setAssist] = useState<AssistRequest | null>(null);
  const [research, setResearch] = useState<MatchedJob | null>(null);
  const queryClient = useQueryClient();
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: getMyEntitlements,
    staleTime: 60_000,
    retry: false,
  });

  /**
   * Opens a paid tool only when the plan covers it right now, and otherwise
   * explains why — before any request is made. The server still refuses on
   * its own; this is just so the answer comes before the loading spinner.
   */
  const gated = (metric: SeekerMetric, open: () => void) => () => {
    const refusal = refusalFor(entitlements, metric);
    if (refusal) showUpgrade(refusal);
    else open();
  };
  const locked = (metric: SeekerMetric) => refusalFor(entitlements, metric) !== null;

  const trackExternal = (m: MatchedJob) => {
    if (m.source === "platform" || !m.url) return;
    void createExternalApplication({
      sourceKey: `match:${m.id}`,
      title: m.title,
      company: m.company,
      url: m.url,
    }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["external-applications"] });
      toast.success("Saved to External tracker. Mark applied after you submit.");
    }).catch((error: Error) => toast.error(error.message));
  };

  const actionsFor = (m: MatchedJob): MatchActions => ({
    onCover: gated("assist.cover_letter", () => setAssist({ job: m, mode: "cover" })),
    onTailor: gated("assist.tailor", () => setAssist({ job: m, mode: "tailor" })),
    onResearch: gated("research.company", () => setResearch(m)),
    onNotInterested: () => onNotInterested(m),
    onTrack: () => trackExternal(m),
    locked: {
      cover: locked("assist.cover_letter"),
      tailor: locked("assist.tailor"),
      research: locked("research.company"),
    },
  });

  /**
   * The match shown in the job details drawer. On a wide screen the drawer
   * sits beside the list, which narrows to one column; narrower, it is a sheet.
   */
  const wide = useWideLayout();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? matches.find((m) => m.id === openId) : undefined;
  const docked = wide && !!open;
  const cards = useRef(new Map<string, HTMLElement>());

  // A match that leaves the list (hidden, filtered out, or not in a new
  // search) closes the drawer, and doesn't reopen it should it come back.
  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  const openMatch = (id: string) => {
    // Docking reflows two columns into one, which moves the card clicked.
    const reflows = wide && !openId;
    setOpenId(id);
    if (reflows) requestAnimationFrame(() => cards.current.get(id)?.scrollIntoView({ block: "nearest" }));
  };
  const closeDrawer = () => {
    const id = openId;
    setOpenId(null);
    // Back to the card it was opened from, wherever the wider list puts it.
    if (id) {
      requestAnimationFrame(() => cards.current.get(id)?.querySelector<HTMLElement>("[data-match-open]")?.focus());
    }
  };
  const openActions = open ? actionsFor(open) : undefined;

  return (
    <>
      <div className={docked ? "grid grid-cols-[minmax(0,7fr)_minmax(0,13fr)] items-start gap-5" : undefined}>
        <div
          className={`grid grid-cols-1 gap-4 ${docked ? "" : "lg:grid-cols-2"} ${loading ? "opacity-60 pointer-events-none" : ""}`}
        >
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              m={m}
              actions={actionsFor(m)}
              isOpen={m.id === openId}
              onOpen={() => openMatch(m.id)}
              cardRef={(el) => {
                if (el) cards.current.set(m.id, el);
                else cards.current.delete(m.id);
              }}
            />
          ))}
        </div>
        {docked && open && openActions && (
          <DockedMatchDrawer match={open} actions={openActions} onClose={closeDrawer} />
        )}
      </div>
      {!wide && <MatchDrawerSheet match={open} actionsFor={actionsFor} onClose={closeDrawer} />}

      <AssistDialog assist={assist} onClose={() => setAssist(null)} />
      <ResearchDialog job={research} onClose={() => setResearch(null)} />
    </>
  );
}
