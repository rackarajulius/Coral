import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Eye, Image, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { MobileNav } from "@/components/employer-dashboard/companyProfile/MobileNav";
import { SaveIndicator, type SaveState } from "@/components/employer-dashboard/companyProfile/SaveIndicator";
import { StrengthCard } from "@/components/employer-dashboard/companyProfile/StrengthCard";
import { TipsCard } from "@/components/employer-dashboard/companyProfile/TipsCard";
import { Button } from "@/components/ui/button";
import {
  EmployerBrand,
  STEPS,
  STORAGE_KEY,
  PUBLISHED_KEY,
  STEP_KEY,
  COMPLETED_KEY,
  OWNER_KEY,
  calcProfileStrength,
  defaultEmployerBrand,
  employerBrandSchema,
  normalizeEmployerBrand,
} from "@/data/companyProfile/employer-brand-schema";
import { HorizontalStepper } from "@/components/employer-dashboard/companyProfile/HorizontalStepper";
import { PreviewModal } from "@/components/employer-dashboard/companyProfile/PreviewModal";
import { BasicInfoStep } from "@/components/employer-dashboard/companyProfile/steps/BasicInfoStep";
import { AboutStoryStep } from "@/components/employer-dashboard/companyProfile/steps/AboutStoryStep";
import { VisualsMediaStep } from "@/components/employer-dashboard/companyProfile/steps/VisualsMediaStep";
import { CultureEvpStep } from "@/components/employer-dashboard/companyProfile/steps/CultureEvpStep";
import { PeopleTestimonialsStep } from "@/components/employer-dashboard/companyProfile/steps/PeopleTestimonialsStep";
import { ReviewPublishStep } from "@/components/employer-dashboard/companyProfile/steps/ReviewPublishStep";
import {
  EmployerCompany,
  UpdateEmployerCompanyPayload,
  getMyCompany,
  updateMyCompany,
} from "@/lib/api/employerCompany";
import { useEmployerCompanyStore } from "@/stores/employerCompanyStore";

/**
 * Falls back to the already-fetched company from `useEmployerCompanyStore` (warmed by
 * `EmployerLayout` on layout mount) instead of the "Acme Technologies" demo content, so
 * repeat visits to this page render real branding immediately instead of flashing the
 * placeholder while this page's own fetch below is in flight.
 */
function cachedCompanyDefaults(): EmployerBrand {
  const cached = useEmployerCompanyStore.getState().company;
  if (!cached) return defaultEmployerBrand;
  return normalizeEmployerBrand(mergeDefined(defaultEmployerBrand, companyToBrandPartial(cached)));
}

function loadDraft(): EmployerBrand {
  if (typeof window === "undefined") return cachedCompanyDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cachedCompanyDefaults();
    const parsed = JSON.parse(raw);
    return normalizeEmployerBrand({ ...defaultEmployerBrand, ...parsed });
  } catch {
    return cachedCompanyDefaults();
  }
}

/** Maps the saved EmployerProfile's core branding fields onto the wizard's draft shape. */
function companyToBrandPartial(company: EmployerCompany): Partial<EmployerBrand> {
  if (company.companyName === "New Company") return {};

  return {
    displayName: company.companyName,
    tagline: company.tagline ?? undefined,
    logo: company.companyLogo ?? undefined,
    banner: company.companyBanner ?? undefined,
    website: company.companyWebsite ?? undefined,
    companySize: company.companySize ?? undefined,
    foundedYear: company.foundedYear ? String(company.foundedYear) : undefined,
    industries: company.industries?.length ? company.industries : undefined,
    headquarters: company.headquarters ?? undefined,
    locations: company.locations?.length ? company.locations : undefined,
    social: company.socialLinks?.length ? company.socialLinks : undefined,
    overview: company.overview ?? undefined,
    mission: company.mission ?? undefined,
    vision: company.vision ?? undefined,
    visibility: company.visibility,
    showJobs: company.showJobs,
    allowFollow: company.allowFollow,
  };
}

/** True for a persistable URL — a real link, not a local data:/blob: preview. */
function isStoredUrl(url?: string): url is string {
  return !!url && !url.startsWith("data:") && !url.startsWith("blob:");
}

