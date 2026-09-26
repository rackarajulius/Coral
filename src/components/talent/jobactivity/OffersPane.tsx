import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { acceptOffer, declineOffer, getMyOffers, type MyOffer } from "@/lib/api/myOffers";

const STATUS_META: Record<MyOffer["status"], { label: string; cls: string }> = {
  SENT: { label: "Awaiting your answer", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  ACCEPTED: { label: "Accepted", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  DECLINED: { label: "Declined", cls: "text-muted-foreground" },
  WITHDRAWN: { label: "Withdrawn by employer", cls: "border-amber-200 bg-amber-50 text-amber-900" },
  EXPIRED: { label: "Expired", cls: "text-muted-foreground" },
};

/**
 * Offers made to this candidate.
 *
 * Answering one is irreversible from here, so both actions confirm first —
 * this is the highest-stakes button in the product and a mis-tap on a phone
 * should not end a job search.
 */
export default function OffersPane() {
  const offers = useQuery({ queryKey: ["my-offers"], queryFn: getMyOffers, retry: false });

  if (offers.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    );
  }

  if (offers.isError) {
    return <p className="text-sm text-destructive">{(offers.error as Error).message}</p>;
  }

  if (!offers.data || offers.data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium">No offers yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          When an employer makes you an offer it appears here, with everything they proposed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {offers.data.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
    </div>
  );
}

function OfferCard({ offer }: { offer: MyOffer }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"accept" | "decline" | null>(null);

  const respond = useMutation({
    mutationFn: (accept: boolean) => (accept ? acceptOffer(offer.id) : declineOffer(offer.id)),
    onSuccess: (_d, accept) => {
      toast.success(accept ? "Offer accepted" : "Offer declined");
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ["my-offers"] });
      // The application's stage moves with the answer, so anything showing it
      // is now stale.
      void queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (e) => {
      // Usually "no longer open" — the employer withdrew it, or it expired
      // while the page was sitting there. Worth reading, not a generic failure.
      toast.error((e as Error).message);
      setConfirming(null);
    },
  });

  const open = offer.status === "SENT";
  const meta = STATUS_META[offer.status];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/jobs?job=${offer.jobId}`}
            className="font-display text-base font-semibold hover:underline"
          >
            {offer.jobTitle}
          </Link>
          <p className="text-sm text-muted-foreground">{offer.company}</p>
        </div>
        <Badge variant="outline" className={cn("text-xs", meta.cls)}>{meta.label}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-muted-foreground">Salary: </span>
          <span className="font-medium">
            {/* Absent rather than zero when the employer named no figure. */}
            {offer.salaryAmount != null
              ? `${(offer.salaryAmount / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: offer.salaryCurrency.toUpperCase(),
                })} / ${offer.salaryPeriod ?? "year"}`
              : "Not stated"}
          </span>
        </span>
        {offer.startDate && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Starts {formatDate(offer.startDate)}
          </span>
        )}
        {offer.expiresAt && open && (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Respond by {formatDate(offer.expiresAt)}
          </span>
        )}
      </div>

      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">
          {offer.message}
        </p>
      )}

      {open && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming("decline")}
            disabled={respond.isPending}
          >
            Decline
          </Button>
          <Button size="sm" onClick={() => setConfirming("accept")} disabled={respond.isPending}>
            {respond.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Accept offer
          </Button>
        </div>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "accept" ? "Accept this offer?" : "Decline this offer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "accept"
                ? `${offer.company} will be told you accepted ${offer.jobTitle}. You cannot undo this here.`
                : `${offer.company} will be told you declined. You cannot undo this here.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => respond.mutate(confirming === "accept")}>
              {confirming === "accept" ? "Accept" : "Decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}
