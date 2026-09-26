import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Loader2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getOfferForApplication,
  saveOfferDraft,
  sendOffer,
  withdrawOffer,
  type Offer,
  type OfferStatus,
} from "@/lib/api/ats";
import { OfferSignalsPanel } from "./OfferSignalsPanel";

const STATUS_META: Record<OfferStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "text-muted-foreground" },
  SENT: { label: "Awaiting response", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  ACCEPTED: { label: "Accepted", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  DECLINED: { label: "Declined", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  WITHDRAWN: { label: "Withdrawn", cls: "text-muted-foreground" },
  EXPIRED: { label: "Expired", cls: "border-amber-200 bg-amber-50 text-amber-700" },
};

/**
 * The offer, on the candidate's own record.
 *
 * The last stage of hiring used to happen entirely in email, so the platform
 * could not answer "did we ever make them an offer, and what did they say?".
 *
 * A draft is invisible to the candidate until it is deliberately sent —
 * composing a salary is not the same act as telling someone.
 */
export function OfferBlock({
  applicationId,
  candidateName,
}: {
  applicationId: string;
  candidateName: string;
}) {
  const queryClient = useQueryClient();

  const offer = useQuery({
    queryKey: ["offer", applicationId],
    queryFn: () => getOfferForApplication(applicationId),
    retry: false,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["offer", applicationId] });

  if (offer.isLoading) return <Skeleton className="h-32 rounded-2xl" />;

  // A refusal here is usually "this application is not yours", which is worth
  // reading rather than rendering as an empty offer form.
  if (offer.isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-destructive">{(offer.error as Error).message}</p>
      </div>
    );
  }

  const existing = offer.data;
  const editable = !existing || existing.status === "DRAFT";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileSignature className="h-4 w-4 text-primary" aria-hidden="true" /> Offer
        </h4>
        {existing && (
          <Badge variant="outline" className={cn("text-xs", STATUS_META[existing.status].cls)}>
            {STATUS_META[existing.status].label}
          </Badge>
        )}
      </div>

      {editable ? (
        <OfferForm
          applicationId={applicationId}
          candidateName={candidateName}
          existing={existing ?? null}
          onSaved={refresh}
        />
      ) : (
        <SentOffer offer={existing!} onChanged={refresh} />
      )}
    </div>
  );
}

/* ---------------------------------- draft ---------------------------------- */

