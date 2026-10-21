import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { useForm, useFieldArray, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, Eye, Save, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Form } from "@/components/ui/form";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import { editJobSchema, EditJobForm } from "@/data/employer/Jobs/types";
import JobDetailsSection from "@/components/employer-dashboard/job-edit/JobDetailsSection";
import JobDescriptionSection from "@/components/employer-dashboard/job-edit/JobDescriptionSection";
import SkillsSection from "@/components/employer-dashboard/job-edit/SkillsSection";
import SalarySection from "@/components/employer-dashboard/job-edit/SalarySection";
import BenefitsSection from "@/components/employer-dashboard/job-edit/BenefitsSection";
import ApplicationSettingsSection from "@/components/employer-dashboard/job-edit/ApplicationSettings";
import PostingStatementsSection from "@/components/employer-dashboard/job-edit/PostingStatementsSection";
import { vacancyForJob } from "@/lib/jobs/postingStatements";
import LivePreview from "@/components/employer-dashboard/job-edit/LivePreview";
import { EmployerCompany, getMyCompany } from "@/lib/api/employerCompany";
import { toRemoteFlags } from "@/lib/jobs/workArrangement";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const steps = [
  { label: "Job Details", key: "details" },
  { label: "Description", key: "description" },
  { label: "Skills", key: "skills" },
  { label: "Salary", key: "salary" },
  { label: "Benefits", key: "benefits" },
  { label: "Settings", key: "settings" },
];

const stepFields: Record<number, Path<EditJobForm>[]> = {
  0: ["title", "location", "jobType", "workArrangement", "department", "experienceLevel"],
  1: ["description"],
  2: ["skills"],
  3: ["salaryMin", "salaryMax", "currency", "payType"],
  4: ["benefits"],
  5: ["applicationDeadline", "applicationMethod", "applicationUrl", "applicationEmail", "status", "existingVacancy", "usesAi"],
};

const emptyDefaults: EditJobForm = {
  title: "",
  location: "",
  jobType: "",
  workArrangement: "",
  department: "",
  experienceLevel: "",
  description: "",
  skills: [],
  salaryMin: 0,
  salaryMax: 0,
  currency: "USD",
  payType: "yearly",
  benefits: [],
  applicationDeadline: undefined,
  applicationMethod: "internal",
  applicationUrl: "",
  applicationEmail: "",
  status: "draft",
  existingVacancy: "",
  usesAi: false,
};

// ─── Route-state pre-fill helpers ────────────────────────────────────────────

interface HAPrefill {
  title?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  niceToHave?: string[];
  compensation?: string;
}

function buildDescriptionFromPrefill(p: HAPrefill): string {
  const parts: string[] = [];
  if (p.description) parts.push(`About the Role\n${p.description}`);
  if (p.responsibilities?.length)
    parts.push(`What You'll Do\n${p.responsibilities.map((r) => `• ${r}`).join("\n")}`);
  if (p.requirements?.length)
    parts.push(`What We're Looking For\n${p.requirements.map((r) => `• ${r}`).join("\n")}`);
  if (p.niceToHave?.length)
    parts.push(`Nice to Have\n${p.niceToHave.map((r) => `• ${r}`).join("\n")}`);
  return parts.join("\n\n");
}

