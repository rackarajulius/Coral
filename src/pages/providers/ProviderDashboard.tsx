import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Eye, Loader2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getMyProfile as getMyJobSeekerProfile } from "@/lib/api/jobSeekerProfile";
import {
  PROVIDER_CATEGORIES,
  PROVIDER_WORK_PREFERENCES,
  getMyProviderProfile,
  providerPublicationNeeds,
  safeProviderLink,
  updateMyProviderProfile,
  type OwnerProviderProfile,
  type ProviderCategory,
  type ProviderWorkPreference,
  type UpdateProviderProfile,
} from "@/lib/api/providers";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

interface ProviderDraft {
  providerEnabled: boolean;
  publicPreviewEnabled: boolean;
  category: ProviderCategory | "";
  headline: string;
  title: string;
  summary: string;
  skills: string;
  expertise: string;
  country: string;
  city: string;
  timezone: string;
  availableForRemote: boolean;
  availability: string;
  hoursPerWeek: string;
  workPreferences: ProviderWorkPreference[];
  portfolioUrl: string;
  githubUrl: string;
  linkedinUrl: string;
}

function toDraft(profile: OwnerProviderProfile | null): ProviderDraft {
  const legacyAvailability: Record<string, string> = {
    "full-time": "available", "part-time": "limited", "not-available": "unavailable",
  };
  const rawAvailability = profile?.availability ?? "";
  return {
    providerEnabled: profile?.providerEnabled ?? false,
    publicPreviewEnabled: profile?.publicPreviewEnabled ?? false,
    category: profile?.category ?? "",
    headline: profile?.headline ?? "",
    title: profile?.title ?? "",
    summary: profile?.summary ?? "",
    skills: (profile?.skills ?? []).join(", "),
    expertise: (profile?.expertise ?? []).join(", "),
    country: profile ? profile.country ?? "" : "Canada",
    city: profile?.city ?? "",
    timezone: profile?.timezone ?? "",
    availableForRemote: profile?.availableForRemote ?? true,
    availability: ["available", "limited", "unavailable"].includes(rawAvailability)
      ? rawAvailability : legacyAvailability[rawAvailability] || "",
    hoursPerWeek: profile?.hoursPerWeek == null ? "" : String(profile.hoursPerWeek),
    workPreferences: profile?.workPreferences ?? [],
    portfolioUrl: profile?.portfolioUrl ?? "",
    githubUrl: profile?.githubUrl ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
  };
}

const listFromText = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
const optionalText = (value: string) => value.trim() || null;

function toPayload(draft: ProviderDraft): UpdateProviderProfile {
  return {
    providerEnabled: draft.providerEnabled,
    publicPreviewEnabled: draft.publicPreviewEnabled,
    category: draft.category || null,
    headline: optionalText(draft.headline),
    title: optionalText(draft.title),
    summary: optionalText(draft.summary),
    skills: listFromText(draft.skills),
    expertise: listFromText(draft.expertise),
    country: optionalText(draft.country),
    city: optionalText(draft.city),
    timezone: optionalText(draft.timezone),
    availableForRemote: draft.availableForRemote,
    availability: optionalText(draft.availability),
    hoursPerWeek: draft.hoursPerWeek === "" ? null : Number(draft.hoursPerWeek),
    workPreferences: draft.workPreferences,
    portfolioUrl: optionalText(draft.portfolioUrl),
    githubUrl: optionalText(draft.githubUrl),
    linkedinUrl: optionalText(draft.linkedinUrl),
  };
}