function OfferForm({
  applicationId,
  candidateName,
  existing,
  onSaved,
}: {
  applicationId: string;
  candidateName: string;
  existing: Offer | null;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("cad");
  const [period, setPeriod] = useState("yearly");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    if (!existing) return;
    // Stored in the currency's smallest unit; shown in whole units.
    setAmount(existing.salaryAmount != null ? String(existing.salaryAmount / 100) : "");
    setCurrency(existing.salaryCurrency);
    setPeriod(existing.salaryPeriod ?? "yearly");
    setStartDate(existing.startDate?.slice(0, 10) ?? "");
    setExpiresAt(existing.expiresAt?.slice(0, 10) ?? "");
    setMessage(existing.message ?? "");
    setInternalNotes(existing.internalNotes ?? "");
  }, [existing?.id]);

  const draft = () => ({
    // Rounded because minor units are integers — 1234.567 is not a price.
    salaryAmount: amount.trim() ? Math.round(Number(amount) * 100) : null,
    salaryCurrency: currency,
    salaryPeriod: period,
    startDate: startDate || null,
    expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    message: message.trim() || null,
    internalNotes: internalNotes.trim() || null,
  });

  const save = useMutation({
    mutationFn: () => saveOfferDraft(applicationId, draft()),
    onSuccess: () => {
      toast.success("Draft saved");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const send = useMutation({
    // Saved first, so what is sent is what is on screen rather than whatever
    // was last written to the server.
    mutationFn: async () => {
      const saved = await saveOfferDraft(applicationId, draft());
      return sendOffer(saved.id);
    },
    onSuccess: () => {
      toast.success("Offer sent", { description: `${candidateName} has been notified.` });
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const amountInvalid = amount.trim() !== "" && !(Number(amount) >= 0);
  const busy = save.isPending || send.isPending;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Label htmlFor="offer-amount" className="text-xs">Salary</Label>
          <Input
            id="offer-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Optional"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="offer-currency" className="text-xs">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="offer-currency" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cad">CAD</SelectItem>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="eur">EUR</SelectItem>
              <SelectItem value="gbp">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="offer-period" className="text-xs">Per</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger id="offer-period" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yearly">Year</SelectItem>
              <SelectItem value="monthly">Month</SelectItem>
              <SelectItem value="hourly">Hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {amountInvalid && (
        <p className="text-xs text-destructive">Salary must be a positive number.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="offer-start" className="text-xs">Start date</Label>
          <Input id="offer-start" type="date" value={startDate}
            onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="offer-expires" className="text-xs">Respond by</Label>
          <Input id="offer-expires" type="date" value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)} className="mt-1" />
          {/* No deadline is a real choice, and not the same as one that has
              passed — so this stays empty rather than being pre-filled. */}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Leave empty for no deadline.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="offer-message" className="text-xs">
          Message <span className="font-normal text-muted-foreground">— the candidate reads this</span>
        </Label>
        <Textarea id="offer-message" value={message} onChange={(e) => setMessage(e.target.value)}
          rows={3} maxLength={5000} className="mt-1 resize-none"
          placeholder="Anything they should know alongside the numbers." />
      </div>

      <div>
        <Label htmlFor="offer-internal" className="text-xs">
          Internal notes <span className="font-normal text-muted-foreground">— never shown to them</span>
        </Label>
        <Textarea id="offer-internal" value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2} maxLength={5000} className="mt-1 resize-none"
          placeholder="Approval, budget, negotiating room." />
      </div>

      {/* Checks what is on screen, before anything is saved or sent. */}
      <OfferSignalsPanel
        applicationId={applicationId}
        // Only the fields the signals read — typing the message shouldn't re-check.
        draft={
          amountInvalid
            ? undefined
            : (({ salaryAmount, salaryCurrency, salaryPeriod, startDate, expiresAt }) => ({
                salaryAmount, salaryCurrency, salaryPeriod, startDate, expiresAt,
              }))(draft())
        }
      />

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={busy || amountInvalid}>
          Save draft
        </Button>
        <Button size="sm" onClick={() => send.mutate()} disabled={busy || amountInvalid}>
          {send.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Send offer
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- sent ----------------------------------- */

function SentOffer({ offer, onChanged }: { offer: Offer; onChanged: () => void }) {
  const withdraw = useMutation({
    mutationFn: () => withdrawOffer(offer.id),
    onSuccess: () => {
      toast.success("Offer withdrawn", { description: "The candidate has been told." });
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <Fact label="Salary" value={
          offer.salaryAmount != null
            ? `${(offer.salaryAmount / 100).toLocaleString(undefined, {
                style: "currency", currency: offer.salaryCurrency.toUpperCase(),
              })} / ${offer.salaryPeriod ?? "year"}`
            : "—"
        } />
        <Fact label="Starts" value={offer.startDate ? formatDate(offer.startDate) : "—"} />
        <Fact label="Respond by" value={offer.expiresAt ? formatDate(offer.expiresAt) : "No deadline"} />
      </div>

      {offer.message && (
        <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">{offer.message}</p>
      )}
      {offer.internalNotes && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Internal:</span> {offer.internalNotes}
        </p>
      )}

      {/* While it waits for an answer, the facts are still worth watching. */}
      {offer.status === "SENT" && (
        <OfferSignalsPanel applicationId={offer.applicationId} title="While you wait" />
      )}

      {/* Only a live offer can be pulled back. A declined or expired one is
          already over, and "withdraw" would imply we changed something. */}
      {offer.status === "SENT" && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => withdraw.mutate()}
            disabled={withdraw.isPending}>
            {withdraw.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Withdraw
          </Button>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default OfferBlock;