/** Maps the wizard's core branding fields onto the EmployerProfile update payload. */
function brandToCompanyPayload(brand: EmployerBrand): UpdateEmployerCompanyPayload {
  const foundedYear = parseInt(brand.foundedYear, 10);

  return {
    companyName: brand.displayName,
    tagline: brand.tagline || undefined,
    companyLogo: brand.logo || undefined,
    companyBanner: brand.banner || undefined,
    companyWebsite: brand.website || undefined,
    companySize: brand.companySize || undefined,
    foundedYear: Number.isFinite(foundedYear) ? foundedYear : undefined,
    industries: brand.industries,
    headquarters: brand.headquarters || undefined,
    locations: brand.locations as unknown as UpdateEmployerCompanyPayload["locations"],
    socialLinks: brand.social as unknown as UpdateEmployerCompanyPayload["socialLinks"],
    overview: brand.overview || undefined,
    mission: brand.mission || undefined,
    vision: brand.vision || undefined,
    coreValues: brand.values
      .filter((v) => v.title.trim())
      .map((v) => ({
        title: v.title.trim(),
        description: v.description?.trim() || undefined,
        icon: v.icon || undefined,
      })),
    // Only persist real (uploaded/external) URLs — drop any leftover local
    // data:/blob: previews that never made it to storage.
    galleryPhotos: brand.gallery
      .filter((g) => g.url && !g.url.startsWith("data:") && !g.url.startsWith("blob:"))
      .map((g) => ({ url: g.url, caption: g.caption || undefined })),
    cultureVideoUrl: isStoredUrl(brand.cultureVideo) ? brand.cultureVideo : undefined,
    companyCulture: brand.cultureDescription || undefined,
    culturePhilosophy: brand.culturePhilosophy || undefined,
    cultureCollaboration: brand.cultureCollaboration || undefined,
    cultureImageUrl: isStoredUrl(brand.cultureImage) ? brand.cultureImage : undefined,
    // Flatten the benefit-categories builder into the public flat benefit list.
    companyBenefits: brand.benefitCategories
      .flatMap((c) => c.items.map((i) => i.label.trim()))
      .filter(Boolean),
    whyWorkHere: brand.whyWorkHere
      .filter((w) => w.title.trim())
      .map((w) => ({
        icon: w.icon || undefined,
        title: w.title.trim(),
        description: w.description?.trim() || undefined,
      })),
    awards: brand.awards
      .filter((a) => a.title.trim() && a.organization.trim())
      .map((a) => ({
        title: a.title.trim(),
        organization: a.organization.trim(),
        year: a.year.trim(),
        description: a.description?.trim() || undefined,
        badgeUrl: a.badgeUrl || undefined,
      })),
    diversityStatement: brand.diversityStatement || undefined,
    deiStats: brand.deiStats
      .filter((s) => s.label.trim() && s.value.trim())
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
    visibility: brand.visibility,
    showJobs: brand.showJobs,
    allowFollow: brand.allowFollow,
  };
}

/** Merges only the defined (non-undefined) keys of `overrides` onto `base`. */
function mergeDefined<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

const STEP_FIELDS: Partial<Record<number, (keyof EmployerBrand)[]>> = {
  1: ["displayName"],
  2: ["overview"],
};