export default function ProviderDashboard() {
  const { user, completeOnboarding } = useAuth();
  const currentOwnerId = useRef(user?.id);
  currentOwnerId.current = user?.id;
  const queryClient = useQueryClient();
  const key = ["providers", "owner", user?.id];
  const profile = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getMyProviderProfile(signal, user),
    enabled: !!user?.id && !user.provisional && user.status === "ACTIVE",
    retry: false,
    staleTime: 0,
  });
  const [form, setForm] = useState<{ ownerId: string; values: ProviderDraft } | null>(null);
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [onboardingPending, setOnboardingPending] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  // Keep unfinished edits when a background fetch completes. Scope drafts to
  // the actual account so switching accounts never displays a previous draft.
  useEffect(() => {
    if (user?.id && profile.isSuccess) {
      setForm((current) => current?.ownerId === user.id ? current : { ownerId: user.id, values: toDraft(profile.data) });
    }
  }, [user?.id, profile.isSuccess, profile.data]);
  const draft = form?.ownerId === user?.id ? form.values : null;

  const save = useMutation({
    mutationFn: ({ payload, owner }: { payload: UpdateProviderProfile; owner: { id: string; supabaseId: string } }) => updateMyProviderProfile(payload, owner),
    onSuccess: (saved, { owner }) => {
      if (currentOwnerId.current !== owner.id || saved.userId !== owner.id) return;
      queryClient.setQueryData(["providers", "owner", saved.userId], saved);
      void queryClient.invalidateQueries({ queryKey: ["providers", "directory"] });
      void queryClient.invalidateQueries({ queryKey: ["providers", "public", saved.userId] });
      setForm({ ownerId: saved.userId, values: toDraft(saved) });
      setMessage(saved.providerEnabled && saved.publicPreviewEnabled
        ? "Saved. Your provider profile is public."
        : "Saved. Your provider profile is private.");
    },
  });
  const withdraw = useMutation({
    // Consent withdrawal must remain possible even if an old work link or an
    // unfinished edit would fail the full profile form's validation.
    mutationFn: (owner: { id: string; supabaseId: string }) => updateMyProviderProfile({ publicPreviewEnabled: false }, owner),
    onSuccess: (saved, owner) => {
      if (currentOwnerId.current !== owner.id || saved.userId !== owner.id) return;
      queryClient.setQueryData(["providers", "owner", saved.userId], saved);
      void queryClient.invalidateQueries({ queryKey: ["providers", "directory"] });
      void queryClient.invalidateQueries({ queryKey: ["providers", "public", saved.userId] });
      setForm((current) => current?.ownerId === saved.userId
        ? { ...current, values: { ...current.values, publicPreviewEnabled: false } }
        : { ownerId: saved.userId, values: toDraft(saved) });
      setMessage("Saved. Public access to your provider profile has been withdrawn. Other unsaved edits remain in this form.");
    },
  });
  const importProfile = useMutation({
    mutationFn: async (ownerId: string) => {
      const existing = await getMyJobSeekerProfile();
      if (existing.userId !== ownerId) throw new Error("Your signed-in account changed. Reload before importing your profile.");
      return existing;
    },
    onSuccess: (existing, ownerId) => {
      if (currentOwnerId.current !== ownerId || existing.userId !== ownerId) return;
      setForm((current) => {
        if (!current || current.ownerId !== ownerId) return current;
        const values = { ...current.values };
        const fields: (keyof Pick<ProviderDraft, "headline" | "summary" | "city" | "country" | "portfolioUrl" | "githubUrl" | "linkedinUrl">)[] = [
          "headline", "summary", "city", "country", "portfolioUrl", "githubUrl", "linkedinUrl",
        ];
        for (const field of fields) {
          if (!values[field].trim() && existing[field]?.trim()) values[field] = existing[field];
        }
        if (!listFromText(values.skills).length && existing.skills?.length) values.skills = existing.skills.join(", ");
        const existingTimezone = (existing as typeof existing & { timezone?: string | null }).timezone;
        if (!values.timezone.trim() && existingTimezone?.trim()) values.timezone = existingTimezone;
        return { ...current, values };
      });
      setValidationError("");
      setMessage("Filled available professional details in empty fields. Review and save them when ready. Your visibility choices stay the same.");
    },
  });
  const busy = save.isPending || withdraw.isPending || importProfile.isPending;
  useEffect(() => {
    setMessage("");
    setValidationError("");
    setOnboardingError("");
    setOnboardingPending(false);
    save.reset();
    withdraw.reset();
    importProfile.reset();
    // Auth changes must detach the previous account's mutation UI as well as
    // its draft. Mutation callbacks also check their initiating account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function update<K extends keyof ProviderDraft>(field: K, value: ProviderDraft[K]) {
    if (!draft || !user) return;
    setForm({ ownerId: user.id, values: { ...draft, [field]: value } });
    setMessage("");
    setValidationError("");
    save.reset();
    withdraw.reset();
    importProfile.reset();
  }

  const payload = draft ? toPayload(draft) : null;
  const needs = payload ? providerPublicationNeeds({
    category: payload.category,
    headline: payload.headline,
    summary: payload.summary,
    skills: payload.skills,
    portfolioUrl: payload.portfolioUrl,
    githubUrl: payload.githubUrl,
    linkedinUrl: payload.linkedinUrl,
  }) : [];
  const savedIsPublic = profile.data?.providerEnabled && profile.data?.publicPreviewEnabled && profile.data?.readiness?.ready;
  const isDirty = !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(profile.data ?? null));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!payload || busy) return;
    if ([payload.portfolioUrl, payload.githubUrl, payload.linkedinUrl].some((value) => value && !safeProviderLink(value))) {
      setValidationError("Use complete http:// or https:// links without a username or password.");
      return;
    }
    if (payload.skills.length > 30 || payload.expertise.length > 20) {
      setValidationError("Keep your profile focused: add up to 30 skills and 20 focus areas.");
      return;
    }
    if (payload.skills.some((skill) => skill.length > 80) || payload.expertise.some((area) => area.length > 100)) {
      setValidationError("Use up to 80 characters per skill and 100 per focus area.");
      return;
    }
    if (draft.providerEnabled && draft.publicPreviewEnabled && needs.length) {
      setValidationError(`Before making your profile public, add ${needs.join(", ")}. You can switch public visibility off to save a private draft.`);
      return;
    }
    setValidationError("");
    setMessage("");
    save.mutate({ payload, owner: { id: user.id, supabaseId: user.supabaseId } });
  }

  async function finishLegacyOnboarding() {
    if (!user || user.provisional || user.role !== "FREELANCER" || user.status !== "PENDING_ONBOARDING") return;
    const owner = { id: user.id, supabaseId: user.supabaseId };
    setOnboardingPending(true);
    setOnboardingError("");
    try {
      await completeOnboarding("FREELANCER", {}, owner.supabaseId);
      if (currentOwnerId.current !== owner.id) return;
      await queryClient.invalidateQueries({ queryKey: ["providers", "owner", owner.id] });
    } catch (error) {
      if (currentOwnerId.current === owner.id) {
        setOnboardingError(error instanceof Error ? error.message : "We couldn't finish your setup. Please try again.");
      }
    } finally {
      if (currentOwnerId.current === owner.id) setOnboardingPending(false);
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">Your professional presence</p><h1 className="text-3xl font-semibold tracking-tight">Offer your expertise</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Introduce your work to companies and clients. Start with a private draft and choose when to share it.</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/providers">Find professionals</Link></Button>{user?.status === "ACTIVE" && <><Button asChild variant="outline"><Link to="/marketplace/manage?kind=service">Manage my services</Link></Button><Button asChild variant="outline"><Link to="/marketplace/inbox">Marketplace inbox</Link></Button></>}</div>
        </div>

        {user?.role === "FREELANCER" && user.status === "PENDING_ONBOARDING" && <Card className="max-w-2xl rounded-2xl"><CardHeader><CardTitle className="text-xl">Finish your provider setup</CardTitle><CardDescription>Continue with your existing freelancer account, then add your work and decide what to share.</CardDescription></CardHeader><CardContent><p className="mb-5 text-sm leading-6 text-muted-foreground">Your provider introduction starts privately. You can choose public visibility after adding your professional details.</p>{onboardingError && <p className="mb-4 text-sm text-destructive" role="alert">{onboardingError}</p>}<Button disabled={onboardingPending} onClick={() => void finishLegacyOnboarding()}>{onboardingPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{onboardingPending ? "Finishing setup…" : "Continue provider setup"}</Button></CardContent></Card>}
        {user?.status === "ACTIVE" && profile.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your provider profile…</p>}
        {profile.isError && <div className="rounded-xl border border-destructive/30 p-6" role="alert"><h2 className="font-semibold">We couldn't load your profile</h2><p className="mt-2 text-sm text-muted-foreground">{profile.error.message}</p><Button variant="outline" onClick={() => void profile.refetch()} className="mt-4">Try again</Button></div>}

        {user?.status === "ACTIVE" && draft && !profile.isError && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-lg">How you want to work</CardTitle><CardDescription>These choices describe your personal work preferences.</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4"><div><Label htmlFor="provider-enabled" className="font-medium">I offer professional services</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">Enable your provider profile. Public visibility is a separate choice below.</p></div><Switch id="provider-enabled" checked={draft.providerEnabled} onCheckedChange={(value) => update("providerEnabled", value)} /></div>
                  <fieldset><legend className="mb-3 text-sm font-medium">I'm interested in</legend><div className="flex flex-wrap gap-4">{PROVIDER_WORK_PREFERENCES.map((item) => <div key={item.value} className="flex items-center gap-2"><Checkbox id={`work-${item.value}`} checked={draft.workPreferences.includes(item.value)} onCheckedChange={(checked) => update("workPreferences", checked ? [...draft.workPreferences, item.value] : draft.workPreferences.filter((value) => value !== item.value))} /><Label htmlFor={`work-${item.value}`}>{item.label}</Label></div>)}</div></fieldset>
                  {user?.role === "JOB_SEEKER" && <p className="text-sm text-muted-foreground">Looking for employment too? Your <Link to="/jobseeker/preferences" className="text-primary underline underline-offset-4">job preferences</Link> and applications stay available.</p>}
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-lg">Introduce your work</CardTitle><CardDescription>The first Coral pilot brings together professionals in design, marketing and software in Canada.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  {user?.role === "JOB_SEEKER" && <div className="rounded-xl border p-4"><Button type="button" variant="outline" onClick={() => { setMessage(""); save.reset(); importProfile.mutate(user.id); }}>{importProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Use my professional profile</Button><p className="mt-2 text-xs leading-5 text-muted-foreground">Fill empty introduction, skills, location and work-link fields from your existing profile. Review them before saving. Filled fields and visibility choices stay as they are.</p>{importProfile.isError && <p className="mt-2 text-xs text-destructive" role="alert">{importProfile.error.message}</p>}</div>}
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="provider-category">Category</Label><select id="provider-category" className={selectClass} value={draft.category} onChange={(event) => update("category", event.target.value as ProviderCategory | "")}><option value="">Choose a category</option>{PROVIDER_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="provider-title">Professional title</Label><Input id="provider-title" maxLength={255} placeholder="e.g. Product designer" value={draft.title} onChange={(event) => update("title", event.target.value)} /></div></div>
                  <div className="space-y-2"><Label htmlFor="provider-headline">Headline</Label><Input id="provider-headline" maxLength={255} placeholder="Describe the work you help people accomplish" value={draft.headline} onChange={(event) => update("headline", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="provider-summary">Introduction</Label><Textarea id="provider-summary" rows={5} maxLength={5000} placeholder="Who do you help, what do you do, and what experience can you share?" value={draft.summary} onChange={(event) => update("summary", event.target.value)} /><p className="text-xs text-muted-foreground">Use at least 30 characters for a public profile. Share only information you want visitors to read.</p></div>
                  <div className="space-y-2"><Label htmlFor="provider-skills">Skills</Label><Input id="provider-skills" value={draft.skills} onChange={(event) => update("skills", event.target.value)} placeholder="e.g. Figma, user research, prototyping" /><p className="text-xs text-muted-foreground">Separate skills with commas. Up to 30 skills.</p></div>
                  <div className="space-y-2"><Label htmlFor="provider-expertise">Focus areas</Label><Input id="provider-expertise" value={draft.expertise} onChange={(event) => update("expertise", event.target.value)} placeholder="e.g. Brand identity, product strategy" /><p className="text-xs text-muted-foreground">Optional. Separate areas with commas.</p></div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-lg">Work evidence</CardTitle><CardDescription>Link to a portfolio or GitHub work so visitors can explore what you've created.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="provider-portfolio">Portfolio or work website</Label><Input id="provider-portfolio" type="url" maxLength={2048} placeholder="https://" value={draft.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="provider-github">GitHub work</Label><Input id="provider-github" type="url" maxLength={2048} placeholder="https://github.com/" value={draft.githubUrl} onChange={(event) => update("githubUrl", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="provider-linkedin">LinkedIn profile</Label><Input id="provider-linkedin" type="url" maxLength={2048} placeholder="https://www.linkedin.com/in/" value={draft.linkedinUrl} onChange={(event) => update("linkedinUrl", event.target.value)} /><p className="text-xs text-muted-foreground">Optional professional profile link. A public profile also needs a portfolio or GitHub work link.</p></div>
                  <p className="text-xs leading-5 text-muted-foreground">Coral displays these as links you supply. It does not label them as verified skills or completed projects.</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-lg">Location and availability</CardTitle><CardDescription>Let visitors understand where and how you work.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="provider-country">Country</Label><Input id="provider-country" maxLength={100} value={draft.country} onChange={(event) => update("country", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="provider-city">City</Label><Input id="provider-city" maxLength={100} value={draft.city} onChange={(event) => update("city", event.target.value)} /></div></div>
                  <div className="space-y-2"><Label htmlFor="provider-timezone">Timezone</Label><Input id="provider-timezone" maxLength={100} placeholder="e.g. America/Toronto" value={draft.timezone} onChange={(event) => update("timezone", event.target.value)} /><p className="text-xs text-muted-foreground">Optional. Helps visitors understand your working hours.</p></div>
                  <div className="flex items-center gap-2"><Checkbox id="provider-remote" checked={draft.availableForRemote} onCheckedChange={(value) => update("availableForRemote", value === true)} /><Label htmlFor="provider-remote">Open to remote work</Label></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="provider-availability">Availability</Label><select id="provider-availability" className={selectClass} value={draft.availability} onChange={(event) => update("availability", event.target.value)}><option value="">Not specified</option><option value="available">Available for work</option><option value="limited">Limited availability</option><option value="unavailable">Currently unavailable</option>{draft.availability && !["available", "limited", "unavailable"].includes(draft.availability) && <option value={draft.availability}>Update previous availability</option>}</select></div><div className="space-y-2"><Label htmlFor="provider-hours">Hours available per week</Label><Input id="provider-hours" type="number" min={0} max={168} step={1} value={draft.hoursPerWeek} onChange={(event) => update("hoursPerWeek", event.target.value)} placeholder="Optional" /></div></div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-lg">Choose your visibility</CardTitle><CardDescription>A saved draft is private unless you choose to publish it.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3"><Checkbox id="provider-public" checked={draft.publicPreviewEnabled} onCheckedChange={(value) => update("publicPreviewEnabled", value === true)} className="mt-0.5" /><div><Label htmlFor="provider-public" className="font-medium">Make my provider profile public</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">Anyone, including people signed out of Coral, can see your name, profile photo and the work details and links above. Your public profile can appear in Find professionals. Turn this off to withdraw that access.</p></div></div>
                  {user?.role === "JOB_SEEKER" && <p className="text-xs leading-5 text-muted-foreground">Your job-search profile has separate visibility controls in <Link to="/jobseeker/settings" className="text-primary underline underline-offset-4">account settings</Link>.</p>}
                  {!draft.providerEnabled && draft.publicPreviewEnabled && <p className="text-sm text-muted-foreground">Your profile will stay private while offering services is switched off.</p>}
                  {!!needs.length && <p className="text-xs leading-5 text-muted-foreground">Before public sharing, add {needs.join(", ")}. You can save a private draft at any time.</p>}
                </CardContent>
              </Card>
            </fieldset>

            {(validationError || save.isError || withdraw.isError) && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{validationError || save.error?.message || withdraw.error?.message}</div>}
            {message && <p className="flex items-center gap-2 rounded-xl bg-primary/5 p-4 text-sm" role="status"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />{message}</p>}
            <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || (!isDirty && !!profile.data)}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{save.isPending ? "Saving…" : "Save provider profile"}</Button>{isDirty && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setForm({ ownerId: user.id, values: toDraft(profile.data ?? null) }); setValidationError(""); setMessage(""); save.reset(); withdraw.reset(); }}>Discard changes</Button>}</div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base">{savedIsPublic ? <Eye className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}{savedIsPublic ? "Public profile" : "Private profile"}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{savedIsPublic ? "Visitors can discover the work details in your saved provider profile." : "Your saved provider profile is visible only to you. Build your introduction before sharing."}</p>{profile.data && <Button asChild variant="outline" className="w-full"><Link to="/provider/preview"><Eye className="mr-2 h-4 w-4" aria-hidden="true" />Preview saved profile</Link></Button>}{savedIsPublic && <><Button asChild variant="ghost" className="w-full"><Link to={`/providers/${profile.data.userId}`}>View public profile<ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" /></Link></Button><Button variant="outline" className="w-full" disabled={busy} onClick={() => { setValidationError(""); setMessage(""); save.reset(); withdraw.mutate({ id: user.id, supabaseId: user.supabaseId }); }}>{withdraw.isPending ? "Withdrawing access…" : "Make saved profile private"}</Button></>}{isDirty && <p className="text-xs text-muted-foreground">Save your changes before previewing them.</p>}</CardContent></Card>
            <div className="px-2 text-xs leading-6 text-muted-foreground"><p>Your provider introduction uses your Coral name and profile photo.</p>{user?.role === "JOB_SEEKER" && <Link to="/jobseeker/profile" className="text-primary underline underline-offset-4">Manage your personal profile</Link>}</div>
          </aside>
        </div>}
      </main>
    </>
  );
}
