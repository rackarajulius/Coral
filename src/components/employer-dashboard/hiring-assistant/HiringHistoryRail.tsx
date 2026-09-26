import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  FolderPlus,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createProject,
  deleteShortlist,
  listShortlists,
  projectLabel,
  updateShortlist,
  type ShortlistSummary,
} from "@/lib/api/shortlist";
import { getEmployerInterviews } from "@/lib/api/hiring";

/**
 * History for the hiring workspace.
 *
 * Every search already wrote a shortlist row carrying its candidates and their
 * pipeline stages — there was simply no way to list them, so past work was
 * stored and then lost to the interface. This is that list.
 *
 * Reopening restores the pipeline, not the conversation: messages live only in
 * component state, so the rail says "candidates", never "chat".
 */
export function HiringHistoryRail({
  activeId,
  onNew,
  onOpen,
  className,
}: {
  activeId?: string | null;
  onNew: () => void;
  onOpen: (id: string, query: string) => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ShortlistSummary | null>(null);

  const sessions = useQuery({
    queryKey: ["hiring-shortlists"],
    queryFn: listShortlists,
    retry: false,
  });

  const interviews = useQuery({
    queryKey: ["employer-interviews"],
    queryFn: getEmployerInterviews,
    retry: false,
    staleTime: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["hiring-shortlists"] });

  const pin = useMutation({
    mutationFn: (s: ShortlistSummary) => updateShortlist(s.id, { pinned: !s.pinned }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * Naming one is what turns a saved search into a project the team means to
   * keep — and the API has always accepted it; there was simply no way to ask.
   */
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateShortlist(id, { name }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const create = useMutation({
    mutationFn: (name: string) => createProject(name),
    onSuccess: () => {
      refresh();
      toast.success("Project created");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteShortlist(id),
    onSuccess: () => {
      refresh();
      toast.success("Deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const needle = filter.trim().toLowerCase();
  const rows = (sessions.data ?? []).filter(
    (s) =>
      !needle ||
      (s.name ?? "").toLowerCase().includes(needle) ||
      (s.roleTitle ?? "").toLowerCase().includes(needle) ||
      (s.query ?? "").toLowerCase().includes(needle),
  );
  const pinned = rows.filter((s) => s.pinned);
  const recent = rows.filter((s) => !s.pinned);

  // Only what hasn't happened yet, soonest first.
  const upcoming = (interviews.data ?? [])
    .filter((i) => i.scheduledAt && new Date(i.scheduledAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 4);

  return (
    <aside className={cn("flex w-64 shrink-0 flex-col border-r border-border bg-sidebar", className)}>
      <div className="p-3">
        <Button className="w-full justify-start" size="sm" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New search
        </Button>
      </div>

      {(sessions.data?.length ?? 0) > 6 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects"
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* A project you mean to keep should not have to begin as a search
              you happened to run. */}
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Name this project")?.trim();
              if (name) create.mutate(name);
            }}
            disabled={create.isPending}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
            New project
          </button>
        </div>
      )}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sessions.isLoading ? (
          <div className="space-y-2 px-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : sessions.isError ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {(sessions.error as Error)?.message || "Could not load your searches."}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">
            {needle
              ? "Nothing matches that."
              : "Your projects appear here once you run a search or start one, with whoever you shortlisted."}
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <Section label="Pinned">
                {pinned.map((s) => (
                  <Row
                    key={s.id}
                    session={s}
                    active={s.id === activeId}
                    onOpen={() => onOpen(s.id, s.query ?? "")}
                    onPin={() => pin.mutate(s)}
                    onRename={() => {
                      const next = window.prompt("Name this project", projectLabel(s))?.trim();
                      // Cancelling returns undefined; an empty box is a
                      // deliberate clear, which leaves a plain saved search.
                      if (next !== undefined) rename.mutate({ id: s.id, name: next });
                    }}
                    onDelete={() => setConfirmDelete(s)}
                    busy={pin.isPending}
                  />
                ))}
              </Section>
            )}

            {recent.length > 0 && (
              <Section label={pinned.length > 0 ? "Recent" : "Searches"}>
                {recent.map((s) => (
                  <Row
                    key={s.id}
                    session={s}
                    active={s.id === activeId}
                    onOpen={() => onOpen(s.id, s.query ?? "")}
                    onPin={() => pin.mutate(s)}
                    onRename={() => {
                      const next = window.prompt("Name this project", projectLabel(s))?.trim();
                      // Cancelling returns undefined; an empty box is a
                      // deliberate clear, which leaves a plain saved search.
                      if (next !== undefined) rename.mutate({ id: s.id, name: next });
                    }}
                    onDelete={() => setConfirmDelete(s)}
                    busy={pin.isPending}
                  />
                ))}
              </Section>
            )}
          </>
        )}

        {/* Real scheduled interviews. Hidden entirely when there are none,
            rather than showing an empty shell that implies a missing feature. */}
        {upcoming.length > 0 && (
          <Section label="Upcoming">
            {upcoming.map((i) => (
              <div key={i.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
                <CalendarClock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {i.role || "Interview"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(i.scheduledAt!).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this search?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.inPipeline
                ? `${confirmDelete.inPipeline} candidate${
                    confirmDelete.inPipeline === 1 ? " is" : "s are"
                  } in this pipeline. Deleting the search removes them from it — the candidates themselves are unaffected.`
                : "The shortlist and everyone saved in it will be removed. The candidates themselves are unaffected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) remove.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  session, active, onOpen, onPin, onRename, onDelete, busy,
}: {
  session: ShortlistSummary;
  active: boolean;
  onOpen: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  // The name the team gave it wins over a role the AI inferred from a prompt,
  // which beats the raw words someone typed into a search box.
  const title = projectLabel(session);
  return (
    <div
      className={cn(
        "group/row relative rounded-lg transition-colors",
        active ? "bg-coral/10" : "hover:bg-muted/60",
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full px-2 py-1.5 pr-12 text-left">
        <span
          className={cn(
            "block truncate text-xs font-medium",
            active ? "text-coral" : "text-foreground",
          )}
        >
          {title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {session.candidateCount === 0
            ? "No candidates yet"
            : `${session.candidateCount} candidate${session.candidateCount === 1 ? "" : "s"}`}
          {session.inPipeline > 0 && ` · ${session.inPipeline} in pipeline`}
          {/* Whose work this is only matters when it is not yours. */}
          {!session.isMine && ` · ${session.createdBy}`}
        </span>
      </button>

      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
        <button
          type="button"
          onClick={onPin}
          aria-label={session.pinned ? "Unpin this search" : "Pin this search"}
          title={session.pinned ? "Unpin" : "Pin"}
          disabled={busy}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : session.pinned ? (
            <PinOff className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Pin className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onRename}
          aria-label={session.name ? "Rename this project" : "Name this project"}
          title={session.name ? "Rename" : "Name this project"}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete this project"
          title="Delete"
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {/* A pin that only appears on hover leaves no way to tell pinned rows
          apart at a glance, so a static marker stays until hover replaces it. */}
      {session.pinned && (
        <Pin
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-coral transition-opacity group-hover/row:opacity-0"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default HiringHistoryRail;
