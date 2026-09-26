import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  REVIEW_CATEGORIES,
  createReview,
  type CategoryRatings,
  type Reviewable,
} from "@/lib/api/reviews";

const MIN_BODY = 60;

function Stars({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} out of 5`}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              size === "sm" ? "h-4 w-4" : "h-6 w-6",
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Writes a review of a hiring process.
 *
 * Tied to one verified interaction — there's no company picker, because a
 * review is only possible where a real application or interview exists.
 */
export function LeaveReviewDialog({
  target,
  open,
  onOpenChange,
}: {
  target: Reviewable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<CategoryRatings>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const reset = () => {
    setRating(0);
    setCategories({});
    setTitle("");
    setBody("");
  };

  const mut = useMutation({
    mutationFn: () =>
      createReview({
        ...(target?.kind === "application"
          ? { applicationId: target.id }
          : { interviewId: target?.id }),
        rating,
        title: title.trim(),
        body: body.trim(),
        categoryRatings: Object.keys(categories).length ? categories : undefined,
      }),
    onSuccess: (result) => {
      // Held reviews are reported honestly rather than as a plain success.
      if (result.status === "published") {
        toast.success("Review published", {
          description: `${target?.company} has been notified. They can reply, but can't remove it.`,
        });
      } else {
        toast.info("Review submitted for checking", {
          description:
            result.pendingReason ?? "A person will read it before it goes live.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["reviewable"] });
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't submit your review"),
  });

  const remaining = MIN_BODY - body.trim().length;
  const canSubmit = rating > 0 && title.trim().length >= 4 && remaining <= 0 && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">
            Review your experience with {target?.company}
          </DialogTitle>
          <DialogDescription>
            {target?.role} · {target?.stageReached}. This is about the hiring process, not the job
            itself.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[58vh] space-y-5 overflow-y-auto px-6 py-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Overall</p>
            <Stars value={rating} onChange={setRating} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Rate what you experienced{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <div className="space-y-2">
              {REVIEW_CATEGORIES.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {c.label}
                    <span className="block text-[11px] text-muted-foreground">{c.hint}</span>
                  </span>
                  <Stars
                    size="sm"
                    value={categories[c.key] ?? 0}
                    onChange={(n) => setCategories((s) => ({ ...s, [c.key]: n }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="review-title">
              Headline
            </label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum it up in a few words"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="review-body">
              What happened
            </label>
            <Textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What was the process like? What went well, what didn't?"
              className="min-h-[130px] resize-y"
              maxLength={4000}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {remaining > 0
                ? `${remaining} more characters needed.`
                : `${body.trim().length} characters.`}
            </p>
          </div>

          {/* Said before submitting, not after — these are the rules that
              determine whether it publishes and what the employer can do. */}
          <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <li>• Your name is never shown to the employer.</li>
            <li>• They can reply publicly. They cannot edit or remove your review.</li>
            <li>• Don't include contact details or name individuals — that holds it for checking.</li>
            <li>• Criticism is fine. Be honest about what actually happened.</li>
          </ul>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LeaveReviewDialog;
