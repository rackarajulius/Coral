import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Inbox, Loader2, Send } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import MarketplaceLayout from "@/components/marketplace/MarketplaceLayout";
import MarketplaceRequestDetail from "@/components/marketplace/MarketplaceRequestDetail";
import { AccountCheckPending } from "@/components/auth/AccountCheckPending";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { getMarketplaceRequests, marketplaceRequestStatusLabel, marketplaceVisiblePolling } from "@/lib/api/marketplaceRequests";
import { cn } from "@/lib/utils";

export default function MarketplaceInbox() {
  const { user, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const box = params.get("box") === "outgoing" ? "outgoing" : "incoming";
  const rawPage = Number(params.get("page"));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const requestId = params.get("request");
  const active = !!user && !user.provisional && user.status === "ACTIVE";
  const requests = useQuery({ queryKey: ["marketplace-requests", "list", user?.id, box, page], queryFn: ({ signal }) => getMarketplaceRequests(box, page, user!, signal), enabled: active, retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: marketplaceVisiblePolling });
  // Private cached text is discarded when this account leaves the inbox.
  useEffect(() => {
    const accountId = user?.id;
    return () => {
      if (!accountId) return;
      for (const area of ["list", "detail", "messages"]) queryClient.removeQueries({ queryKey: ["marketplace-requests", area, accountId] });
    };
  }, [user?.id, queryClient]);
  function chooseBox(next: "incoming" | "outgoing") { setParams({ box: next }); }
  function chooseRequest(id: string) { setParams({ box, request: id, ...(page > 1 ? { page: String(page) } : {}) }); }
  function choosePage(next: number) { setParams({ box, ...(next > 1 ? { page: String(next) } : {}) }); }
  function backToList() { setParams({ box, ...(page > 1 ? { page: String(page) } : {}) }); }
  if (isLoading || user?.provisional) return <AccountCheckPending />;
  if (!user) return <MarketplaceLayout><div className="max-w-xl rounded-2xl border bg-card p-6"><h1 className="text-2xl font-semibold">Your marketplace conversations</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to read service enquiries, project responses and private conversations about your work.</p><Button className="mt-5" onClick={() => openAuth({ redirectTo: `/marketplace/inbox${params.size ? `?${params}` : ""}` })}>Sign in to continue</Button></div></MarketplaceLayout>;
  if (!active) return <MarketplaceLayout><h1 className="text-2xl font-semibold">An active account is required</h1><p className="mt-3 text-sm text-muted-foreground">Complete your account setup to access marketplace conversations.</p>{user.status === "PENDING_ONBOARDING" && <Button asChild className="mt-5"><Link to={user.role === "EMPLOYER" ? "/employers/onboarding" : user.role === "FREELANCER" ? "/provider" : "/onboarding"}>Continue account setup</Link></Button>}</MarketplaceLayout>;
  return <MarketplaceLayout>
    <div className="mb-6"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">Your marketplace workspace</p><h1 className="text-3xl font-semibold tracking-tight">Marketplace inbox</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Private conversations about services and project work. Each conversation is shared with its two participants.</p>{["EMPLOYER", "JOB_SEEKER"].includes(user.role) && <Link to={user.role === "EMPLOYER" ? "/employers/chat" : "/jobseeker/chat"} className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4">Open your recruiting inbox<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></Link>}</div>
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Marketplace inbox folders"><Button variant={box === "incoming" ? "default" : "outline"} aria-pressed={box === "incoming"} onClick={() => chooseBox("incoming")}><Inbox className="mr-2 h-4 w-4" aria-hidden="true" />Received</Button><Button variant={box === "outgoing" ? "default" : "outline"} aria-pressed={box === "outgoing"} onClick={() => chooseBox("outgoing")}><Send className="mr-2 h-4 w-4" aria-hidden="true" />Sent</Button></nav>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <section aria-label={box === "incoming" ? "Received requests" : "Sent requests"} className={cn("min-w-0 space-y-4", requestId && "hidden lg:block")}>
        {requests.isPending && <p className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your requests…</p>}
        {requests.isError && <div className="rounded-xl border p-5" role="alert"><h2 className="font-semibold">Your inbox could not be loaded</h2><p className="mt-2 text-sm text-muted-foreground">{requests.error.message}</p><Button className="mt-4" variant="outline" onClick={() => void requests.refetch()}>Try again</Button></div>}
        {requests.data && !requests.isError && <>
          {!requests.data.data.length && <div className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">{page > 1 ? "No requests on this page" : box === "incoming" ? "No enquiries or responses yet" : "No requests sent yet"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{page > 1 ? "Return to the first page to see your saved requests." : box === "incoming" ? "Requests about your published services and open project briefs will appear here." : "Find a service or project and start a private conversation about the work."}</p><div className="mt-4 flex flex-wrap gap-2">{page > 1 ? <Button variant="outline" onClick={() => choosePage(1)}>First page</Button> : <>{box === "incoming" ? <Button asChild variant="outline"><Link to="/marketplace/manage">Manage my listings</Link></Button> : <><Button asChild variant="outline"><Link to="/services">Find services</Link></Button><Button asChild variant="ghost"><Link to="/projects">Find projects</Link></Button></>}</>}</div></div>}
          <div className="space-y-3">{requests.data.data.map((request) => { const counterpart = request.viewerSide === "recipient" ? request.requester : request.recipient; const company = request.viewerSide === "recipient" ? request.requesterCompany : request.recipientCompany; return <button type="button" key={request.id} onClick={() => chooseRequest(request.id)} aria-pressed={request.id === requestId} className={cn("w-full min-w-0 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", request.id === requestId && "border-primary/40 bg-primary/5")}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{request.kind === "service" ? "Service enquiry" : "Project response"}</span>{request.unreadCount > 0 && <Badge variant="default">{request.unreadCount} unread</Badge>}</div><h2 className="break-words font-semibold leading-6">{request.listing.title}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{counterpart.displayName}{company ? ` · ${company.name}` : ""}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{marketplaceRequestStatusLabel(request.status)}</span><time dateTime={request.updatedAt}>{new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(request.updatedAt))}</time></div></button>; })}</div>
          {requests.data.meta.totalPages > 1 && <nav aria-label="Marketplace request pages" className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => choosePage(page - 1)}>Previous</Button><span className="text-xs text-muted-foreground">{requests.data.meta.page} / {requests.data.meta.totalPages}</span><Button variant="outline" size="sm" disabled={page >= requests.data.meta.totalPages} onClick={() => choosePage(page + 1)}>Next</Button></nav>}
        </>}
      </section>
      {requestId ? <MarketplaceRequestDetail key={`${user.id}:${requestId}`} requestId={requestId} owner={user} onBack={backToList} /> : <div className="hidden rounded-2xl border bg-muted/10 px-6 py-16 text-center lg:block"><Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden="true" /><h2 className="mt-4 font-semibold">Choose a request</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Read the original enquiry or response, then manage the conversation here.</p></div>}
    </div>
  </MarketplaceLayout>;
}
