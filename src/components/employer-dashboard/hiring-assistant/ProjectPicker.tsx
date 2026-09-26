import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createProject, projectLabel, type ShortlistSummary } from "@/lib/api/shortlist";

/**
 * Where the candidates a recruiter picks out of this search will go.
 *
 * Shortlisting used to land people in a container named after whatever they had
 * typed, so a third search for the same job scattered them across a third
 * project. Naming the destination — and letting them change it before they
 * start — is what stops that at source rather than tidying it afterwards.
 *
 * Deliberately not a dialog on every add: the destination is stated once, in
 * one line, and only interrupts when someone wants it to.
 */
export function ProjectPicker({
  projects,
  activeId,
  activeLabel,
  onPick,
  className,
}: {
  projects: ShortlistSummary[];
  /** Null before anything has been shortlisted — nothing exists yet. */
  activeId: string | null;
  /** What to call the destination, including the not-yet-created case. */
  activeLabel: string;
  onPick: (projectId: string | null) => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (name: string) => createProject(name),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["hiring-shortlists"] });
      onPick(project.id);
      toast.success(`Adding to ${projectLabel(project)}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span className="shrink-0">Adding to</span>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:border-foreground/20"
          >
            {create.isPending ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
            ) : null}
            <span className="truncate">{activeLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Add candidates to
          </DropdownMenuLabel>

          {/*
            The project this search would start on its own. Offered as a choice
            rather than assumed, because assuming it is what scattered people
            across near-identical searches.
          */}
          <DropdownMenuItem className="text-xs" onClick={() => onPick(null)}>
            <span className="flex-1 truncate">This search</span>
            {activeId === null && <Check className="ml-2 h-3.5 w-3.5" aria-hidden="true" />}
          </DropdownMenuItem>

          {projects.length > 0 && <DropdownMenuSeparator />}
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} className="text-xs" onClick={() => onPick(p.id)}>
              <span className="flex-1 truncate">{projectLabel(p)}</span>
              {p.candidateCount > 0 && (
                <span className="ml-2 shrink-0 tabular-nums text-[10px] text-muted-foreground">
                  {p.candidateCount}
                </span>
              )}
              {activeId === p.id && <Check className="ml-2 h-3.5 w-3.5" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs"
            onClick={() => {
              const name = window.prompt("Name this project")?.trim();
              if (name) create.mutate(name);
            }}
          >
            <FolderPlus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            New project…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default ProjectPicker;
