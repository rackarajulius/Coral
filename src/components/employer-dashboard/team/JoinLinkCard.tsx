import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, RefreshCw, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SectionCard, Field } from "../settings/shared";
import {
  LINK_ROLES, ROLE_LABELS, getJoinLink, regenerateJoinLink, revokeJoinLink,
  type CompanyRole,
} from "@/lib/api/companyTeam";

/**
 * A shareable link that admits its holder to the company.
 *
 * The whole point of the UI here is to make the security model visible rather
 * than implicit: whether the domain lock is actually engaged, what a holder
 * gets, and what happens to someone the lock doesn't cover.
 */
export default function JoinLinkCard() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<CompanyRole>("RECRUITER");
  const [domainLocked, setDomainLocked] = useState(true);
  const [days, setDays] = useState(7);

  const link = useQuery({ queryKey: ["company-join-link"], queryFn: getJoinLink, retry: false });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["company-join-link"] });

  const create = useMutation({
    mutationFn: () => regenerateJoinLink({ role, domainLocked, expiresInDays: days }),
    onSuccess: () => {
      invalidate();
      toast.success("New link ready", { description: "Any previous link has stopped working." });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revoke = useMutation({
    mutationFn: revokeJoinLink,
    onSuccess: () => { invalidate(); toast.success("Link revoked"); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (link.isLoading) return <Skeleton className="h-56 rounded-2xl" />;
  // Non-managers get no card at all — the link is a credential.
  if (link.isError) return null;

  const current = link.data;
  const copy = () => {
    if (!current) return;
    navigator.clipboard.writeText(current.url);
    toast.success("Link copied");
  };

  return (
    <SectionCard
      title="Invite link"
      description="Share one link instead of inviting people one at a time."
    >
      {current && !current.expired ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={current.url} className="min-w-[240px] flex-1 font-mono text-xs" />
            <Button size="sm" onClick={copy}><Copy className="h-3.5 w-3.5" />Copy</Button>
          </div>

          {/* The lock is the reason this is safe to share, so its real state is
              stated rather than assumed. */}
          {current.domainLocked && current.domain ? (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Only people with an <strong>@{current.domain}</strong> address join straight away.
                Anyone else who opens this link is queued for your approval, so a link that leaks
                doesn't give anything away.
              </span>
            </p>
          ) : current.domainLocked && !current.domain ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Your company has no verified work domain, so the lock can't tell colleagues apart.
                Everyone using this link is queued for your approval.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                The domain lock is off. <strong>Anyone</strong> with this link joins immediately and
                can read applications and CVs sent to your company.
              </span>
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Joins as</dt>
              <dd className="mt-0.5 font-medium">{ROLE_LABELS[current.role]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="mt-0.5 font-medium">
                {new Date(current.expiresAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Used</dt>
              <dd className="mt-0.5 font-medium">
                {current.usedCount}
                {current.maxUses != null ? ` of ${current.maxUses}` : " times"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Replace link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />Turn off
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {current?.expired && (
            <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              Your previous link expired. Create a new one below.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="They join as">
              <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINK_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expires after">
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 7, 14, 30].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} day{d === 1 ? "" : "s"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2.5 pb-2 text-sm">
                <Switch checked={domainLocked} onCheckedChange={setDomainLocked} />
                <span className="text-muted-foreground">Restrict to my domain</span>
              </label>
            </div>
          </div>

          {/* Owner and Admin aren't offered at all — the server refuses them,
              and an escaped link that grants admin is a company takeover. */}
          <p className="text-xs text-muted-foreground">
            A link can't make someone an owner or admin. Promote people individually for that.
          </p>

          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <Link2 className="h-4 w-4" />Create invite link
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
