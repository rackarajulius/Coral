import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import MarketplaceLayout from "@/components/marketplace/MarketplaceLayout";
import MarketplaceCard from "@/components/marketplace/MarketplaceCard";
import MarketplaceEditor from "@/components/marketplace/MarketplaceEditor";
import { AccountCheckPending } from "@/components/auth/AccountCheckPending";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { getMarketplaceCapabilities, getMyMarketplaceRecord, getMyMarketplaceRecords, marketplacePath, marketplaceStatusLabel, saveMarketplaceRecord, setMarketplaceRecordState, type MarketplaceDraftPayload, type MarketplaceKind, type MarketplaceOwner, type MarketplaceRecord, type MarketplaceStatus } from "@/lib/api/marketplace";

export default function MarketplaceManage() {
  const { user, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const currentOwnerId = useRef(user?.id); currentOwnerId.current = user?.id;
  const kind: MarketplaceKind = params.get("kind") === "project" ? "project" : "service";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const editId = params.get("edit") || undefined;
  const isNew = !editId && params.get("new") === "1";
  const active = !!user && !user.provisional && user.status === "ACTIVE";
  const ownerKey = ["marketplace", "mine", user?.id, kind, page];
  const capabilities = useQuery({ queryKey: ["marketplace", "capabilities", user?.id], queryFn: ({ signal }) => getMarketplaceCapabilities(user!, signal), enabled: active, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const listings = useQuery({ queryKey: ownerKey, queryFn: ({ signal }) => getMyMarketplaceRecords(kind, page, user!, signal), enabled: active, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const ownerRecord = useQuery({ queryKey: ["marketplace", "mine-record", user?.id, kind, editId], queryFn: ({ signal }) => getMyMarketplaceRecord(kind, editId!, user!, signal), enabled: active && !!editId, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const [message, setMessage] = useState<{ ownerId: string; text: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MarketplaceRecord | null>(null);
  const save = useMutation({ mutationFn: ({ payload, owner, id, type }: { payload: MarketplaceDraftPayload; owner: MarketplaceOwner; id?: string; type: MarketplaceKind }) => saveMarketplaceRecord(type, payload, owner, id), onSuccess: (saved, { owner, type, id }) => {
    if (currentOwnerId.current !== owner.id) return;
    refresh(owner.id, type, saved.id); setParams({ kind: type }); setMessage({ ownerId: owner.id, text: id ? `Changes saved. Status: ${marketplaceStatusLabel(saved.status)}.` : "Private draft saved. Review your details, then publish when ready." });
  } });
  const transition = useMutation({ mutationFn: ({ record, status, owner, type }: { record: MarketplaceRecord; status: MarketplaceStatus; owner: MarketplaceOwner; type: MarketplaceKind }) => setMarketplaceRecordState(type, record.id, status, owner), onSuccess: (saved, { owner, type }) => {
    if (currentOwnerId.current !== owner.id) return;
    refresh(owner.id, type, saved.id); setArchiveTarget(null); setMessage({ ownerId: owner.id, text: `Saved. ${saved.title || "Your listing"} is ${marketplaceStatusLabel(saved.status).toLowerCase()}.` });
  } });
  function refresh(ownerId: string, type: MarketplaceKind, id: string) {
    void queryClient.invalidateQueries({ queryKey: ["marketplace", "mine", ownerId] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace", "mine-record", ownerId, type, id] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace", "directory", type] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace", "public", type, id] });
    void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    void queryClient.invalidateQueries({ queryKey: ["community-post"] });
    void queryClient.invalidateQueries({ queryKey: ["community-announcement-options"] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-capabilities", ownerId] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace", "capabilities", ownerId] });
  }
  useEffect(() => { setMessage(null); setArchiveTarget(null); save.reset(); transition.reset(); }, [user?.id, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = save.isPending || transition.isPending;
  const canCreate = !capabilities.isError && capabilities.data?.listingWritesEnabled && (kind === "service" ? capabilities.data.canCreateService : capabilities.data.canCreateProject);
  const editing = !ownerRecord.isError ? ownerRecord.data : undefined;
  const canEdit = capabilities.data?.listingWritesEnabled && editing?.permissions?.canEdit && (kind === "service" ? capabilities.data.canCreateService : capabilities.data.canCreateProject);
  const finishEditing = () => { setParams({ kind, ...(page > 1 ? { page: String(page) } : {}) }); save.reset(); };
  function changePage(next: number) { setParams({ kind, ...(next > 1 ? { page: String(next) } : {}) }); }
  const statusChange = (record: MarketplaceRecord, status: MarketplaceStatus) => { if (!user) return; setMessage(null); transition.mutate({ record, status, owner: user, type: kind }); };
  if (isLoading || user?.provisional) return <AccountCheckPending />;
  if (!user) return <MarketplaceLayout><div className="max-w-xl rounded-2xl border bg-card p-6"><h1 className="text-2xl font-semibold">Manage your marketplace listings</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to draft services and project briefs, review your saved listings and choose when to share them.</p><Button className="mt-5" onClick={() => openAuth({ redirectTo: `/marketplace/manage${params.size ? `?${params}` : ""}` })}>Sign in to continue</Button></div></MarketplaceLayout>;
  if (!active) return <MarketplaceLayout><h1 className="text-2xl font-semibold">Complete your account setup</h1><p className="mt-3 text-sm text-muted-foreground">An active account is required to manage marketplace listings.</p>{user.status === "PENDING_ONBOARDING" && <Button asChild className="mt-5"><Link to={user.role === "EMPLOYER" ? "/employers/onboarding" : user.role === "FREELANCER" ? "/provider" : "/onboarding"}>Continue account setup</Link></Button>}</MarketplaceLayout>;
  return <MarketplaceLayout>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">Your marketplace workspace</p><h1 className="text-3xl font-semibold tracking-tight">My listings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Build a private draft, publish it when ready and manage its availability.</p></div>{canCreate && !isNew && !editId && <Button onClick={() => { save.reset(); setParams({ kind, new: "1" }); }}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />{kind === "service" ? "New service" : "New project brief"}</Button>}</div>
    <div className="mb-6 flex gap-2" aria-label="Listing type"><Button variant={kind === "service" ? "default" : "outline"} aria-pressed={kind === "service"} disabled={busy} onClick={() => setParams({ kind: "service" })}>Services</Button><Button variant={kind === "project" ? "default" : "outline"} aria-pressed={kind === "project"} disabled={busy} onClick={() => setParams({ kind: "project" })}>Project briefs</Button></div>
    {capabilities.isPending && <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Checking your publishing access…</p>}
    {capabilities.isError && <div className="mb-5 rounded-xl border border-destructive/30 p-4" role="alert"><p className="text-sm">We couldn't check publishing access. Your saved listings can still be read below.</p><Button variant="outline" className="mt-3" onClick={() => void capabilities.refetch()}>Check again</Button></div>}
    {capabilities.data && !capabilities.isError && !capabilities.data.listingWritesEnabled && <p className="mb-5 rounded-xl border bg-muted/40 p-4 text-sm leading-6">New listings, editing and publishing are temporarily paused. You can still read your saved records and pause, close or archive available listings.</p>}
    {capabilities.data?.listingWritesEnabled && !canCreate && !isNew && !editId && <div className="mb-5 rounded-xl border p-4 text-sm leading-6">{kind === "service" && (user.role === "JOB_SEEKER" || user.role === "FREELANCER") ? <><p>Enable your provider profile to start offering a service.</p><Button asChild variant="outline" className="mt-3"><Link to="/provider">Set up my provider profile</Link></Button></> : <p>{kind === "service" ? "Services are offered through an eligible professional provider account." : "Project publishing requires an eligible personal account or current company publishing permission."}</p>}</div>}
    {message?.ownerId === user.id && <p className="mb-5 flex items-center gap-2 rounded-xl bg-primary/5 p-4 text-sm" role="status"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />{message.text}</p>}
    {transition.isError && <p className="mb-5 rounded-xl border border-destructive/30 p-4 text-sm text-destructive" role="alert">{transition.error.message}</p>}
    {listings.isPending && <p className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your listings…</p>}
    {listings.isError && <div className="rounded-xl border border-destructive/30 p-6" role="alert"><h2 className="font-semibold">We couldn't load your listings</h2><p className="mt-2 text-sm text-muted-foreground">{listings.error.message}</p><Button variant="outline" onClick={() => void listings.refetch()} className="mt-4">Try again</Button></div>}
    {editId && ownerRecord.isPending && <p className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading saved listing…</p>}
    {editId && ownerRecord.isError && <div className="rounded-xl border p-6" role="alert"><h2 className="font-semibold">We couldn't open this saved listing</h2><p className="mt-2 text-sm text-muted-foreground">{ownerRecord.error.message}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void ownerRecord.refetch()}>Try again</Button><Button variant="ghost" onClick={finishEditing}>Back to listings</Button></div></div>}
    {capabilities.data && !capabilities.isError && ((isNew && canCreate) || (editing && canEdit)) && <MarketplaceEditor key={`${user.id}:${kind}:${editing?.id || "new"}`} kind={kind} record={editing} capabilities={capabilities.data} requiresCompany={!(["JOB_SEEKER", "FREELANCER"] as string[]).includes(user.role)} busy={busy} error={save.error?.message} onCancel={finishEditing} onSave={(payload) => { setMessage(null); save.mutate({ payload, owner: user, id: editing?.id, type: kind }); }} />}
    {((isNew && !canCreate && !capabilities.isPending) || (editId && editing && !canEdit && !capabilities.isPending)) && <div className="rounded-xl border p-6"><h2 className="font-semibold">This listing cannot be edited here</h2><p className="mt-2 text-sm text-muted-foreground">It may be archived or outside your current publishing access.</p><Button variant="outline" className="mt-4" onClick={finishEditing}>Back to listings</Button></div>}
    {listings.data && !listings.isError && !isNew && !editId && <>
      {!listings.data.data.length && <div className="rounded-2xl border bg-card p-8 text-center"><h2 className="text-xl font-semibold">{page > 1 ? "No listings on this page" : `Your ${kind === "service" ? "services" : "project briefs"} start here`}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{page > 1 ? "Return to the first page to see your saved listings." : "Save a draft while you shape the details. Only listings you explicitly publish will appear publicly."}</p>{page > 1 && <Button className="mt-5" variant="outline" onClick={() => changePage(1)}>First page</Button>}{canCreate && page === 1 && <Button className="mt-5" onClick={() => setParams({ kind, new: "1" })}>{kind === "service" ? "Draft my first service" : "Draft my first project"}</Button>}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.data.data.map((record) => <MarketplaceCard record={record} kind={kind} management key={record.id}><div className="flex flex-wrap gap-2">
        {record.permissions?.canEdit && canCreate && <Button variant="outline" size="sm" disabled={busy} onClick={() => { save.reset(); transition.reset(); setParams({ kind, edit: record.id, ...(page > 1 ? { page: String(page) } : {}) }); }}>Edit</Button>}
        {record.permissions?.canPublish && !["published", "open"].includes(record.status) && canCreate && <Button size="sm" disabled={busy} onClick={() => statusChange(record, kind === "service" ? "published" : "open")}>{kind === "service" ? "Publish" : record.status === "closed" ? "Reopen project" : "Open project"}</Button>}
        {record.permissions?.canPause && <Button variant="outline" size="sm" disabled={busy} onClick={() => statusChange(record, "paused")}>Pause</Button>}
        {record.permissions?.canClose && <Button variant="outline" size="sm" disabled={busy} onClick={() => statusChange(record, "closed")}>Close project</Button>}
        {record.permissions?.canArchive && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { transition.reset(); setArchiveTarget(record); }}>Archive</Button>}
        {(record.status === "published" || record.status === "open") && <Button asChild variant="ghost" size="sm"><Link to={marketplacePath(kind, record.id)}>View public listing<ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" /></Link></Button>}
      </div></MarketplaceCard>)}</div>
      {listings.data.meta.totalPages > 1 && <nav aria-label="My listing pages" className="mt-6 flex flex-wrap items-center justify-end gap-3"><span className="text-xs text-muted-foreground">Page {listings.data.meta.page} of {listings.data.meta.totalPages}</span><Button variant="outline" disabled={page <= 1 || busy} onClick={() => changePage(page - 1)}>Previous</Button><Button variant="outline" disabled={page >= listings.data.meta.totalPages || busy} onClick={() => changePage(page + 1)}>Next</Button></nav>}
    </>}
    <Dialog open={!!archiveTarget} onOpenChange={(open) => { if (!open && !busy) setArchiveTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Archive this listing?</DialogTitle><DialogDescription>{archiveTarget?.title || "This listing"} will be removed from public discovery and kept in your history. Archived listings cannot be reopened or edited.</DialogDescription></DialogHeader>{transition.isError && <p className="text-sm text-destructive" role="alert">{transition.error.message}</p>}<div className="mt-3 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setArchiveTarget(null)}>Cancel</Button><Button disabled={busy || !archiveTarget} onClick={() => { if (archiveTarget) statusChange(archiveTarget, "archived"); }}>{busy ? "Archiving…" : "Archive listing"}</Button></div></DialogContent></Dialog>
  </MarketplaceLayout>;
}
