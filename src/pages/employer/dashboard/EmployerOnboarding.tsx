import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import VerificationCard from "@/components/employer-dashboard/VerificationCard";
import PublicFaceStep from "@/components/employer-dashboard/PublicFaceStep";
import CompanyPagePreview from "@/components/employer-dashboard/CompanyPagePreview";
import { COMPANY_TYPES, companySizeOptions } from "@/lib/companyFacts";
import {
  INDUSTRIES,
  checkPageAddress,
  completeOnboarding,
  getCompanyMatches,
  getOnboardingState,
  saveCompanyStep,
  toPageSlug,
  type CompanyMatch,
} from "@/lib/api/employerOnboarding";

/**
 * Employer setup, shown once before the dashboard.
 *
 * Only the company step is required. Profile polish and verification are
 * deliberately not blocking here — those gate the actions that reach
 * candidates (posting a job, inviting to an interview), not access to an
 * otherwise empty dashboard.
 */
type Step = "company" | "publicFace" | "verify";

export default function EmployerOnboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshUser } = useAuth() as { refreshUser?: () => Promise<unknown> };
  // Deep link from the dashboard's finish-setup card, so an employer who
  // skipped a step can be dropped straight back onto it.
  const requested = params.get("step") as Step | null;

  const stateQuery = useQuery({
    queryKey: ["employer-onboarding"],
    queryFn: getOnboardingState,
    retry: false,
  });
  const matchQuery = useQuery({
    queryKey: ["employer-onboarding-matches"],
    queryFn: getCompanyMatches,
    retry: false,
  });

  // Someone who has already finished setup and came back for one specific
  // thing, rather than someone new to the company side. "New" includes a job
  // seeker creating their first company page from the account they have.
  const returning = stateQuery.data
    ? !stateQuery.data.needsOnboarding && !!stateQuery.data.hasCompany
    : false;

  // Resumed from the server's derived state, so re-entering setup lands on the
  // step that's actually outstanding rather than always starting at the top.
  const [step, setStep] = useState<Step>(requested ?? "company");
  const [joining, setJoining] = useState<CompanyMatch | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    companyWebsite: "",
    companySize: "",
    industry: "",
    headquarters: "",
    isRecruiter: false,
    isHiringManager: false,
    isAdmin: false,
    firstName: "",
    lastName: "",
    authorizedRepresentative: false,
    pageSlug: "",
    companyType: "",
  });
  // The page address follows the company name, as on LinkedIn's form, until
  // the person edits it themselves (or the page already has one).
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugToCheck, setSlugToCheck] = useState("");
  // Creating a company page, as opposed to editing one or asking to join one,
  // asks for the person's name and their word that they may represent it.
  const creating = !joining && !stateQuery.data?.hasCompany;

  // Seed from any profile that already exists, so re-entering setup doesn't
  // ask for details the employer has already given.
  useEffect(() => {
    // An explicit ?step= wins — it's someone choosing what to work on, not a
    // resume, so the server's idea of "next" mustn't override it.
    if (requested) return;
    const next = stateQuery.data?.next;
    if (next === "publicFace") setStep("publicFace");
  }, [stateQuery.data?.next, requested]);

  useEffect(() => {
    const person = stateQuery.data?.person;
    if (!person) return;
    setForm((f) => ({
      ...f,
      firstName: f.firstName || person.firstName || "",
      lastName: f.lastName || person.lastName || "",
    }));
  }, [stateQuery.data?.person]);

  useEffect(() => {
    const p = stateQuery.data?.profile as Record<string, string | boolean | null> | null;
    if (!p) return;
    setForm((f) => ({
      ...f,
      companyName: (p.companyName as string) ?? f.companyName,
      companyWebsite: (p.companyWebsite as string) ?? f.companyWebsite,
      companySize: (p.companySize as string) ?? f.companySize,
      industry: (p.industry as string) ?? f.industry,
      headquarters: (p.headquarters as string) ?? f.headquarters,
      pageSlug: (p.slug as string) ?? f.pageSlug,
      companyType: (p.companyType as string) ?? f.companyType,
    }));
    if (p.slug) setSlugTouched(true);
  }, [stateQuery.data]);

  // Checked as they type, a beat after they stop.
  useEffect(() => {
    const timer = setTimeout(() => setSlugToCheck(toPageSlug(form.pageSlug)), 400);
    return () => clearTimeout(timer);
  }, [form.pageSlug]);
  const slugQuery = useQuery({
    queryKey: ["page-address", slugToCheck],
    queryFn: () => checkPageAddress(slugToCheck),
    enabled: !joining && slugToCheck.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const slugNow = toPageSlug(form.pageSlug);
  const slugChecked = slugQuery.data?.slug === slugNow ? slugQuery.data : undefined;
  const slugRefused = !!slugChecked && !slugChecked.available;

  const save = useMutation({
    mutationFn: () =>
      saveCompanyStep({
        ...form,
        companyName: joining?.companyName ?? form.companyName,
        joinCompanyId: joining ? (joining.companyId ?? joining.profileId) : undefined,
        pageSlug: joining || !form.pageSlug.trim() ? undefined : form.pageSlug,
        // Blank is "not chosen", not a value; an older page keeps what it has.
        companyType: form.companyType || undefined,
      }),
    onSuccess: (result) => {
      stateQuery.refetch();
      // Asking to join grants nothing until an owner approves, so say so
      // rather than dropping them into a dashboard that isn't theirs yet.
      if (result?.joinPending) {
        setAwaitingApproval(true);
        return;
      }
      // Someone who came back just to correct their company details has already
      // been offered the profile step — don't march them through it again.
      if (returning) {
        toast.success("Saved");
        navigate("/employers/dashboard");
        return;
      }
      // First time through: move to the optional profile step rather than
      // finishing, so the public face is asked for once while they're here.
      setStep("publicFace");
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't save your company"),
  });

  const finish = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: async () => {
      // The gate reads user.status, so it has to be refetched before we leave
      // or the dashboard bounces straight back here.
      await refreshUser?.().catch(() => undefined);
      toast.success(returning ? "Saved" : "You're all set");
      navigate("/employers/dashboard", { replace: true });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't finish setup"),
  });

  const busy = save.isPending || finish.isPending;
  const canSubmit =
    !!joining ||
    (form.companyName.trim().length >= 2 &&
      !!form.industry &&
      !!form.companySize &&
      // LinkedIn asks for it when a page is made; an older page may not have one yet.
      (!creating || !!form.companyType) &&
      !slugRefused &&
      (!creating ||
        (!!form.firstName.trim() && !!form.lastName.trim() && form.authorizedRepresentative)));

  if (stateQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const matches = matchQuery.data?.matches ?? [];
  // Already finished and not asked for anything in particular — nothing to do
  // here. Restricted to `returning` on purpose: an employer still marked
  // PENDING_ONBOARDING has to reach the finish button, and sending them to the
  // dashboard would just bounce off the auth gate and back again.
  if (returning && !requested && stateQuery.data?.next === "done") {
    return <Navigate to="/employers/dashboard" replace />;
  }

  if (awaitingApproval) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Request sent</h1>
        <p className="text-sm text-muted-foreground">
          We've asked the team at {joining?.companyName} to add you. You'll be able to see their
          jobs and candidates once someone there approves it — nothing is shared before then.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            // Clear the selection too, or the form goes straight back to
            // requesting the same company.
            setJoining(null);
            setAwaitingApproval(false);
          }}
        >
          Set up a separate company instead
        </Button>
      </div>
    );
  }

  // A seat that can't edit the company (a recruiter, a viewer) is shown who
  // can, instead of a form whose save the server would refuse. Its details
  // live on the company's page, which every member shares.
  if (stateQuery.data?.canEditCompany === false && step !== "verify") {
    const companyName = (stateQuery.data.profile?.companyName as string | undefined)?.trim();
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {companyName ? `${companyName}'s page` : "Your company's page"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Its details and public page are kept by your company's owners and admins. Ask one of
          them to make a change.
        </p>
        <Button variant="outline" onClick={() => navigate("/employers/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  // Reached from the dashboard's finish-setup card, which is the only route to
  // verification once onboarding is behind you.
  if (step === "verify") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verify your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified employers can post jobs and contact candidates. It protects candidates from
            fake listings.
          </p>
        </div>
        <VerificationCard />
        <Button variant="ghost" onClick={() => navigate("/employers/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  // Step two: optional profile polish, then finish either way.
  if (step === "publicFace") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6 py-10">
        <PublicFaceStep
          initial={stateQuery.data?.profile ?? null}
          onDone={() => finish.mutate()}
          onSkip={() => finish.mutate()}
        />
        {/* Only while they're still being set up — a returning employer came
            here for one thing and doesn't need the whole checklist again. */}
        {!returning && <VerificationCard />}
      </div>
    );
  }

  const page = stateQuery.data?.profile as Record<string, unknown> | null | undefined;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6 py-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {returning ? "Company details" : creating ? "Create a company page" : "Set up your company"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is what candidates see when they find your jobs. You can change any of it later.
        </p>
      </div>

      {/*
        Shown before the form, not after: someone who has already typed their
        company name is far less likely to abandon it and join the existing
        one, and two profiles for one company is expensive to unpick later.
      */}
      {matches.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            Someone from {matchQuery.data?.domain} is already here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask to join them so you share one company profile, jobs and candidates. Someone
            already there has to approve the request.
          </p>
          <div className="mt-3 space-y-2">
            {matches.map((m) => (
              <button
                key={m.profileId}
                type="button"
                onClick={() => setJoining(joining?.profileId === m.profileId ? null : m)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  joining?.profileId === m.profileId
                    ? "border-primary bg-card"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {m.companyLogo ? (
                    <img src={m.companyLogo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.companyName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Matched on {m.matchedOn}
                    {m.industry ? ` · ${m.industry}` : ""}
                  </span>
                </span>
                {joining?.profileId === m.profileId && (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          {joining && (
            <button
              type="button"
              onClick={() => setJoining(null)}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              No, set up a separate company instead
            </button>
          )}
        </div>
      )}

      {!joining && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          {/* A page is created by a person, as on LinkedIn. Only the name is
              asked for; it is what the team sees as the page's creator. */}
          {creating && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">Your first name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  autoComplete="given-name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Your last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  autoComplete="family-name"
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) =>
                setForm({
                  ...form,
                  companyName: e.target.value,
                  ...(slugTouched ? {} : { pageSlug: toPageSlug(e.target.value) }),
                })
              }
              placeholder="Acme Ltd"
              className="mt-1.5"
            />
          </div>

          {/* The page's own address, as on LinkedIn's creation form. */}
          <div>
            <Label htmlFor="pageSlug">Page address</Label>
            <div className="mt-1.5 flex h-10 items-center rounded-md border border-gray-300 bg-background pl-3">
              <span className="shrink-0 text-sm text-muted-foreground">{window.location.host}/company/</span>
              <Input
                id="pageSlug"
                value={form.pageSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, pageSlug: e.target.value });
                }}
                onBlur={() => setForm((f) => ({ ...f, pageSlug: toPageSlug(f.pageSlug) }))}
                placeholder="acme"
                aria-describedby="pageSlugHelp"
                autoCapitalize="none"
                spellCheck={false}
                className="h-full min-w-0 border-0 bg-transparent px-0.5"
              />
            </div>
            <p
              id="pageSlugHelp"
              className={cn(
                "mt-1 text-[11px]",
                slugRefused
                  ? "text-destructive"
                  : slugChecked?.available
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
            >
              {slugRefused
                ? slugChecked?.reason
                : slugChecked?.available
                  ? `Available — ${window.location.host}/company/${slugChecked.slug}`
                  : "Letters, numbers and hyphens. You can change it later."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={form.industry}
                onValueChange={(v) => setForm({ ...form, industry: v })}
              >
                <SelectTrigger id="industry" className="mt-1.5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="companySize">Company size</Label>
              <Select
                value={form.companySize}
                onValueChange={(v) => setForm({ ...form, companySize: v })}
              >
                <SelectTrigger id="companySize" className="mt-1.5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {companySizeOptions(form.companySize).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="companyType">Organization type</Label>
            <Select
              value={form.companyType}
              onValueChange={(v) => setForm({ ...form, companyType: v })}
            >
              <SelectTrigger id="companyType" className="mt-1.5">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyWebsite">Website</Label>
              <Input
                id="companyWebsite"
                value={form.companyWebsite}
                onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })}
                placeholder="acme.com"
                className="mt-1.5"
              />
              {/* Explains why we ask, since it isn't obviously required. */}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Helps colleagues find and join this company later.
              </p>
            </div>
            <div>
              <Label htmlFor="headquarters">Headquarters</Label>
              <Input
                id="headquarters"
                value={form.headquarters}
                onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
                placeholder="Nairobi, Kenya"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Your role (optional)</p>
            <div className="space-y-2">
              {[
                { key: "isRecruiter" as const, label: "Recruiter" },
                { key: "isHiringManager" as const, label: "Hiring manager" },
                { key: "isAdmin" as const, label: "Company admin" },
              ].map((r) => (
                <label key={r.key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={form[r.key]}
                    onCheckedChange={(v) => setForm({ ...form, [r.key]: v === true })}
                  />
                  <span className="text-muted-foreground">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {creating && (
            <label className="flex cursor-pointer items-start gap-2.5 border-t border-border pt-4 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.authorizedRepresentative}
                onCheckedChange={(v) => setForm({ ...form, authorizedRepresentative: v === true })}
              />
              <span className="text-muted-foreground">
                I'm an authorized representative of this organization, and I may create and manage
                its page on Coral. Your team will see that you created it.
              </span>
            </label>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={!canSubmit || busy}>
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          {joining
            ? `Ask to join ${joining.companyName}`
            : returning
              ? "Save changes"
              : "Continue"}
        </Button>
        {!returning && (
          <p className="text-xs text-muted-foreground">One more optional step after this.</p>
        )}
      </div>
      </div>

      {/* The page as it will look, beside the form as on LinkedIn. Not while
          asking to join: that company's page already exists. */}
      {!joining && (
        <aside className="lg:sticky lg:top-6">
          <CompanyPagePreview
            name={form.companyName}
            slug={toPageSlug(form.pageSlug)}
            industry={form.industry}
            size={form.companySize}
            type={form.companyType}
            headquarters={form.headquarters}
            website={form.companyWebsite}
            logoUrl={(page?.companyLogo as string | null | undefined) ?? null}
            tagline={(page?.tagline as string | null | undefined) ?? null}
          />
        </aside>
      )}
    </div>
  );
}
