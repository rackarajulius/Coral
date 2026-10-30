import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { MarketplaceOwner } from "@/lib/api/marketplace";
import {
  markMarketplaceWorkDone,
  markMarketplaceWorkNotDone,
  setMarketplaceWorkChoices,
  type MarketplaceRequestDetail,
} from "@/lib/api/marketplaceRequests";

const day = (value: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value));

/**
 * Work done through Coral, inside the conversation: either side says the work
 * is done, the other confirms, and only then does it show on the provider's
 * profile. After that the provider chooses whether it shows, and the client
 * whether their name is beside it — nobody chooses for the other.
 */
export function WorkDonePanel({ record, owner, detailKey, onChanged }: {
  record: MarketplaceRequestDetail;
  owner: MarketplaceOwner;
  detailKey: unknown[];
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const saved = (updated: MarketplaceRequestDetail) => { queryClient.setQueryData(detailKey, updated); onChanged(); };
  const done = useMutation({ mutationFn: () => markMarketplaceWorkDone(record.id, owner), onSuccess: saved });
  const notDone = useMutation({ mutationFn: () => markMarketplaceWorkNotDone(record.id, owner), onSuccess: saved });
  const choose = useMutation({ mutationFn: (choices: { shown?: boolean; named?: boolean }) => setMarketplaceWorkChoices(record.id, choices, owner), onSuccess: saved });

  const role = record.workRole;
  const work = record.work;
  const canMark = !!record.permissions.canMarkDone;
  if (!role || (!work && !canMark)) return null;

  const counterpart = record.viewerSide === "recipient" ? record.requester : record.recipient;
  // The client's own side of the request: who would be named.
  const clientCompany = record.viewerSide === "requester" ? record.requesterCompany : record.recipientCompany;
  const busy = done.isPending || notDone.isPending || choose.isPending;
  const error = done.error ?? notDone.error ?? choose.error;
  const whose = role === "provider" ? "your profile" : `${counterpart.displayName}'s profile`;

  return (
    <section className="rounded-xl border p-4" aria-label="Work done through Coral">
      {work?.confirmedAt ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Done. You both confirmed it on {day(work.confirmedAt)}.
          </p>
          {role === "provider" ? (
            <label className="flex items-start justify-between gap-4 text-sm">
              <span>
                <span className="block font-medium">Show it on my profile</span>
                <span className="block text-xs leading-5 text-muted-foreground">As work done through Coral: the service and the month. {counterpart.displayName} decides whether their name appears.</span>
              </span>
              <Switch checked={work.shown} disabled={busy} onCheckedChange={(shown) => choose.mutate({ shown })} aria-label="Show it on my profile" />
            </label>
          ) : (
            <label className="flex items-start justify-between gap-4 text-sm">
              <span>
                <span className="block font-medium">{clientCompany ? `Show ${clientCompany.name}'s name with it` : "Show my name with it"}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{counterpart.displayName} can show this as work done through Coral. Your name appears only if you turn this on, and you can turn it off later.</span>
              </span>
              <Switch checked={work.clientNamed} disabled={busy} onCheckedChange={(named) => choose.mutate({ named })} aria-label={clientCompany ? `Show ${clientCompany.name}'s name with it` : "Show my name with it"} />
            </label>
          )}
        </div>
      ) : work?.proposedBySelf ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">You said this work was done on {day(work.proposedAt)}. Waiting for {counterpart.displayName} to confirm.</p>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => notDone.mutate()}>Take it back</Button>
        </div>
      ) : work ? (
        <div className="space-y-3">
          <p className="text-sm"><span className="font-medium">{counterpart.displayName} says this work is done.</span> Is it? Once you both say so, it shows on {whose} as work done through Coral.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => done.mutate()}>{done.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Yes, it's done</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => notDone.mutate()}>Not yet</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Finished? When you both say so, it shows on {whose} as work done through Coral.{role === "client" ? " Your name stays off unless you add it." : ""}
          </p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => done.mutate()}>{done.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Mark as done</Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive" role="alert">{(error as Error).message}</p>}
    </section>
  );
}

export default WorkDonePanel;
