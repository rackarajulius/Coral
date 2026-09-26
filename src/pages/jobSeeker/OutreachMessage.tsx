import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  readOutreach,
  respondToOutreach,
  type OutreachResponse,
} from "@/lib/api/hiring";

const CHOICES: { value: OutreachResponse; label: string; hint: string }[] = [
  { value: "INTERESTED", label: "I'm interested", hint: "Opens a conversation with them." },
  { value: "NOT_NOW", label: "Not right now", hint: "Maybe later — they'll know not to push." },
  { value: "NOT_INTERESTED", label: "Not interested", hint: "They'll know to stop." },
];

/**
 * An approach from a company, and the place to answer it.
 *
 * Before this, outreach arrived as a notification that linked to the
 * notifications list, and an email from an address nobody reads. There was no
 * way to answer — so nobody did, and the recruiter never learned whether the
 * silence meant "no" or "never saw it".
 *
 * Three answers, one click each. "Interested" opens a conversation, because a
 * yes with nowhere to go is not an answer the recruiter can do anything with.
 */
export default function OutreachMessagePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const outreach = useQuery({
    queryKey: ["outreach", id],
    queryFn: () => readOutreach(id!),
    enabled: !!id,
    retry: false,
  });

  const answer = useMutation({
    mutationFn: (response: OutreachResponse) => respondToOutreach(id!, response, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outreach", id] });
      setNote("");
      toast.success("Your answer was sent");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const data = outreach.data;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24 sm:px-6">
        <Link
          to="/notifications"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Notifications
        </Link>

        {outreach.isLoading && <Skeleton className="h-72 rounded-2xl" />}

        {outreach.isError && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm text-destructive">This message isn't available.</p>
          </div>
        )}

        {data && (
          <article className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From {data.from}
              {data.role && <> · about {data.role}</>}
            </p>
            <h1 className="mt-2 text-xl font-semibold leading-snug">{data.subject}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{data.message}</p>

            <div className="mt-6 border-t border-border pt-5">
              {data.response ? (
                <p className="text-sm">
                  You answered{" "}
                  <strong>{CHOICES.find((c) => c.value === data.response)?.label.toLowerCase()}</strong>
                  {data.responseNote && <span className="text-muted-foreground"> — "{data.responseNote}"</span>}
                  .{" "}
                  <span className="text-muted-foreground">You can change your mind below.</span>
                </p>
              ) : (
                <p className="text-sm font-medium">How would you like to answer?</p>
              )}

              {data.conversationId && (
                <Button asChild size="sm" className="mt-3">
                  <Link to={`/jobseeker/messages?c=${data.conversationId}`}>
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Open the conversation
                  </Link>
                </Button>
              )}

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                placeholder="Add a note if you like (optional)"
                rows={2}
                className="mt-4 w-full resize-none rounded-lg border border-border bg-transparent p-2.5 text-sm outline-none focus:border-primary"
              />

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    disabled={answer.isPending}
                    onClick={() => answer.mutate(c.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                      data.response === c.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                    aria-pressed={data.response === c.value}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {answer.isPending && answer.variables === c.value && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      )}
                      {c.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{c.hint}</span>
                  </button>
                ))}
              </div>

              {/* Said here because it is the question people have before they
                  answer: what does the other side learn from this? */}
              <p className="mt-4 text-xs text-muted-foreground">
                They see your answer and any note. They never see your email address — replies
                happen here, in Coral.
              </p>
            </div>
          </article>
        )}
      </main>
    </>
  );
}
