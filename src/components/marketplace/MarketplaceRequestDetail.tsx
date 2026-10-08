import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flag, Loader2, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { marketplacePath, type MarketplaceOwner, type MarketplaceReportReason } from "@/lib/api/marketplace";
import { getMarketplaceRequest, getMarketplaceRequestMessages, markMarketplaceRequestRead, marketplaceRequestStatusLabel, marketplaceVisiblePolling, reportMarketplaceRequest, safeMarketplaceWorkSample, sendMarketplaceRequestMessage, setMarketplaceRequestState, type MarketplaceRequestAction, type MarketplaceRequestDetail as RequestDetail } from "@/lib/api/marketplaceRequests";

const actionContent: Record<MarketplaceRequestAction, { title: string; description: string; button: string }> = {
  accept: { title: "Open this conversation?", description: "You can discuss the work privately with this requester. Accepting opens a conversation; it does not commit you to a project or payment.", button: "Accept request" },
  decline: { title: "Decline this request?", description: "This closes the request. Both participants can still read the saved conversation.", button: "Decline request" },
  withdraw: { title: "Withdraw your request?", description: "The recipient will no longer be able to accept or reply to this pending request. Your saved history remains available.", button: "Withdraw request" },
  block: { title: "Block this participant?", description: "This ends the conversation and stops further marketplace contact between you and this participant. Both participants keep access to their saved history.", button: "Block participant" },
};
const dateTime = (value: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function MarketplaceRequestDetail({ requestId, owner, onBack }: { requestId: string; owner: MarketplaceOwner; onBack: () => void }) {
  const queryClient = useQueryClient();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const detailKey = ["marketplace-requests", "detail", owner.id, requestId];
  const detail = useQuery({ queryKey: detailKey, queryFn: ({ signal }) => getMarketplaceRequest(requestId, owner, signal), retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: marketplaceVisiblePolling });
  const [messagePage, setMessagePage] = useState(1);
  const messages = useQuery({ queryKey: ["marketplace-requests", "messages", owner.id, requestId, messagePage], queryFn: ({ signal }) => getMarketplaceRequestMessages(requestId, messagePage, owner, signal), enabled: !!detail.data && !detail.isError, retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: marketplaceVisiblePolling });
  const [body, setBody] = useState("");
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmAction, setConfirmAction] = useState<MarketplaceRequestAction | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<MarketplaceReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reported, setReported] = useState(false);
  const retryKey = useRef<{ body: string; key: string } | null>(null);
  const readAttempt = useRef("");
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: detailKey });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-requests", "messages", owner.id, requestId] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-requests", "list", owner.id] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-requests", "capabilities", owner.id] });
  }
  const transition = useMutation({ mutationFn: (action: MarketplaceRequestAction) => setMarketplaceRequestState(requestId, action, owner), onSuccess: (updated) => {
    if (!alive.current) return;
    queryClient.setQueryData(detailKey, updated); setConfirmAction(null); setNotice(`Saved. ${marketplaceRequestStatusLabel(updated.status)}.`); refresh();
  }, onError: () => { if (alive.current) refresh(); } });
  const send = useMutation({ mutationFn: (payload: { body: string; idempotencyKey: string }) => sendMarketplaceRequestMessage(requestId, payload, owner), onSuccess: () => {
    if (!alive.current) return;
    setBody(""); setValidation(""); retryKey.current = null; setMessagePage(1); setNotice("Your message was sent."); refresh();
  }, onError: () => { if (alive.current) refresh(); } });
  const report = useMutation({ mutationFn: () => reportMarketplaceRequest(requestId, { reason, ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}) }, owner), onSuccess: () => {
    if (!alive.current) return;
    setReportOpen(false); setReported(true); setNotice("Your report was sent for review.");
  } });
  const read = useMutation({ mutationFn: () => markMarketplaceRequestRead(requestId, owner), onSuccess: () => {
    if (!alive.current) return;
    queryClient.setQueryData<RequestDetail>(detailKey, (cached) => cached ? { ...cached, unreadCount: 0 } : cached);
    void queryClient.invalidateQueries({ queryKey: ["marketplace-requests", "list", owner.id] });
  } });
  const record = detail.isError ? undefined : detail.data;
  const actionPermission = confirmAction ? ({ accept: "canAccept", decline: "canDecline", withdraw: "canWithdraw", block: "canBlock" } as const)[confirmAction] : undefined;
  const canConfirm = !!actionPermission && !!record?.permissions[actionPermission];
  const messageItems = messages.isError ? undefined : messages.data?.data;
  const lastMessageId = messageItems?.[0]?.id || "request";
  useEffect(() => {
    if (!record || !messages.isSuccess || messagePage !== 1 || record.unreadCount < 1 || read.isPending || document.visibilityState !== "visible") return;
    const attempt = `${record.updatedAt}:${record.unreadCount}:${lastMessageId}`;
    if (readAttempt.current === attempt) return;
    readAttempt.current = attempt; read.mutate();
  }, [record?.updatedAt, record?.unreadCount, lastMessageId, messages.isSuccess, messagePage, read.isPending]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = transition.isPending || send.isPending || report.isPending;
  const sortedMessages = [...(messageItems || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  function submitMessage(event: FormEvent) {
    event.preventDefault(); setValidation("");
    if (!record?.permissions.canSend || detail.isError || messages.isError || busy) return;
    const text = body.trim();
    if (!text || text.length > 5000) { setValidation("Write a message between 1 and 5,000 characters."); return; }
    if (retryKey.current?.body !== text) retryKey.current = { body: text, key: crypto.randomUUID() };
    send.mutate({ body: text, idempotencyKey: retryKey.current.key });
  }
  const counterpart = record?.viewerSide === "recipient" ? record.requester : record?.recipient;
  const counterpartCompany = record?.viewerSide === "recipient" ? record.requesterCompany : record?.recipientCompany;
  return <section className="min-w-0 rounded-2xl border bg-card" aria-label="Marketplace conversation">
    <div className="border-b p-4 sm:p-5"><Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 lg:hidden"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Back to inbox</Button>
      {detail.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your conversation…</p>}
      {detail.isError && <div role="alert"><h2 className="font-semibold">This conversation could not be opened</h2><p className="mt-2 text-sm text-muted-foreground">{detail.error.message}</p><Button variant="outline" className="mt-4" onClick={() => void detail.refetch()}>Try again</Button></div>}
      {record && <><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{record.kind === "service" ? "Service enquiry" : "Project response"}</Badge><Badge variant="secondary">{marketplaceRequestStatusLabel(record.status)}</Badge></div><h2 className="mt-3 break-words text-xl font-semibold">{record.listing.title}</h2><p className="mt-2 text-sm text-muted-foreground">With {counterpart?.displayName}{counterpartCompany ? ` · ${counterpartCompany.name}` : ""}</p>{record.listing.available ? <Link to={marketplacePath(record.kind, record.listing.id)} className="mt-2 inline-flex text-sm text-primary underline underline-offset-4">View current listing</Link> : <p className="mt-2 text-xs text-muted-foreground">The listing is currently unavailable. This private history remains accessible to its participants.</p>}</>}
    </div>
    {record && <div className="space-y-5 p-4 sm:p-5">
      {notice && <p className="rounded-lg bg-primary/5 p-3 text-sm" role="status">{notice}</p>}
      {transition.isError && !canConfirm && <p className="text-sm text-destructive" role="alert">{transition.error.message}</p>}
      <article className="rounded-xl border bg-muted/20 p-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span className="font-medium">{record.requester.displayName}{record.requesterCompany ? ` · ${record.requesterCompany.name}` : ""}</span><time dateTime={record.createdAt}>{dateTime(record.createdAt)}</time></div><h3 className="mb-2 mt-3 text-sm font-semibold">{record.kind === "service" ? "Original enquiry" : "Original project response"}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6">{record.body}</p>{!!record.workSamples.length && <div className="mt-4 space-y-2"><h4 className="text-xs font-semibold">Private work examples</h4>{record.workSamples.map((sample, index) => { const url = safeMarketplaceWorkSample(sample.url); return url && <a href={url} target="_blank" rel="noopener noreferrer" key={index} className="flex items-center gap-2 break-words text-sm text-primary underline underline-offset-4"><span className="min-w-0 break-words">{sample.label}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>; })}</div>}</article>
      <div className="flex flex-wrap gap-2">
        {record.permissions.canAccept && <Button disabled={busy} onClick={() => { transition.reset(); setConfirmAction("accept"); }}>Accept request</Button>}
        {record.permissions.canDecline && <Button variant="outline" disabled={busy} onClick={() => { transition.reset(); setConfirmAction("decline"); }}>Decline</Button>}
        {record.permissions.canWithdraw && <Button variant="outline" disabled={busy} onClick={() => { transition.reset(); setConfirmAction("withdraw"); }}>Withdraw request</Button>}
        {record.permissions.canBlock && <Button variant="outline" disabled={busy} onClick={() => { transition.reset(); setConfirmAction("block"); }}>Block participant</Button>}
        {record.permissions.canReport && <Button variant="ghost" disabled={busy || reported} onClick={() => { report.reset(); setReportOpen(true); }}><Flag className="mr-2 h-4 w-4" aria-hidden="true" />{reported ? "Report submitted" : "Report"}</Button>}
      </div>
      <div className="space-y-3" aria-label="Conversation messages">
        {messages.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading messages…</p>}
        {messages.isError && <div className="rounded-lg border border-destructive/30 p-4" role="alert"><p className="text-sm">We couldn't refresh your conversation messages.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void messages.refetch()}>Try again</Button></div>}
        {messageItems && !messageItems.length && <p className="py-2 text-sm text-muted-foreground">No replies yet.</p>}
        {sortedMessages.map((message) => <article key={message.id} className={`max-w-full rounded-xl p-4 ${message.senderId === owner.id ? "ml-3 border border-primary/15 bg-primary/5 sm:ml-8" : "mr-3 border bg-muted/20 sm:mr-8"}`}><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span className="font-medium">{message.senderId === owner.id ? "You" : counterpart?.displayName}</span><time dateTime={message.createdAt}>{dateTime(message.createdAt)}</time></div><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p></article>)}
        {messages.data && !messages.isError && messages.data.meta.totalPages > 1 && <nav aria-label="Conversation message pages" className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={busy || messagePage >= messages.data.meta.totalPages} onClick={() => setMessagePage((current) => current + 1)}>Older messages</Button><span className="text-xs text-muted-foreground">Page {messages.data.meta.page} of {messages.data.meta.totalPages}</span><Button variant="outline" size="sm" disabled={busy || messagePage <= 1} onClick={() => setMessagePage((current) => current - 1)}>Newer messages</Button></nav>}
      </div>
      {read.isError && <p className="text-xs text-muted-foreground">Messages are visible, but your read status could not be saved. <button type="button" className="text-primary underline" onClick={() => read.mutate()}>Try again</button></p>}
      {record.permissions.canSend ? <form onSubmit={submitMessage} className="space-y-3 border-t pt-4"><div className="space-y-2"><Label htmlFor="marketplace-message">Your reply</Label><Textarea id="marketplace-message" value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={5000} disabled={busy || messages.isError} required />{record.status === "pending" && record.viewerSide === "recipient" && <p className="text-xs leading-5 text-muted-foreground">Sending your first reply accepts this request and opens the conversation.</p>}</div>{(validation || send.isError) && <p className="text-sm text-destructive" role="alert">{validation || send.error?.message}</p>}<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{body.length.toLocaleString("en-CA")} / 5,000</p><Button type="submit" disabled={busy || messages.isError || !body.trim()}><Send className="mr-2 h-4 w-4" aria-hidden="true" />{send.isPending ? "Sending…" : record.status === "pending" ? "Accept and reply" : "Send reply"}</Button></div></form> : <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">{record.status === "pending" && record.viewerSide === "requester" ? "Your request is awaiting the publisher's reply. You can withdraw it while it is pending." : ["declined", "withdrawn", "blocked"].includes(record.status) ? "This conversation is closed. You can read the saved history." : "New replies are currently unavailable for this conversation."}</p>}
    </div>}
    <Dialog open={!!confirmAction && !detail.isError && canConfirm} onOpenChange={(open) => { if (!open && !busy) setConfirmAction(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmAction && actionContent[confirmAction].title}</DialogTitle><DialogDescription>{confirmAction && actionContent[confirmAction].description}</DialogDescription></DialogHeader>{transition.isError && <p role="alert" className="text-sm text-destructive">{transition.error.message}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirmAction(null)}>Cancel</Button><Button disabled={busy || !confirmAction || detail.isError || !canConfirm} onClick={() => { if (confirmAction) { setNotice(""); transition.mutate(confirmAction); } }}>{transition.isPending ? "Saving…" : confirmAction && actionContent[confirmAction].button}</Button></div></DialogContent></Dialog>
    <Dialog open={reportOpen && !detail.isError} onOpenChange={(open) => { if (!busy) setReportOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Report this conversation</DialogTitle><DialogDescription>Details you submit are shared with Coral administrators. Reporting does not automatically block this participant.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!busy && record?.permissions.canReport) report.mutate(); }}><div className="space-y-2"><Label htmlFor="request-report-reason">Reason</Label><select id="request-report-reason" className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={busy} value={reason} onChange={(event) => setReason(event.target.value as MarketplaceReportReason)}><option value="spam">Spam</option><option value="fraud">Misleading or fraudulent</option><option value="harassment">Harassment</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select></div><div className="space-y-2"><Label htmlFor="request-report-details">Details (optional)</Label><Textarea id="request-report-details" maxLength={1000} rows={4} disabled={busy} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} /></div>{report.isError && <p role="alert" className="text-sm text-destructive">{report.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setReportOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !record?.permissions.canReport}>{report.isPending ? "Submitting…" : "Submit report"}</Button></div></form></DialogContent></Dialog>
  </section>;
}
