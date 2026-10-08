import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Mail, MailOpen, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getOutreachForCandidate, type OutreachToCandidate } from "@/lib/api/hiring";

/**
 * What this company has said to this candidate, and what they said back.
 *
 * The analytics card reports open and reply rates across everyone. This is the
 * other half of that: before writing to someone, a recruiter needs to know
 * whether a colleague already did — and whether they were told no. Until now
 * the only trace of an answer was a notification that scrolled away.
 */
export function OutreachHistoryBlock({ candidateId }: { candidateId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["outreach", "candidate", candidateId],
    queryFn: () => getOutreachForCandidate(candidateId),
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-24 rounded-2xl" />;
  // Quiet on failure: this is context beside the profile, not the profile.
  if (isError || !data || data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        Outreach · {data.length}
      </p>

      <div className="mt-3 space-y-3">
        {data.map((m) => (
          <OutreachRow key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}

const RESPONSE: Record<string, { label: string; cls: string }> = {
  INTERESTED: {
    label: "Interested",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  },
  NOT_NOW: {
    label: "Not right now",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  },
  NOT_INTERESTED: {
    label: "Not interested",
    cls: "bg-muted text-muted-foreground ring-border",
  },
};

function OutreachRow({ message: m }: { message: OutreachToCandidate }) {
  const answer = m.response ? RESPONSE[m.response] : null;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{m.subject}</p>
        {answer && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
              answer.cls,
            )}
          >
            {answer.label}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {m.sentByMe ? "You" : m.sentBy} · {when(m.sentAt)}
        {m.role ? ` · ${m.role}` : ""}
      </p>

      {/*
        Opens are only counted inside Coral. Saying "not opened" would assert
        something we deliberately do not measure — tracking an email open means
        a pixel in someone's inbox, which a recruiter's open rate does not
        justify.
      */}
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MailOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
        {m.openedAt ? `Opened in Coral ${when(m.openedAt)}` : "Not opened in Coral — they may have read the email"}
      </p>

      {m.responseNote && (
        <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs italic text-foreground">
          “{m.responseNote}”
        </p>
      )}

      {/* Saying yes opened a thread; this is the way back into it. */}
      {m.conversationId && (
        <Link
          to={`/employers/chat?c=${m.conversationId}`}
          className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          Open the conversation
        </Link>
      )}
    </div>
  );
}

function when(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default OutreachHistoryBlock;
