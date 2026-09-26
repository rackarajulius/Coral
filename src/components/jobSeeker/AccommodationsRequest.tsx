import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Accessibility, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  requestAccommodations,
  type AccommodationNeed,
  type ScreenAccommodations,
} from "@/lib/api/aiScreen";

const NEEDS: { value: AccommodationNeed; label: string; detail: string }[] = [
  {
    value: "extra_time",
    label: "More time to answer",
    detail: "Longer pauses won't end your answer early.",
  },
  {
    value: "typed_answers",
    label: "Type instead of speak",
    detail: "The interview starts in typing mode.",
  },
  {
    value: "human_interviewer",
    label: "A person instead of the AI",
    detail: "We'll ask the employer to arrange a human interviewer.",
  },
  {
    value: "assistive_tech",
    label: "I use a screen reader or other assistive software",
    detail: "Stops your use of it being recorded as unusual activity.",
  },
  { value: "other", label: "Something else", detail: "Tell us below." },
];

/**
 * Adjustment request for a screening.
 *
 * Asks what someone needs and never why. There is deliberately no field for a
 * condition or diagnosis: the employer does not need one to honour a request,
 * requiring it is unlawful in many places, and it would be the most sensitive
 * record in the system for no benefit.
 */
export function AccommodationsRequest({
  screenId,
  existing,
}: {
  screenId: string;
  existing: ScreenAccommodations | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [needs, setNeeds] = useState<Set<AccommodationNeed>>(new Set());
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: () => requestAccommodations(screenId, { needs: [...needs], note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success("Request sent", {
        description: "The employer has been told what you need. This won't count against you.",
      });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ai-screen", screenId] });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't send your request"),
  });

  if (existing) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          {existing.status === "acknowledged"
            ? "The employer has confirmed your adjustments"
            : "Your request has been sent"}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {existing.needs.map((n) => (
            <li key={n}>• {NEEDS.find((x) => x.value === n)?.label ?? n}</li>
          ))}
        </ul>
        {existing.needs.includes("human_interviewer") && (
          <p className="mt-2 text-xs text-muted-foreground">
            You asked for a human interviewer. You don't have to take the AI interview — wait for
            the employer to get in touch.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        <Accessibility className="h-4 w-4" aria-hidden="true" />
        Need this done differently?
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">What would help?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick anything you need. You don't have to explain why, and asking won't count against your
        application.
      </p>

      <div className="mt-3 space-y-2.5">
        {NEEDS.map((n) => (
          <label key={n.value} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              checked={needs.has(n.value)}
              onCheckedChange={(v) =>
                setNeeds((s) => {
                  const next = new Set(s);
                  if (v === true) next.add(n.value);
                  else next.delete(n.value);
                  return next;
                })
              }
              className="mt-0.5"
            />
            <span>
              <span className="text-foreground">{n.label}</span>
              <span className="block text-xs text-muted-foreground">{n.detail}</span>
            </span>
          </label>
        ))}
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything else that would help (optional)"
        className="mt-3 min-h-[70px] resize-y"
        aria-label="Anything else that would help"
      />

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={() => mut.mutate()} disabled={needs.size === 0 || mut.isPending}>
          {mut.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Send request
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={mut.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
