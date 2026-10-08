import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { getMarketplaceCapabilities, marketplacePath, type MarketplaceKind } from "@/lib/api/marketplace";
import { createMarketplaceRequest, getMarketplaceRequestCapabilities, marketplaceRequestPath, safeMarketplaceWorkSample, type CreateMarketplaceRequest, type MarketplaceRequestSource } from "@/lib/api/marketplaceRequests";

const reasonText: Record<string, string> = {
  own_listing: "This is your listing. Requests from other members will appear in your marketplace inbox.",
  company_member: "This listing belongs to your company. Requests from other members will appear in the publisher's marketplace inbox.",
  account_inactive: "An active Coral account is required to send a request.",
  listing_unavailable: "This listing is no longer accepting new requests.",
  blocked: "You cannot send a request to this participant.",
};

export default function MarketplaceRequestAction({ kind, listingId, title }: { kind: MarketplaceKind; listingId: string; title: string }) {
  const { user, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const active = !!user && !user.provisional && user.status === "ACTIVE";
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const currentAccount = useRef(user?.id); currentAccount.current = user?.id;
  const capabilities = useQuery({ queryKey: ["marketplace-requests", "capabilities", user?.id, kind, listingId], queryFn: ({ signal }) => getMarketplaceRequestCapabilities(kind, listingId, active ? user : undefined, signal), enabled: !isLoading && !user?.provisional, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const companies = useQuery({ queryKey: ["marketplace", "capabilities", user?.id], queryFn: ({ signal }) => getMarketplaceCapabilities(user!, signal), enabled: active, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [samples, setSamples] = useState<{ label: string; url: string }[]>([]);
  const [validation, setValidation] = useState("");
  const retryKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const send = useMutation({ mutationFn: (payload: CreateMarketplaceRequest) => createMarketplaceRequest(payload, user!), onSuccess: (created) => {
    if (!alive.current || currentAccount.current !== user?.id) return;
    void queryClient.invalidateQueries({ queryKey: ["marketplace-requests", "capabilities", user.id] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-requests", "list", user.id] });
    navigate(marketplaceRequestPath(created.id));
  }, onError: () => { if (alive.current) void capabilities.refetch(); } });
  const capability = capabilities.isError ? undefined : capabilities.data;
  const eligibleCompanies = companies.isError ? [] : companies.data?.companies || [];
  const actionLabel = kind === "service" ? "Request a proposal" : "Respond to project";
  const sourceValue = params.get("source");
  const source: MarketplaceRequestSource = ["community", "directory", "profile"].includes(sourceValue || "") ? sourceValue as MarketplaceRequestSource : "direct";
  const redirectTo = `${marketplacePath(kind, listingId)}${params.size ? `?${params}` : ""}`;
  function submit(event: FormEvent) {
    event.preventDefault(); setValidation("");
    if (!active || !capability?.canSubmit || !capability.enquiriesEnabled || send.isPending) return;
    const text = body.trim();
    if (text.length < 20 || text.length > 5000) { setValidation("Write between 20 and 5,000 characters so the recipient can understand your request."); return; }
    if (companyId && !eligibleCompanies.some((company) => company.id === companyId)) { setValidation("Your company access changed. Choose your personal account or reload your company choices."); return; }
    const workSamples = samples.map((sample) => ({ label: sample.label.trim(), url: safeMarketplaceWorkSample(sample.url.trim()) }));
    if (workSamples.some((sample) => !sample.label || sample.label.length > 100 || !sample.url)) { setValidation("Each work example needs a label of up to 100 characters and a valid HTTPS link without sign-in credentials in the address."); return; }
    const payload = { kind, listingId, body: text, ...(workSamples.length ? { workSamples: workSamples as { label: string; url: string }[] } : {}), ...(companyId ? { companyId } : {}), source, ...(source === "community" && params.get("postId") ? { postId: params.get("postId")! } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (retryKey.current?.fingerprint !== fingerprint) retryKey.current = { fingerprint, key: crypto.randomUUID() };
    send.mutate({ ...payload, idempotencyKey: retryKey.current.key });
  }
  if (!capability && !capabilities.isError) return null;
  if (capabilities.isError) return <div className="space-y-2 text-xs text-muted-foreground"><p>We couldn't check whether this listing accepts requests.</p><Button variant="outline" size="sm" onClick={() => void capabilities.refetch()}>Check request access</Button></div>;
  if (capability?.existingRequestId) return <Button asChild className="w-full"><Link to={marketplaceRequestPath(capability.existingRequestId)}>View your request<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>;
  if (!capability?.enquiriesEnabled) return null;
  if (user && !capability.canSubmit) return <p className="text-xs leading-5 text-muted-foreground">{reasonText[capability.reason || ""] || "Requests are unavailable for this listing or your current account."}</p>;
  return <>
    <Button className="w-full" onClick={() => { if (!user) openAuth({ redirectTo }); else if (active) { send.reset(); setValidation(""); setOpen(true); } }}>{actionLabel}</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!send.isPending) setOpen(next); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{actionLabel}</DialogTitle><DialogDescription className="break-words">{title}. Your message and work examples are shared privately with the listing publisher.</DialogDescription></DialogHeader>
      <form className="space-y-5" onSubmit={submit}>
        {!!eligibleCompanies.length && <div className="space-y-2"><Label htmlFor="request-company">Send as</Label><select id="request-company" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={companyId} disabled={send.isPending} onChange={(event) => setCompanyId(event.target.value)}><option value="">My personal account</option>{eligibleCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><p className="text-xs text-muted-foreground">The conversation belongs to you. Other company members do not gain access.</p></div>}
        {companies.isError && <p className="text-xs text-muted-foreground">Company choices could not be checked. You can send from your personal account or <button type="button" className="text-primary underline" onClick={() => void companies.refetch()}>try again</button>.</p>}
        <div className="space-y-2"><Label htmlFor="request-body">{kind === "service" ? "What would you like help with?" : "How would you approach this project?"}</Label><Textarea id="request-body" rows={6} minLength={20} maxLength={5000} value={body} disabled={send.isPending} onChange={(event) => setBody(event.target.value)} placeholder={kind === "service" ? "Describe your goal, the work you need, your timing and any budget information." : "Introduce your relevant experience, your approach and your availability."} required /><p className="text-xs text-muted-foreground">20–5,000 characters. {body.length.toLocaleString("en-CA")} / 5,000</p></div>
        <fieldset className="space-y-3"><legend className="text-sm font-medium">Work examples (optional)</legend>{samples.map((sample, index) => <div className="space-y-2 rounded-xl border p-3" key={index}><div className="flex items-center justify-between gap-2"><Label htmlFor={`request-sample-label-${index}`}>Example {index + 1}</Label><Button type="button" variant="ghost" size="sm" disabled={send.isPending} aria-label={`Remove example ${index + 1}`} onClick={() => setSamples((current) => current.filter((_, position) => position !== index))}><X className="h-4 w-4" aria-hidden="true" /></Button></div><Input id={`request-sample-label-${index}`} placeholder="Example label" aria-label={`Example ${index + 1} label`} maxLength={100} value={sample.label} disabled={send.isPending} onChange={(event) => setSamples((current) => current.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} required /><Input aria-label={`Example ${index + 1} HTTPS link`} type="url" placeholder="https://…" maxLength={2000} value={sample.url} disabled={send.isPending} onChange={(event) => setSamples((current) => current.map((entry, position) => position === index ? { ...entry, url: event.target.value } : entry))} required /></div>)}{samples.length < 5 && <Button type="button" variant="outline" size="sm" disabled={send.isPending} onClick={() => setSamples((current) => [...current, { label: "", url: "" }])}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add work example</Button>}<p className="text-xs text-muted-foreground">Up to five labelled HTTPS links.</p></fieldset>
        {(validation || send.isError) && <p className="text-sm text-destructive" role="alert">{validation || send.error?.message}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={send.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={send.isPending || !capability.canSubmit || capabilities.isError}>{send.isPending ? "Sending…" : kind === "service" ? "Send proposal request" : "Send project response"}</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}
