import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getMarketplaceModerationReports, moderateMarketplaceRecord, reviewMarketplaceReport, marketplacePath, marketplaceStatusLabel, type MarketplaceModerationReport, type MarketplaceOwner } from "@/lib/api/marketplace";

/** Platform administrators review marketplace reports; Space roles grant no access. */
export default function MarketplaceModeration() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"open" | "reviewed">("open");
  const reports = useQuery({ queryKey: ["marketplace", "moderation", user?.id, status], queryFn: ({ signal }) => getMarketplaceModerationReports(status, user!, signal), enabled: !!user && !user.provisional && user.status === "ACTIVE" && user.role === "ADMIN", retry: false, staleTime: 0, refetchOnWindowFocus: true });
  if (!user || user.provisional || user.status !== "ACTIVE" || user.role !== "ADMIN") return null;
  return <section className="mt-10 border-t pt-7" aria-labelledby="marketplace-moderation-heading"><h2 id="marketplace-moderation-heading" className="text-xl font-semibold">Marketplace reports</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Review reported services and project briefs. Marking a report reviewed records your review. Removing a listing hides it from public pages and linked community cards.</p><div className="my-5 flex gap-2"><Button size="sm" variant={status === "open" ? "default" : "outline"} aria-pressed={status === "open"} onClick={() => setStatus("open")}>Open reports</Button><Button size="sm" variant={status === "reviewed" ? "default" : "outline"} aria-pressed={status === "reviewed"} onClick={() => setStatus("reviewed")}>Reviewed reports</Button></div>
    {reports.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading marketplace reports…</p>}
    {reports.isError && <div className="rounded-xl border border-destructive/30 p-5" role="alert"><p className="text-sm text-destructive">{reports.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void reports.refetch()}>Try again</Button></div>}
    {reports.data && !reports.isError && <div className="space-y-4">{!reports.data.length && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{status === "open" ? "No marketplace reports are waiting for review." : "No reviewed marketplace reports yet."}</p>}{reports.data.map((report) => <MarketplaceReportCard key={`${user.id}:${report.id}`} report={report} reviewed={status === "reviewed"} owner={user} />)}</div>}
  </section>;
}

function MarketplaceReportCard({ report, reviewed, owner }: { report: MarketplaceModerationReport; reviewed: boolean; owner: MarketplaceOwner }) {
  const { user } = useAuth();
  const currentOwnerId = useRef(user?.id); currentOwnerId.current = user?.id;
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const moderation = useMutation({ mutationFn: ({ action, actor }: { action: "remove" | "restore" | "review"; actor: MarketplaceOwner }) => action === "review" ? reviewMarketplaceReport(report.id, actor) : moderateMarketplaceRecord(report.kind, report.target!.id, action, actor, reason.trim()), onSuccess: (_, { action, actor }) => {
    if (currentOwnerId.current !== actor.id) return;
    setNotice(action === "remove" ? "Listing removed from public access." : action === "restore" ? "Removal lifted. The listing's publication and visibility rules still apply." : "Report marked reviewed.");
    void queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    void queryClient.invalidateQueries({ queryKey: ["community-post"] });
    void queryClient.invalidateQueries({ queryKey: ["community-announcement-options"] });
  } });
  useEffect(() => { setNotice(""); setReason(""); moderation.reset(); }, [owner.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Card className="rounded-2xl"><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="capitalize">{report.reason.replace(/_/g, " ")}</Badge><span className="text-xs text-muted-foreground">{report.kind === "service" ? "Service" : "Project brief"} · {new Date(report.createdAt).toLocaleDateString("en-CA")}</span>{report.target && <Badge variant="secondary">{report.target.removed ? "Removed" : marketplaceStatusLabel(report.target.status)}</Badge>}</div><h3 className="break-words font-semibold">{report.target?.title || "Listing unavailable"}</h3>{report.details && <p className="whitespace-pre-wrap break-words text-sm leading-6">{report.details}</p>}
    {report.target && <><div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm leading-6"><p className="whitespace-pre-wrap break-words">{report.target.description}</p>{report.target.scope && <p className="whitespace-pre-wrap break-words">{report.target.scope}</p>}{!!report.target.deliverables?.length && <ul className="list-disc space-y-1 pl-5">{report.target.deliverables.map((item, index) => <li className="break-words" key={index}>{item}</li>)}</ul>}</div><Button asChild variant="outline" size="sm"><Link to={marketplacePath(report.kind, report.target.id)}>Open public listing</Link></Button><p className="text-xs leading-5 text-muted-foreground">Private, paused, archived or removed records remain unavailable on the public page.</p>{!report.target.removed && <div className="space-y-2"><Label htmlFor={`marketplace-removal-${report.id}`}>Reason for removal</Label><Input id={`marketplace-removal-${report.id}`} maxLength={1000} value={reason} disabled={moderation.isPending} onChange={(e) => setReason(e.target.value)} placeholder="Explain why public access should be removed" /></div>}</>}
    {moderation.isError && <p className="text-sm text-destructive" role="alert">{moderation.error.message}</p>}{notice && <p className="text-sm" role="status">{notice}</p>}
    <div className="flex flex-wrap gap-2">{report.target && (report.target.removed ? <Button variant="outline" size="sm" disabled={moderation.isPending} onClick={() => moderation.mutate({ action: "restore", actor: owner })}>Restore listing</Button> : <Button variant="destructive" size="sm" disabled={moderation.isPending || reason.trim().length < 3} onClick={() => moderation.mutate({ action: "remove", actor: owner })}>Remove listing</Button>)}{!reviewed && <Button variant="outline" size="sm" disabled={moderation.isPending} onClick={() => moderation.mutate({ action: "review", actor: owner })}>Mark reviewed</Button>}</div>
  </CardContent></Card>;
}