const Company = () => {
  const [step, setStep] = useState<number>(() => {
    try {
      const n = parseInt(window.localStorage.getItem(STEP_KEY) ?? "", 10);
      return n >= 1 && n <= STEPS.length ? n : 1;
    } catch { return 1; }
  });
  const [completed, setCompleted] = useState<Set<number>>(() => {
    try {
      const raw = window.localStorage.getItem(COMPLETED_KEY);
      return raw ? new Set<number>(JSON.parse(raw)) : new Set<number>();
    } catch { return new Set<number>(); }
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPublished, setIsPublished] = useState(() => {
    try { return !!window.localStorage.getItem(PUBLISHED_KEY); } catch { return false; }
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"unverified" | "verified">("unverified");

  const methods = useForm<EmployerBrand>({
    defaultValues: loadDraft(),
    resolver: zodResolver(employerBrandSchema),
    mode: "onBlur",
  });

  const data = methods.watch();
  const strength = useMemo(() => calcProfileStrength(data), [data]);

  // Debounced auto-save via watch subscription (avoids JSON.stringify dependency)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const { unsubscribe } = methods.watch((values) => {
      if (!methods.formState.isDirty) return;
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
          setSaveState("saved");
          setLastSavedAt(new Date());
        } catch {
          setSaveState("idle");
        }
      }, 700);
    });
    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [methods]);

  // Reset "saved" indicator to idle after 30s so timestamp doesn't go stale
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 30_000);
    return () => clearTimeout(t);
  }, [saveState]);

  // Warn before unloading if there are unsaved (unpublished) changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (methods.formState.isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [methods.formState.isDirty]);

  // Load previously-saved core branding from the server and merge it into the draft
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const company = await getMyCompany();
        if (cancelled) return;
        setVerificationStatus(company.verificationStatus);

        // The local draft is keyed by browser, not account — if it belongs to a
        // different (or unrecorded, e.g. pre-existing) signed-in user, discard it
        // so this user starts fresh.
        const ownerId = window.localStorage.getItem(OWNER_KEY);
        if (ownerId !== company.userId) {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(PUBLISHED_KEY);
          window.localStorage.removeItem(STEP_KEY);
          window.localStorage.removeItem(COMPLETED_KEY);
          methods.reset(defaultEmployerBrand);
          setStep(1);
          setCompleted(new Set());
          setIsPublished(false);
        }
        window.localStorage.setItem(OWNER_KEY, company.userId);

        const partial = companyToBrandPartial(company);
        if (Object.keys(partial).length === 0) return;
        methods.reset(mergeDefined(methods.getValues(), partial));
      } catch {
        // Not signed in yet or backend unreachable — keep the local draft.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist step position so the user resumes where they left off
  useEffect(() => {
    try { window.localStorage.setItem(STEP_KEY, String(step)); } catch (_) { /* storage unavailable */ }
  }, [step]);

  useEffect(() => {
    try { window.localStorage.setItem(COMPLETED_KEY, JSON.stringify([...completed])); } catch (_) { /* storage unavailable */ }
  }, [completed]);

  function goToStep(id: number) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (id > step) next.add(step);
      return next;
    });
    setStep(id);
  }

  async function next() {
    if (step >= STEPS.length) return;
    const fields = STEP_FIELDS[step];
    if (fields && fields.length > 0) {
      const valid = await methods.trigger(fields as Parameters<typeof methods.trigger>[0]);
      if (!valid) {
        const errors = methods.formState.errors;
        const first = fields.find((f) => errors[f as keyof typeof errors]);
        if (first) {
          const label: Record<string, string> = {
            displayName: "Company name",
            overview: "Company overview",
          };
          toast.error(`${label[first] ?? first} is required before continuing.`);
        }
        return;
      }
    }
    goToStep(step + 1);
  }
  function back() {
    if (step > 1) goToStep(step - 1);
  }

  async function handleSaveDraft() {
    const values = methods.getValues();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    setSaveState("saved");
    setLastSavedAt(new Date());
    toast.success("Draft saved");

    try {
      const updated = await updateMyCompany(brandToCompanyPayload(values));
      setVerificationStatus(updated.verificationStatus);
      useEmployerCompanyStore.getState().setCompany(updated);
    } catch {
      toast.error("Couldn't sync your draft to the server. It's still saved locally.");
    }
  }

  async function handlePublish() {
    if (isPublishing) return;
    const valid = await methods.trigger();
    if (!valid) {
      toast.error("Some fields need attention before publishing.");
      return;
    }
    setIsPublishing(true);
    const values = methods.getValues();
    // Keep the local draft in sync, but don't mark "Published" until the
    // server confirms the write below.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));

    try {
      const updated = await updateMyCompany(brandToCompanyPayload(values));
      setVerificationStatus(updated.verificationStatus);
      useEmployerCompanyStore.getState().setCompany(updated);

      // Server confirmed — now it's truly published.
      window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(values));
      window.localStorage.removeItem(STEP_KEY);
      window.localStorage.removeItem(COMPLETED_KEY);
      setSaveState("saved");
      setLastSavedAt(new Date());
      setIsPublished(true);
      toast.success("Profile published!", {
        description: "Your profile is now live for candidates.",
      });
    } catch {
      toast.error("Couldn't publish", {
        description: "We couldn't reach the server. Your changes are saved as a draft — try again shortly.",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <>
      <FormProvider {...methods}>
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-card border border-border overflow-hidden flex items-center justify-center shrink-0">
                {data.logo ? (
                  <img src={data.logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Company Profile</p>
                <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight truncate">
                  {data.displayName || "Your company"}
                </h1>
              </div>
              <SaveIndicator state={saveState} at={lastSavedAt} />
              {isPublished && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Published
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl gap-2" onClick={handleSaveDraft}>
                <Save className="w-4 h-4" /> Save draft
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4" /> Preview
              </Button>
              <Button variant="default" className="rounded-xl gap-2" onClick={handlePublish} disabled={isPublishing}>
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isPublishing ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>

          {/* Stepper */}
          <div className="rounded-2xl border border-border bg-card p-5 mb-5">
            <HorizontalStepper currentStep={step} completedSteps={completed} onStepClick={goToStep} />
          </div>

          {/* Mobile profile strength — reuses StrengthCard, hidden on lg+ where the sidebar shows it */}
          <div className="lg:hidden">
            <StrengthCard strength={strength} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
            {/* Main */}
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 min-h-[480px]">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wider text-orange-500 font-semibold mb-1">
                  Step {step} of {STEPS.length}
                </p>
                <h2 className="text-xl font-display font-bold">{STEPS[step - 1].label}</h2>
                <p className="text-sm text-muted-foreground">{STEPS[step - 1].description}</p>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {step === 1 && <BasicInfoStep />}
                  {step === 2 && <AboutStoryStep />}
                  {step === 3 && <VisualsMediaStep />}
                  {step === 4 && <CultureEvpStep />}
                  {step === 5 && <PeopleTestimonialsStep />}
                  {step === 6 && <ReviewPublishStep onGoToStep={goToStep} verificationStatus={verificationStatus} />}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <Button variant="outline" onClick={back} disabled={step === 1} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                {step === STEPS.length ? (
                  <Button variant="default" className="gap-2 rounded-xl" onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isPublishing ? "Publishing…" : "Publish profile"}
                  </Button>
                ) : (
                  <Button variant="default" className="gap-2 rounded-xl" onClick={next}>
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Side panel */}
            <aside className="space-y-4 hidden lg:block">
              <StrengthCard strength={strength} />
              <TipsCard data={data} />
            </aside>
          </div>
        </div>

        <PreviewModal open={previewOpen} onOpenChange={setPreviewOpen} data={data} />
      </FormProvider>
      <MobileNav />
    </>
  );
};

export default Company;