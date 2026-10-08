import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flag, Loader2, MapPin } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import MarketplaceLayout from "@/components/marketplace/MarketplaceLayout";
import MarketplaceRequestAction from "@/components/marketplace/MarketplaceRequestAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { providerCategoryLabel, safeProviderLink } from "@/lib/api/providers";
import { getMarketplaceRecord, reportMarketplaceRecord, MarketplaceApiError, marketplacePath, marketplacePrice, marketplaceStatusLabel, marketplaceWorkMode, type MarketplaceKind, type MarketplaceOwner, type MarketplaceReportReason, type ProjectBrief, type ServiceListing } from "@/lib/api/marketplace";
import { recordMarketplaceListingView } from "@/lib/api/marketplaceActivity";
import type { MarketplaceRequestSource } from "@/lib/api/marketplaceRequests";

export default function MarketplaceDetail({ kind }: { kind: MarketplaceKind }) {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const ownerId = useRef(user?.id); ownerId.current = user?.id;
  const listing = useQuery({ queryKey: ["marketplace", "public", kind, id], queryFn: ({ signal }) => getMarketplaceRecord(kind, id!, signal), enabled: !!id, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const sourceValue = params.get("source");
  const source: MarketplaceRequestSource = ["community", "directory", "profile"].includes(sourceValue || "") ? sourceValue as MarketplaceRequestSource : "direct";
  const postId = source === "community" ? params.get("postId") || undefined : undefined;
  useEffect(() => {
    if (!listing.data || listing.isError || !id) return;
    const controller = new AbortController();
    void recordMarketplaceListingView(kind, id, { source, ...(postId ? { postId } : {}) }, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [kind, id, listing.data?.id, listing.isError, source, postId]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<MarketplaceReportReason>("spam");
  const [details, setDetails] = useState("");
  const [reported, setReported] = useState(false);
  const report = useMutation({ mutationFn: ({ owner, reason: selected, details: text }: { owner: MarketplaceOwner; reason: MarketplaceReportReason; details: string }) => reportMarketplaceRecord(kind, id!, { reason: selected, ...(text.trim() ? { details: text.trim() } : {}) }, owner), onSuccess: (_, { owner }) => { if (ownerId.current === owner.id) { setReportOpen(false); setReported(true); } } });
  useEffect(() => { setReportOpen(false); setDetails(""); setReported(false); report.reset(); }, [user?.id, kind, id]); // eslint-disable-line react-hooks/exhaustive-deps
  function submitReport(event: FormEvent) { event.preventDefault(); if (user && !user.provisional && user.status === "ACTIVE") report.mutate({ owner: user, reason, details }); }
  const unavailable = listing.error instanceof MarketplaceApiError && [403, 404, 410].includes(listing.error.status);
  const record = listing.data;
  const service = kind === "service" ? record as ServiceListing | undefined : undefined;
  const project = kind === "project" ? record as ProjectBrief | undefined : undefined;
  const profilePath = record?.owner.profileUrl?.startsWith("/providers/") ? record.owner.profileUrl : null;
  return <MarketplaceLayout>
    <Link to={marketplacePath(kind)} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{kind === "service" ? "Find services" : "Project work"}</Link>
    {listing.isPending && <p className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading {kind === "service" ? "service" : "project brief"}…</p>}
    {listing.isError && <div className="rounded-2xl border p-8 text-center"><h1 className="text-xl font-semibold">{unavailable ? "This listing isn't available" : "We couldn't load this listing"}</h1><p className="mt-2 text-sm text-muted-foreground">{unavailable ? "The owner may have paused it, changed its visibility or removed it." : "Please try again in a moment."}</p>{!unavailable && <Button onClick={() => void listing.refetch()} variant="outline" className="mt-4">Try again</Button>}</div>}
    {/* A failed refresh must not leave withdrawn listing details visible. */}
    {record && !listing.isError && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="min-w-0 space-y-5"><div><div className="mb-4 flex flex-wrap gap-2"><Badge variant="secondary">{providerCategoryLabel(record.category)}</Badge><Badge variant="outline">{marketplaceStatusLabel(record.status)}</Badge></div><h1 className="break-words text-3xl font-semibold leading-tight tracking-tight">{record.title}</h1><p className="mt-3 text-sm text-muted-foreground">{record.company ? `Published by ${record.company.name}` : <>Shared by {profilePath ? <Link to={profilePath} className="text-primary underline underline-offset-4">{record.owner.displayName}</Link> : record.owner.displayName}</>}</p></div>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">{kind === "service" ? "About this service" : "Project overview"}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm leading-7">{record.description}</p></CardContent></Card>
        {service && <><Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">What is included</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm leading-6">{service.deliverables.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">Work examples</CardTitle></CardHeader><CardContent className="space-y-3">{service.workSamples.map((sample, index) => { const url = safeProviderLink(sample.url); return url && <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 break-words">{sample.label}</span><ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>; })}<p className="text-xs leading-5 text-muted-foreground">Examples are supplied by the listing owner.</p></CardContent></Card></>}
        {project && <Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">Scope and expected work</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm leading-7">{project.scope}</p></CardContent></Card>}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">{kind === "service" ? "Skills offered" : "Skills needed"}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{record.skills.map((skill) => <Badge variant="outline" key={skill} className="max-w-full break-words">{skill}</Badge>)}</CardContent></Card>
      </article>
      <aside className="space-y-4 lg:sticky lg:top-24"><Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">{kind === "service" ? "Pricing and availability" : "Budget and location"}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="break-words font-semibold">{marketplacePrice(record, kind)}</p><p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{marketplaceWorkMode(record.workMode)}<br />{[record.city, record.country].filter(Boolean).join(", ")}</span></p>{service && <p className="text-sm">{{ available: "Available for work", limited: "Limited availability", unavailable: "Currently unavailable" }[service.availability]}</p>}{project?.deadline && <p className="text-sm">Project deadline: {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(project.deadline))}</p>}<p className="text-xs leading-5 text-muted-foreground">{kind === "service" ? "Pricing and availability are stated by the provider." : "The budget and deadline are stated by the project owner."}</p>{profilePath && <Button asChild variant="outline" className="w-full"><Link to={profilePath}>View professional profile</Link></Button>}</CardContent></Card>
        <MarketplaceRequestAction key={`${user?.id || "anonymous"}:${kind}:${id}`} kind={kind} listingId={id!} title={record.title} />
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={reported || report.isPending} onClick={() => { if (!user) openAuth({ redirectTo: marketplacePath(kind, id) }); else if (!user.provisional && user.status === "ACTIVE") setReportOpen(true); }}><Flag className="mr-2 h-4 w-4" aria-hidden="true" />{reported ? "Report submitted" : "Report this listing"}</Button>{reported && <p className="text-xs text-muted-foreground" role="status">Your report has been sent for review.</p>}
      </aside>
    </div>}
    <Dialog open={reportOpen} onOpenChange={(open) => { if (!report.isPending) setReportOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Report this listing</DialogTitle><DialogDescription>Tell the Coral moderation team what needs attention.</DialogDescription></DialogHeader><form onSubmit={submitReport} className="space-y-4"><div className="space-y-2"><Label htmlFor="listing-report-reason">Reason</Label><select id="listing-report-reason" disabled={report.isPending} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value as MarketplaceReportReason)}><option value="spam">Spam</option><option value="fraud">Misleading or fraudulent</option><option value="harassment">Harassment</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select></div><div className="space-y-2"><Label htmlFor="listing-report-details">Details (optional)</Label><Textarea id="listing-report-details" maxLength={1000} rows={4} disabled={report.isPending} value={details} onChange={(e) => setDetails(e.target.value)} /></div>{report.isError && <p role="alert" className="text-sm text-destructive">{report.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={report.isPending} onClick={() => setReportOpen(false)}>Cancel</Button><Button type="submit" disabled={report.isPending}>{report.isPending ? "Submitting…" : "Submit report"}</Button></div></form></DialogContent></Dialog>
  </MarketplaceLayout>;
}
