import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createExternalApplication,
  deleteExternalApplication,
  getExternalApplications,
  updateExternalApplication,
  type ExternalApplication,
  type ExternalStatus,
} from "@/lib/api/externalApplications";

const QUERY_KEY = ["external-applications"] as const;
const STATUSES: { value: ExternalStatus; label: string }[] = [
  { value: "saved", label: "Saved, not applied" },
  { value: "applied", label: "Applied" },
  { value: "under_review", label: "Under review" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

function ExternalCard({ item }: { item: ExternalApplication }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(item.notes ?? "");
  const [followUpAt, setFollowUpAt] = useState(item.followUpAt?.slice(0, 10) ?? "");
  const [appliedAt, setAppliedAt] = useState(item.appliedAt?.slice(0, 10) ?? "");
  useEffect(() => { setAppliedAt(item.appliedAt?.slice(0, 10) ?? ""); }, [item.appliedAt]);
  const update = useMutation({
    mutationFn: (input: Parameters<typeof updateExternalApplication>[1]) => updateExternalApplication(item.id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Tracker updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteExternalApplication(item.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.company}</p>
          <p className="text-xs text-muted-foreground">
            {item.appliedAt ? `You marked applied ${item.appliedAt.slice(0, 10)}` : "Opening the job link does not mark it applied"}
          </p>
        </div>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-coral hover:underline">
            Open job <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`external-status-${item.id}`}>Your status</Label>
          <select
            id={`external-status-${item.id}`}
            value={item.status}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ status: e.target.value as ExternalStatus })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`external-follow-up-${item.id}`}>In-app follow-up reminder</Label>
          <Input id={`external-follow-up-${item.id}`} type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
        </div>
        {item.status !== "saved" && <div className="space-y-1">
          <Label htmlFor={`external-applied-${item.id}`}>Applied on</Label>
          <Input id={`external-applied-${item.id}`} type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
        </div>}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`external-notes-${item.id}`}>Private notes</Label>
        <Textarea id={`external-notes-${item.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Recruiter, next step, or where you left off" />
      </div>
      <div className="flex justify-between gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => {
          if (window.confirm(`Remove ${item.title} from your external tracker?`)) remove.mutate();
        }}><Trash2 className="h-4 w-4" /> Remove</Button>
        <Button type="button" size="sm" disabled={update.isPending} onClick={() => update.mutate({
          notes,
          followUpAt: followUpAt ? `${followUpAt}T12:00:00.000Z` : null,
          ...(item.status !== "saved" && appliedAt ? { appliedAt: `${appliedAt}T00:00:00.000Z` } : {}),
        })}>Save details</Button>
      </div>
    </article>
  );
}

export default function ExternalApplicationsPane() {
  const qc = useQueryClient();
  const { data: items, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: getExternalApplications, staleTime: 60_000 });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const create = useMutation({
    mutationFn: createExternalApplication,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      setTitle(""); setCompany(""); setUrl(""); setAdding(false);
      toast.success("Saved. Mark it applied after you submit on the employer's site.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">External applications</h2>
          <p className="text-sm text-muted-foreground">Keep jobs from other sites here. Statuses are yours to update; Coral cannot see what happened on an employer's site.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setAdding((v) => !v)}><Plus className="h-4 w-4" /> Add a job</Button>
      </div>
      {adding && (
        <form className="rounded-xl border border-border bg-card p-4 space-y-3" onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ title: title.trim(), company: company.trim(), url: url.trim() });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="external-title">Job title</Label><Input id="external-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required /></div>
            <div><Label htmlFor="external-company">Company</Label><Input id="external-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={255} required /></div>
          </div>
          <div><Label htmlFor="external-url">Job link</Label><Input id="external-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2000} placeholder="https://…" required /></div>
          <Button type="submit" size="sm" disabled={create.isPending}>Save job</Button>
        </form>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading external jobs…</p>
        : isError ? <div className="text-sm text-destructive">Couldn't load external jobs. <button type="button" onClick={() => void refetch()} className="underline">Retry</button></div>
        : items?.length ? <div className="space-y-3">{items.map((item) => <ExternalCard key={item.id} item={item} />)}</div>
        : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No external jobs tracked yet. Open one from your matches or add its link above.</p>}
    </div>
  );
}