function extractSkills(requirements: string[]): { value: string }[] {
  return requirements
    .slice(0, 6)
    .map((r) => {
      // Pull first clause before any comma/dash/period (strip leading bullet markers)
      const clean = r.replace(/^[•\-–—]\s*/, "");
      const snippet = clean.split(/[,;.–—]/)[0].trim();
      return { value: snippet.length > 2 ? snippet : clean };
    })
    .filter((s) => s.value.length > 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

const PostJob = () => {
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [showBenefitSuggestions, setShowBenefitSuggestions] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState<EditJobForm | null>(null);
  const [company, setCompany] = useState<EmployerCompany | null>(null);

  const form = useForm<EditJobForm>({
    resolver: zodResolver(editJobSchema),
    defaultValues: emptyDefaults,
    mode: "onChange",
  });

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({ control: form.control, name: "skills" });

  const {
    fields: benefitFields,
    append: appendBenefit,
    remove: removeBenefit,
  } = useFieldArray({ control: form.control, name: "benefits" });

  const watchedValues = form.watch();
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const progress = ((step + 1) / steps.length) * 100;

  // Pre-fill the company logo from the employer's branded profile (set at
  // /employers/company), unless the user has already chosen one in this session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyCompany();
        if (cancelled) return;
        setCompany(data);
        if (data.companyName !== "New Company" && data.companyLogo) {
          setLogoUrl((current) => current ?? data.companyLogo);
        }
      } catch {
        // Not signed in yet or backend unreachable — leave logo upload manual.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNext = async () => {
    const valid = await form.trigger(stepFields[step]);
    if (valid) {
      setCompletedSteps((prev) => new Set(prev).add(step));
      setStep(step + 1);
    }
  };

  // Pre-fill from Hiring Assistant route state, or offer to restore a saved draft
  useEffect(() => {
    const prefill = location.state?.prefill as HAPrefill | undefined;

    if (prefill) {
      if (prefill.title) form.setValue("title", prefill.title, { shouldDirty: false });

      const description = buildDescriptionFromPrefill(prefill);
      if (description.length >= 50) {
        form.setValue("description", description, { shouldDirty: false });
      }

      const skills = extractSkills(prefill.requirements ?? []);
      if (skills.length > 0) {
        form.setValue("skills", skills, { shouldDirty: false });
      }

      toast.success("Hiring Assistant JD imported", {
        description: `"${prefill.title || "Role"}" pre-filled — review each step before posting.`,
        duration: 5000,
      });
      return;
    }

    // No route-state prefill — check for a locally saved draft
    const raw = localStorage.getItem("postjob_draft");
    if (!raw) return;

    try {
      const { _savedAt, _step, _completedSteps, applicationDeadline, ...rest } = JSON.parse(raw);
      toast("Resume draft?", {
        description: _savedAt
          ? `"${rest.title || "Untitled"}" — saved ${format(new Date(_savedAt), "MMM d 'at' h:mm a")}`
          : `"${rest.title || "Untitled"}"`,
        duration: Infinity,
        action: {
          label: "Resume",
          onClick: () => {
            form.reset({
              ...rest,
              applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
            });
            if (typeof _step === "number") setStep(_step);
            if (Array.isArray(_completedSteps)) setCompletedSteps(new Set(_completedSteps));
          },
        },
        cancel: {
          label: "Discard",
          onClick: () => localStorage.removeItem("postjob_draft"),
        },
      });
    } catch {
      localStorage.removeItem("postjob_draft");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentional: run only on mount using route state captured at render

  const saveDraft = useCallback(() => {
    setSaveState("saving");
    const values = form.getValues();
    const draft = {
      ...values,
      applicationDeadline: values.applicationDeadline?.toISOString(),
      _savedAt: new Date().toISOString(),
      _step: step,
      _completedSteps: Array.from(completedSteps),
    };
    localStorage.setItem("postjob_draft", JSON.stringify(draft));
    setTimeout(() => {
      setSaveState("saved");
      setLastSaved(new Date());
      dirtyRef.current = false;
    }, 800);
  }, [form, step, completedSteps]);

  // Auto-save to localStorage every 3 s of inactivity
  useEffect(() => {
    const sub = form.watch(() => {
      dirtyRef.current = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (dirtyRef.current) saveDraft();
      }, 3000);
    });
    return () => sub.unsubscribe();
  }, [form, saveDraft]);

  const simulateAI = useCallback((key: string, duration = 2000) => {
    setAiLoading(key);
    setTimeout(() => setAiLoading(null), duration);
  }, []);

  const handleAIGenerateDescription = () => {
    simulateAI("description", 2500);
    setTimeout(() => {
      form.setValue(
        "description",
        `About the Role\nWe're seeking an exceptional professional to join our team and drive meaningful impact. In this role, you'll work on challenging problems alongside talented teammates.\n\nWhat You'll Do\n• Lead initiatives and contribute to team goals\n• Collaborate with cross-functional teams\n• Build scalable, production-quality solutions\n• Mentor teammates and champion best practices\n\nWhat We're Looking For\n• Relevant industry experience\n• Strong communication and collaboration skills\n• Track record of delivering high-quality work\n• Passion for continuous learning`,
        { shouldDirty: true }
      );
    }, 2500);
  };

  const handleAISuggestSkills = () => {
    simulateAI("skills", 1800);
    setTimeout(() => setShowSkillSuggestions(true), 1800);
  };

  const handleAISuggestBenefits = () => {
    simulateAI("benefits", 1800);
    setTimeout(() => setShowBenefitSuggestions(true), 1800);
  };

  const onSubmit = async (data: EditJobForm) => {
    const { data: { session } } = await supabase.auth.getSession();

    const payload = {
      title: data.title,
      description: data.description,
      jobType: data.jobType,
      experienceLevel: data.experienceLevel,
      location: data.location,
      ...toRemoteFlags(data.workArrangement),
      salaryMin: data.salaryMin || undefined,
      salaryMax: data.salaryMax || undefined,
      salaryCurrency: data.currency,
      salaryPeriod: data.payType,
      category: data.department || undefined,
      skills: data.skills.map((s) => s.value),
      benefits: data.benefits.map((b) => b.value),
      applicationDeadline: data.applicationDeadline?.toISOString(),
      // How candidates apply — Quick Apply on-platform, the company's site, or email.
      applicationMethod: data.applicationMethod || 'internal',
      applicationUrl: data.applicationMethod === 'external' ? data.applicationUrl || undefined : undefined,
      applicationEmail: data.applicationMethod === 'email' ? data.applicationEmail || undefined : undefined,
      status: data.status === 'open' ? 'active' : data.status,
      // What the posting states. Left out when the vacancy wasn't answered.
      ...(data.existingVacancy ? { existingVacancy: vacancyForJob(data.existingVacancy) } : {}),
      usesAi: data.usesAi,
    };

    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to post job' }));
      toast.error(err.message || 'Failed to post job');
      return;
    }

    localStorage.removeItem("postjob_draft");
    toast.success("Job posted successfully!", {
      description: `"${data.title}" is now live.`,
    });
    setSubmitted(data);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <JobDetailsSection form={form} logoUrl={logoUrl} onLogoChange={setLogoUrl} />;
      case 1:
        return (
          <JobDescriptionSection
            form={form}
            aiLoading={aiLoading}
            onGenerate={handleAIGenerateDescription}
            onImprove={() => simulateAI("improve", 2000)}
          />
        );
      case 2:
        return (
          <SkillsSection
            form={form}
            fields={skillFields}
            append={appendSkill}
            remove={removeSkill}
            aiLoading={aiLoading}
            onSuggest={handleAISuggestSkills}
            showSuggestions={showSkillSuggestions}
            setShowSuggestions={setShowSkillSuggestions}
          />
        );
      case 3:
        return <SalarySection form={form} />;
      case 4:
        return (
          <BenefitsSection
            fields={benefitFields}
            append={appendBenefit}
            remove={removeBenefit}
            aiLoading={aiLoading}
            onSuggest={handleAISuggestBenefits}
            showSuggestions={showBenefitSuggestions}
            setShowSuggestions={setShowBenefitSuggestions}
          />
        );
      case 5:
        return (
          <div className="space-y-6">
            <ApplicationSettingsSection
              form={form}
              watchedApplicationMethod={watchedValues.applicationMethod}
            />
            <PostingStatementsSection form={form} />
          </div>
        );
      default:
        return null;
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    const sym = ({ USD: "$", EUR: "€", GBP: "£", CAD: "C$" } as Record<string, string>)[submitted.currency] ?? submitted.currency;

    const resetForm = () => {
      setSubmitted(null);
      form.reset(emptyDefaults);
      setStep(0);
      setCompletedSteps(new Set());
      setLogoUrl(null);
      setShowSkillSuggestions(false);
      setShowBenefitSuggestions(false);
      setSaveState("idle");
      setLastSaved(null);
    };

    return (
        <div className="max-w-[560px] mx-auto px-6 py-20">
          <div className="text-center space-y-8">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center ring-8 ring-emerald-50 dark:ring-emerald-900/10">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">{submitted.title}</h1>
              <p className="text-sm text-muted-foreground">Your job posting is now live and accepting applications.</p>
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 divide-y divide-border text-sm text-left">
              {submitted.location && (
                <div className="flex justify-between px-5 py-3">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-right">
                    {submitted.location}
                    {submitted.workArrangement && (
                      <span className="text-muted-foreground font-normal capitalize"> · {submitted.workArrangement}</span>
                    )}
                  </span>
                </div>
              )}
              {submitted.department && (
                <div className="flex justify-between px-5 py-3">
                  <span className="text-muted-foreground">Department</span>
                  <span className="font-medium">{submitted.department}</span>
                </div>
              )}
              {submitted.experienceLevel && (
                <div className="flex justify-between px-5 py-3">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="font-medium capitalize">{submitted.experienceLevel}</span>
                </div>
              )}
              {(submitted.salaryMin > 0 || submitted.salaryMax > 0) && (
                <div className="flex justify-between px-5 py-3">
                  <span className="text-muted-foreground">Salary</span>
                  <span className="font-medium">
                    {submitted.salaryMin > 0 && `${sym}${submitted.salaryMin.toLocaleString()}`}
                    {submitted.salaryMin > 0 && submitted.salaryMax > 0 && " – "}
                    {submitted.salaryMax > 0 && `${sym}${submitted.salaryMax.toLocaleString()}`}
                    {" / "}{submitted.payType === "yearly" ? "yr" : submitted.payType === "monthly" ? "mo" : "hr"}
                  </span>
                </div>
              )}
              {submitted.applicationDeadline && (
                <div className="flex justify-between px-5 py-3">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="font-medium">{format(submitted.applicationDeadline, "PPP")}</span>
                </div>
              )}
              {submitted.skills.length > 0 && (
                <div className="flex justify-between items-start gap-6 px-5 py-3">
                  <span className="text-muted-foreground shrink-0">Skills</span>
                  <span className="font-medium text-right">
                    {submitted.skills.slice(0, 5).map((s) => s.value ?? "").join(", ")}
                    {submitted.skills.length > 5 && (
                      <span className="text-muted-foreground font-normal"> +{submitted.skills.length - 5} more</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link to="/employers/jobs">View All Postings</Link>
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Post Another Job
              </Button>
            </div>
          </div>
        </div>
    );
  }

  return (
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          {/* ── Sticky Header ── */}
          <div className="sticky z-20 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
            <div className="max-w-[1400px] mx-auto px-6 py-3">
              <Breadcrumb className="mb-2">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/employers/dashboard" className="text-xs">Dashboard</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/employers/jobs" className="text-xs">Jobs</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs">Post Job</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h1 className="text-lg font-semibold truncate text-foreground">
                    {watchedValues.title || "New Job Posting"}
                  </h1>
                  <span className="text-xs text-muted-foreground shrink-0">
                    Step {step + 1} of {steps.length}: {steps[step].label}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                    {saveState === "saving" && (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    )}
                    {saveState === "saved" && lastSaved && (
                      <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Saved {format(lastSaved, "h:mm a")}</>
                    )}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={saveDraft}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
                  </Button>

                   <Button type="button" variant="default" size="sm" onClick={() => setPreviewOpen(true)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 space-y-1.5">
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between">
                  {steps.map((s, i) => {
                    const done = completedSteps.has(i) && i !== step;
                    const reachable = i <= step || completedSteps.has(i);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => reachable && setStep(i)}
                        disabled={!reachable}
                        className={cn(
                          "text-[10px] font-medium transition-colors flex items-center gap-0.5",
                          i === step && "text-primary",
                          done && "text-emerald-600 dark:text-emerald-400 cursor-pointer hover:text-emerald-500",
                          !done && i < step && "text-primary/60 cursor-pointer hover:text-primary/80",
                          !reachable && "text-muted-foreground cursor-default",
                        )}
                      >
                        {done && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            <div className="flex gap-6 items-start">
              {/* Left: Current step form */}
              <div className="flex-1 min-w-0 space-y-6">
                {renderStep()}

                {/* Navigation */}
                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(Math.max(0, step - 1))}
                    disabled={step === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Previous
                  </Button>
                  {step < steps.length - 1 ? (
                    <Button
                      variant="default"
                      type="button"
                      onClick={handleNext}
                    >
                      Next <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      type="button"
                      onClick={() => form.handleSubmit(onSubmit)()}
                      disabled={!form.formState.isValid || form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Publishing…</>
                      ) : (
                        <><Send className="h-4 w-4 mr-1.5" /> Publish Job</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Right: Live Preview */}
              <LivePreview
                values={watchedValues as EditJobForm}
                skillFields={skillFields}
                benefitFields={benefitFields}
                previewOpen={previewOpen}
                setPreviewOpen={setPreviewOpen}
                logoUrl={logoUrl}
                companyName={company && company.companyName !== "New Company" ? company.companyName : "Your Company"}
              />
            </div>
          </div>
        </form>
      </Form>
  );
};

export default PostJob;
