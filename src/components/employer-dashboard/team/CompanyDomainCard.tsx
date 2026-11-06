import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Copy, Globe, Loader2, Mail, RefreshCw, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard, Field } from "../settings/shared";
import {
  checkDomainDns, claimDomainBySignIn, confirmDomainEmail, getCompanyDomain, releaseCompanyDomain,
  startDomainDns, startDomainEmail, type CompanyDomainStatus, type DomainMethod,
} from "@/lib/api/companyTeam";

const METHOD_WORDS: Record<DomainMethod, string> = {
  "sign-in": "by signing in with an address at it",
  dns: "with a DNS record",
  email: "with an emailed code",
};

/**
 * The company's own domain, LinkedIn-style: proven, and one company per domain.
 *
 * Says what a proven domain does, because that is why anyone would bother:
 * colleagues at it join through the invite link straight away, the team's
 * community posts carry the verified check, and the company page shows it.
 * A typed website proves nothing, so it is only ever a suggestion here.
 */
export default function CompanyDomainCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["company-domain"], queryFn: getCompanyDomain, retry: false });
  const [domain, setDomain] = useState("");
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");

  // Seed the box from the suggestion once, without overwriting what they type.
  const suggestion = status.data?.suggestion ?? "";
  useEffect(() => { if (suggestion && !domain) setDomain(suggestion); }, [suggestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (next: CompanyDomainStatus) => {
    queryClient.setQueryData(["company-domain"], next);
    // The invite link's lock and the badge both read the domain.
    void queryClient.invalidateQueries({ queryKey: ["company-join-link"] });
  };
  const onError = (e: unknown) => toast.error((e as Error).message);

  const bySignIn = useMutation({
    mutationFn: () => claimDomainBySignIn(domain),
    onSuccess: (next) => { settle(next); toast.success(`${next.domain} is now your company's`); },
    onError,
  });
  const dns = useMutation({ mutationFn: () => startDomainDns(domain), onSuccess: settle, onError });
  const check = useMutation({
    mutationFn: checkDomainDns,
    onSuccess: (next) => {
      settle(next);
      if (next.found) toast.success(`${next.domain} is now your company's`);
      else toast.info("Not found yet", { description: "DNS changes can take a few minutes, sometimes hours. Check again later." });
    },
    onError,
  });
  const email = useMutation({ mutationFn: () => startDomainEmail(address), onSuccess: (next) => { settle(next); setCode(""); }, onError });
  const confirm = useMutation({
    mutationFn: () => confirmDomainEmail(code),
    onSuccess: (next) => { settle(next); toast.success(`${next.domain} is now your company's`); },
    onError,
  });
  const release = useMutation({
    mutationFn: releaseCompanyDomain,
    onSuccess: (next) => { settle(next); toast.success("Domain removed"); },
    onError,
  });

  if (status.isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (status.isError || !status.data) return null;
  const s = status.data;

  return (
    <SectionCard
      title="Company domain"
      description="Prove the domain your company's email and website use. One company per domain, so nobody else can claim it."
    >
      {s.domain ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>{s.domain}</strong> is your company's
              {s.method && <>, proven {METHOD_WORDS[s.method]}</>}
              {s.verifiedAt && <> on {new Date(s.verifiedAt).toLocaleDateString()}</>}.
            </span>
          </p>
          <Consequences domain={s.domain} />
          {s.canManage && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => release.mutate()} disabled={release.isPending}>
              <Trash2 className="h-3.5 w-3.5" />Remove domain
            </Button>
          )}
        </div>
      ) : !s.canManage ? (
        <p className="text-sm text-muted-foreground">
          Your company hasn't proven a domain yet. An owner or admin can do it here.
        </p>
      ) : (
        <div className="space-y-5">
          <Field label="Domain">
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourcompany.com" className="pl-9" maxLength={255} />
            </div>
          </Field>

          {/* The one-click route, only when their own confirmed email proves it. */}
          {s.signInDomain && s.signInDomain === domain.trim().toLowerCase().replace(/^www\./, "") && (
            <div className="rounded-lg border p-3">
              <p className="text-sm">You sign in with an address at <strong>{s.signInDomain}</strong>, which proves it already.</p>
              <Button size="sm" className="mt-3" onClick={() => bySignIn.mutate()} disabled={bySignIn.isPending}>
                {bySignIn.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Claim {s.signInDomain}
              </Button>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {/* DNS: works without email, suits whoever runs the domain. */}
            <div className="rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium"><Server className="h-4 w-4" aria-hidden="true" />Add a DNS record</p>
              {s.pending?.method === "dns" ? (
                <div className="mt-3 space-y-2 text-xs">
                  <p className="text-muted-foreground">At your domain's DNS provider, add this record to <strong>{s.pending.domain}</strong>, then check:</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">Type</dt><dd className="font-mono">{s.pending.record.type}</dd>
                    <dt className="text-muted-foreground">Name</dt><dd className="font-mono">@ <span className="text-muted-foreground">(the domain itself)</span></dd>
                    <dt className="text-muted-foreground">Value</dt>
                    <dd className="flex items-center gap-1.5 font-mono break-all">
                      {s.pending.record.value}
                      <button type="button" aria-label="Copy the value" className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => { void navigator.clipboard.writeText(s.pending?.method === "dns" ? s.pending.record.value : ""); toast.success("Value copied"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </dd>
                  </dl>
                  <p className="text-muted-foreground">The record stays valid until {new Date(s.pending.expiresAt).toLocaleDateString()}. You can remove it once proven.</p>
                  <Button size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
                    {check.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Check now
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">Works for any domain you or your IT team manage. No email needed.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => dns.mutate()} disabled={dns.isPending || !domain.trim()}>
                    {dns.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Get the record
                  </Button>
                </>
              )}
            </div>

            {/* Email: LinkedIn's way; only when Coral can send. */}
            <div className="rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" aria-hidden="true" />Email a code</p>
              {!s.emailAvailable ? (
                <p className="mt-1 text-xs text-muted-foreground">Coral can't send email yet, so use a DNS record for now.</p>
              ) : s.pending?.method === "email" ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">We sent a 6-digit code to {s.pending.sentTo}. It expires in 15 minutes.</p>
                  <div className="flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" className="w-32 font-mono" aria-label="Code" />
                    <Button size="sm" onClick={() => confirm.mutate()} disabled={confirm.isPending || code.length !== 6}>
                      {confirm.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}Confirm
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} type="email" placeholder={`you@${domain.trim() || "yourcompany.com"}`} aria-label="An address at the domain" />
                  <Button size="sm" variant="outline" onClick={() => email.mutate()} disabled={email.isPending || !address.trim()}>
                    {email.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}Send code
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Consequences domain={domain.trim() || "your domain"} pending />
        </div>
      )}
    </SectionCard>
  );
}

/** What owning the domain does — or will do — said plainly. */
function Consequences({ domain, pending = false }: { domain: string; pending?: boolean }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
      <li>Colleagues with a confirmed <strong>@{domain}</strong> address {pending ? "will join" : "join"} through your invite link straight away; everyone else waits for approval.</li>
      <li>Your team's community posts {pending ? "will carry" : "carry"} the verified check, and your company page {pending ? "will show" : "shows"} the domain.</li>
      <li>Nobody else can create a company for it on Coral.</li>
    </ul>
  );
}
