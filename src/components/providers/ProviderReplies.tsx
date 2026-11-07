import { useQuery } from "@tanstack/react-query";
import { MessageSquareReply } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMyProviderResponsiveness,
  getProviderResponsiveness,
  replyWithin,
  type ProviderResponsiveness,
} from "@/lib/api/providers";

/** What every reading of these figures should know about where they come from. */
const HOW_MEASURED =
  "Measured on Coral from requests for their services in the past year. Requests a client withdrew aren't counted, and a new request only counts once it's a week old.";

function headline(r: ProviderResponsiveness, who: "they" | "you") {
  const replied = `${who === "you" ? "You replied" : "Replied"} to ${r.replied} of ${r.considered} ${r.considered === 1 ? "request" : "requests"}`;
  return r.medianHoursToReply === null ? replied : `${replied}, usually ${replyWithin(r.medianHoursToReply)}`;
}

/**
 * How they reply to requests, on their provider profile, once Coral has
 * measured enough to say. Nothing at all until then: an empty "no data"
 * reads as a warning about someone who has simply not been asked yet.
 *
 * The owner previewing gets their own figures, shown only as clients would
 * see them.
 */
export function ProviderReplies({ userId }: { userId: string }) {
  const { user } = useAuth();
  const isMe = user?.id === userId;
  const replies = useQuery({
    queryKey: ["providers", "responsiveness", isMe ? "me" : userId],
    queryFn: ({ signal }) => (isMe ? getMyProviderResponsiveness(signal) : getProviderResponsiveness(userId, signal)),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const r = replies.data;
  if (!r?.available) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareReply className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Replies to requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-medium">{headline(r, "they")}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {HOW_MEASURED}
          {r.medianHoursToReply !== null && " \"Usually\" is the median: half of their replies came sooner."}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The provider's own view, on their setup page: the same figures clients
 * see, or how close they are to being shown. Told before it is public, so
 * a profile's reply record never arrives as a surprise.
 */
export function ProviderReplyStatus() {
  const replies = useQuery({
    queryKey: ["providers", "responsiveness", "me"],
    queryFn: ({ signal }) => getMyProviderResponsiveness(signal),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const r = replies.data;
  if (!r) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
          How you reply
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-6">
        {r.available ? (
          <>
            <p className="font-medium">{headline(r, "you")}</p>
            <p className="text-muted-foreground">Clients see this on your public profile.</p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Once {r.needed} requests for your services have come in, clients will see how many you answered and how quickly.
            {r.considered > 0 && ` So far: ${r.considered}.`}
          </p>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          Accepting, declining or replying all count as an answer. A request left unanswered for a week counts as missed.
        </p>
      </CardContent>
    </Card>
  );
}
