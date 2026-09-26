import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { Clock, Loader2, Play, Plus, Timer, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  browserTimeZone, createTask, deleteTask, getTaskTemplates, listTasks, runTaskNow, updateTask,
  type ScheduledTask, type TaskCadence, type TaskTemplate,
} from "@/lib/api/automations";
import { listShortlists, type ShortlistSummary } from "@/lib/api/shortlist";

const iconFor = (name: string): LucideIcon =>
  (Icons as unknown as Record<string, LucideIcon>)[name] ?? Timer;

const CADENCES: { value: TaskCadence; label: string }[] = [
  { value: "DAILY", label: "Every day" },
  { value: "WEEKDAYS", label: "Weekdays" },
  { value: "WEEKLY", label: "Weekly" },
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Recurring tasks an employer sets up for themselves.
 *
 * Everything on offer comes from the server's registry, so the gallery cannot
 * advertise a task nothing implements.
 */
export default function Automations() {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<ScheduledTask | null>(null);
  // A per-target task needs its target chosen before it can exist.
  const [pickTargetFor, setPickTargetFor] = useState<TaskTemplate | null>(null);

  const tasks = useQuery({ queryKey: ["automations"], queryFn: listTasks, retry: false });
  const templates = useQuery({
    queryKey: ["automation-templates"],
    queryFn: getTaskTemplates,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["automations"] });

  const add = useMutation({
    mutationFn: ({ t, shortlistId }: { t: TaskTemplate; shortlistId?: string }) =>
      createTask({
        type: t.type,
        cadence: t.cadence,
        hourLocal: t.hourLocal,
        weekday: t.weekday,
        shortlistId,
      }),
    onSuccess: (t) => {
      refresh();
      setPickTargetFor(null);
      toast.success("Task added", { description: t.cadenceLabel });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const patch = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Parameters<typeof updateTask>[1]) =>
      updateTask(id, rest),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      refresh();
      toast.success("Task removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const run = useMutation({
    mutationFn: runTaskNow,
    onSuccess: (outcome) => {
      refresh();
      // The real result, verbatim — including when it found nothing, which is
      // the answer people most need to trust.
      toast.success(outcome.title, { description: outcome.message });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const active = tasks.data ?? [];
  const activeTypes = new Set(active.map((t) => t.type));
  const available = (templates.data ?? []).filter(
    (t) => t.allowMultiple || !activeTypes.has(t.type),
  );

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recurring checks that tell you when something needs attention. They run in your own
          timezone ({browserTimeZone()}).
        </p>
      </header>

      {tasks.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : tasks.isError ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {(tasks.error as Error)?.message || "Couldn't load your automations."}
        </p>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">No automations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Pick one below and it will start checking for you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((task) => {
            const Icon = iconFor(task.icon);
            return (
              <article
                key={task.id}
                className={cn(
                  "rounded-xl border border-border bg-card p-4 transition-opacity",
                  !task.enabled && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">
                        {task.targetLabel ?? task.label}
                      </h2>
                      {task.targetId && !task.targetLabel && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          Search deleted
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">· {task.cadenceLabel}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>

                    {/* What it actually reported last time, not a claim about
                        what it will find. */}
                    {task.lastSummary && (
                      <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-foreground/80">
                        Last run: {task.lastSummary}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select
                        value={task.cadence}
                        onValueChange={(v) =>
                          patch.mutate({ id: task.id, cadence: v as TaskCadence })
                        }
                      >
                        <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CADENCES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {task.cadence === "WEEKLY" && (
                        <Select
                          value={String(task.weekday ?? 1)}
                          onValueChange={(v) => patch.mutate({ id: task.id, weekday: Number(v) })}
                        >
                          <SelectTrigger className="h-8 w-[124px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {WEEKDAYS.map((d, i) => (
                              <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Select
                        value={String(task.hourLocal)}
                        onValueChange={(v) => patch.mutate({ id: task.id, hourLocal: Number(v) })}
                      >
                        <SelectTrigger className="h-8 w-[96px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => run.mutate(task.id)}
                        disabled={run.isPending}
                      >
                        {run.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Run now
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive"
                        onClick={() => setConfirmDelete(task)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={task.notifyWhenEmpty}
                        onCheckedChange={(v) =>
                          patch.mutate({ id: task.id, notifyWhenEmpty: v })
                        }
                      />
                      Tell me even when there is nothing to report
                    </label>
                  </div>

                  <Switch
                    checked={task.enabled}
                    onCheckedChange={(v) => patch.mutate({ id: task.id, enabled: v })}
                    aria-label={task.enabled ? "Pause this task" : "Resume this task"}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <>
          <div className="my-8 border-t border-dashed border-border" />
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {active.length === 0 ? "Start with one of these" : "Add another"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((t) => {
              const Icon = iconFor(t.icon);
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() =>
                    t.requiresTarget ? setPickTargetFor(t) : add.mutate({ t })
                  }
                  disabled={add.isPending}
                  className="group row-tile flex items-start gap-3 p-4 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none disabled:opacity-60"
                >
                  {/* The icon becomes the add affordance on hover, so the plus
                      appears where your eye already is rather than at the far
                      edge of the card. */}
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-foreground/10">
                    <Icon
                      className="h-4 w-4 text-foreground transition-opacity group-hover:opacity-0"
                      aria-hidden="true"
                    />
                    <Plus
                      className="absolute h-4 w-4 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.description}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {t.cadenceLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <ShortlistPicker
        template={pickTargetFor}
        busy={add.isPending}
        alreadyWatching={new Set(active.map((t) => t.targetId).filter(Boolean) as string[])}
        onClose={() => setPickTargetFor(null)}
        onPick={(shortlistId) => {
          if (pickTargetFor) add.mutate({ t: pickTargetFor, shortlistId });
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this automation?</AlertDialogTitle>
            <AlertDialogDescription>
              It will stop checking. You can add it again at any time — nothing else is affected.
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
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Chooses which saved search a watcher should follow.
 *
 * Only offered when a search exists — an empty picker would advertise a task
 * that cannot yet be created, which is worse than not offering it at all.
 */
function ShortlistPicker({
  template, busy, alreadyWatching, onClose, onPick,
}: {
  template: TaskTemplate | null;
  busy: boolean;
  alreadyWatching: Set<string>;
  onClose: () => void;
  onPick: (shortlistId: string) => void;
}) {
  const shortlists = useQuery({
    queryKey: ["hiring-shortlists"],
    queryFn: listShortlists,
    enabled: !!template,
    retry: false,
  });

  const rows: ShortlistSummary[] = shortlists.data ?? [];

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Which search should I watch?</DialogTitle>
          <DialogDescription>
            You'll hear when someone new matches it. Only candidates who opted in to being found
            are counted.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-1.5 overflow-y-auto py-1">
          {shortlists.isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You have no saved searches yet. Run one from Talent Scout first.
            </p>
          ) : (
            rows.map((sl) => {
              const watched = alreadyWatching.has(sl.id);
              return (
                <button
                  key={sl.id}
                  type="button"
                  disabled={busy || watched}
                  onClick={() => onPick(sl.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                    watched ? "opacity-50" : "hover:border-coral/40 hover:bg-muted/40",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {sl.roleTitle?.trim() || sl.query}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {watched
                        ? "Already being watched"
                        : `${sl.candidateCount} candidate${sl.candidateCount === 1 ? "" : "s"} so far`}
                    </span>
                  </span>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
