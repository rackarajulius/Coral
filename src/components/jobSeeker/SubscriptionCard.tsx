import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMySubscription, openBillingPortal, premiumSummary } from "@/lib/api/premium";
import { getMyEntitlements, type MetricStatus } from "@/lib/api/entitlements";

/**
 * The account's plan, in Settings.
 *
 * Billing belongs to the account, so it lives here as well as on /premium.
 * Card details, receipts and cancelling are all in Stripe's portal — this only
 * says where things stand and opens the door.
 */
export function SubscriptionCard() {
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: getMySubscription,
    retry: false,
  });

  const manage = async () => {
    setBusy(true);
    try {
      await openBillingPortal("/jobseeker/settings");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const usage = useQuery({ queryKey: ["entitlements"], queryFn: getMyEntitlements, retry: false });
  const isPremium = data?.tier === "premium";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Crown className="w-5 h-5" aria-hidden="true" />
          Subscription
        </CardTitle>
        <CardDescription>Your plan and billing</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div>
            <p className="font-medium">{isPremium ? "Premium" : "Free"}</p>
            <p className="text-sm text-gray-500">
              {isPremium && data
                ? [
                    ...premiumSummary(data),
                    data.paid && data.status === "PAST_DUE" && "Last payment failed — update your card",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Active"
                : "Interview practice and matching with jobs posted here."}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {data?.hasBillingAccount && (
            <Button variant="outline" size="sm" onClick={manage} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage billing"}
            </Button>
          )}
          {!isPremium && (
            <Button size="sm" asChild>
              <Link to="/premium">See Premium</Link>
            </Button>
          )}
        </div>
      </CardContent>

      {usage.data && (
        <CardContent className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Usage</p>
          <ul className="space-y-1.5">
            {usage.data.metrics.map((m) => (
              <li key={m.metric} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-300">{m.label}</span>
                <span className="text-right text-gray-500">{usageText(m, usage.data.enforced)}</span>
              </li>
            ))}
          </ul>
          {!usage.data.enforced && (
            <p className="mt-3 text-xs text-gray-500">
              Limits aren't applied yet — usage is counted so you can see it, but nothing is blocked.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * One line of usage, worded for what is actually true.
 *
 * A Premium-only feature a free account used while limits are off would
 * otherwise read "3 of 0" — correct arithmetic, nonsense to a person.
 */
function usageText(m: MetricStatus, enforced: boolean): string {
  const per = m.window === "day" ? "today" : "this month";
  if (m.limit === null) return `${m.used} ${per}`;
  if (m.limit === 0) return enforced ? "Premium" : `${m.used} ${per} · open during preview`;
  const resets =
    m.used >= m.limit && m.resetsAt
      ? ` · back ${new Date(m.resetsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
      : "";
  return `${m.used} of ${m.limit} ${per}${resets}`;
}

export default SubscriptionCard;
