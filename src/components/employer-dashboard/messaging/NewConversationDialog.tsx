import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMyJobApplicants } from "@/lib/api/employerCandidates";
import { startConversation } from "@/lib/api/messaging";
import { useMessageStore } from "@/stores/messageStore";

/** One person you may write to, with what licenses the contact. */
interface Reachable {
  candidateId: string;
  name: string;
  initials: string;
  email: string;
  /** The most recent job they applied for. */
  role: string;
  jobId: string;
  /** More than one application to this company. */
  applications: number;
  /** A thread already exists — picking them reopens it rather than starting one. */
  existingConversationId?: string;
}

/**
 * Who a recruiter may start a conversation with.
 *
 * **Only people who actually applied.** `startConversation` refuses anyone else
 * with a 403 — the application to the company is the consent that licenses the
 * contact — so this reads the applicants endpoint rather than the merged
 * pipeline board. The board also carries *sourced* candidates from Talent
 * Scout, who never applied, and offering those would be offering rows that fail
 * the moment they are clicked.
 *
 * Unlike the social-network pickers this resembles, there is no search across
 * every user and no group option: conversations are one employer to one
 * candidate by schema, and a group button could not be made to work.
 */
export default function NewConversationDialog({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [q, setQ] = useState("");
  const conversations = useMessageStore((s) => s.conversations);
  const setActiveConversation = useMessageStore((s) => s.setActiveConversation);
  const loadConversations = useMessageStore((s) => s.loadConversations);

  /**
   * Searching and paging stay on the server. Narrowing the first page in the
   * browser would quietly turn "search" into "search the newest fifty", which
   * is the same trap the candidate board already avoids.
   */
  const applicants = useQuery({
    queryKey: ["reachable-candidates", q.trim()],
    queryFn: () => getMyJobApplicants({ q: q.trim(), limit: 50, sort: "recent" }),
    enabled: open,
    staleTime: 30 * 1000,
    retry: false,
  });

  // Who the company already has a thread with, so a row can say so.
  const threadByCandidate = new Map(
    conversations.filter((c) => c.viewerIsEmployer).map((c) => [c.peerId, c.id]),
  );

  /**
   * One row per person, not per application. Someone who applied to three
   * roles is one conversation, and listing them three times would let a
   * recruiter "start" the same thread from three places.
   */
  const people: Reachable[] = [];
  const seen = new Map<string, number>();
  for (const c of applicants.data?.candidates ?? []) {
    const id = c.applicantId;
    if (!id) continue;
    const at = seen.get(id);
    if (at !== undefined) {
      people[at].applications += 1;
      continue;
    }
    seen.set(id, people.length);
    people.push({
      candidateId: id,
      name: c.name,
      initials: c.initials,
      email: c.email,
      role: c.role,
      jobId: c.jobId ?? "",
      applications: 1,
      existingConversationId: threadByCandidate.get(id),
    });
  }

  const start = useMutation({
    mutationFn: (p: Reachable) => startConversation(p.candidateId, p.jobId || undefined),
    onSuccess: async ({ id }) => {
      // The server reuses a colleague's existing thread, so this may be an old
      // conversation rather than a new one. Either way it is the right one.
      await loadConversations();
      setActiveConversation(id);
      onStarted();
      onClose();
    },
    // The server's message is the rule itself ("you can only message candidates
    // who applied…"), which is worth showing verbatim.
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            People who applied to one of your jobs. That application is what lets you write to
            them.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your applicants by name or email"
              className="pl-9"
            />
          </div>
        </div>

        <div className="max-h-[22rem] min-h-[12rem] overflow-y-auto px-2 pb-3">
          {applicants.isLoading ? (
            <div className="space-y-2 px-3 py-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : applicants.isError ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {(applicants.error as Error)?.message || "Couldn't load your applicants."}
            </p>
          ) : people.length === 0 ? (
            /* Says why it is empty. A blank list here reads as a broken search
               rather than as the boundary it actually is. */
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium">
                {q.trim() ? "Nobody matches that." : "No applicants yet."}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                {q.trim()
                  ? "This searches the people who applied to your jobs — the only people you can write to."
                  : "You can start a conversation once someone applies to one of your jobs."}
              </p>
            </div>
          ) : (
            people.map((p) => {
              const pending = start.isPending && start.variables?.candidateId === p.candidateId;
              return (
                <button
                  key={p.candidateId}
                  type="button"
                  disabled={start.isPending}
                  onClick={() => start.mutate(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    "hover:bg-muted disabled:opacity-60",
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-coral/15 text-xs font-medium text-coral">
                      {p.initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      {/* Picking them reopens the thread, history and all.
                          Calling that "new" would look like a bug. */}
                      {p.existingConversationId && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          In your inbox
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.applications > 1
                        ? `${p.applications} applications · ${p.role}`
                        : p.role || p.email}
                    </p>
                  </div>

                  {pending ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <p className="flex items-start gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Candidates you sourced but who have not applied are not listed. Reach those through
          Talent Scout, which asks their permission first.
        </p>
      </DialogContent>
    </Dialog>
  );
}
