import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  Save, Eye, Send, Loader2, CheckCircle2, Users, Calendar,
} from "lucide-react";
import EmployerLayout from  "@/components/employer-dashboard/Layout/EmployerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form } from "@/components/ui/form";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import { editJobSchema, EditJobForm, statusConfig } from "@/data/employer/Jobs/types";
import { useJobsStore, JobStatus } from "@/stores/jobsStore";
import {
  getJobForEdit,
  patchJob,
  UI_TO_BACKEND_STATUS,
  type BackendJobStatus,
  type FullJob,
  type PatchJobPayload,
} from "@/lib/api/employerJobs";
import { toRemoteFlags, toWorkArrangement } from "@/lib/jobs/workArrangement";
import JobDetailsSection from "@/components/employer-dashboard/job-edit/JobDetailsSection";
import JobDescriptionSection from "@/components/employer-dashboard/job-edit/JobDescriptionSection";
import SkillsSection from "@/components/employer-dashboard/job-edit/SkillsSection";
import SalarySection from "@/components/employer-dashboard/job-edit/SalarySection";
import BenefitsSection from "@/components/employer-dashboard/job-edit/BenefitsSection";
import ApplicationSettingsSection from "@/components/employer-dashboard/job-edit/ApplicationSettings";
import LivePreview from "@/components/employer-dashboard/job-edit/LivePreview";

function formatPostedDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return format(date, "MMM d, yyyy");
}

const emptyFormDefaults: EditJobForm = {
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
};

/**
 * Full job → form values.
 *
 * Populates every field the form renders. It previously mapped only five, so
 * the remaining inputs showed blank regardless of what the job actually said,
 * and saving quietly discarded them.
 */
function mapJobToForm(job: FullJob): EditJobForm {
  return {
    ...emptyFormDefaults,
    title: job.title,
    location: job.location ?? "",
    department: job.category ?? "",
    jobType: job.employmentType.toLowerCase().replace(/\s+/g, "-"),
    workArrangement: toWorkArrangement(job),
    experienceLevel: job.experienceLevel ?? "",
    description: job.description ?? "",
    skills: (job.skills ?? []).map((value) => ({ value })),
    salaryMin: job.salaryMin ?? 0,
    salaryMax: job.salaryMax ?? 0,
    currency: job.salaryCurrency || "USD",
    payType: job.salaryPeriod || "yearly",
    benefits: (job.benefits ?? []).map((value) => ({ value })),
    applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline) : undefined,
    applicationMethod: job.applicationMethod || "internal",
    applicationUrl: job.applicationUrl ?? "",
    applicationEmail: job.applicationEmail ?? "",
    status:
      job.status === "draft" ? "draft"
      : job.status === "closed" || job.status === "archived" ? "closed"
      : "open",
  };
}

/** Form values → the patch payload. Mirrors mapJobToForm field for field. */
function formToPatch(data: EditJobForm, status?: BackendJobStatus): PatchJobPayload {
  return {
    title: data.title,
    description: data.description,
    location: data.location,
    category: data.department,
    employmentType: data.jobType,
    experienceLevel: data.experienceLevel || undefined,
    ...toRemoteFlags(data.workArrangement),
    salaryMin: data.salaryMin || undefined,
    salaryMax: data.salaryMax || undefined,
    salaryCurrency: data.currency,
    salaryPeriod: data.payType,
    skills: data.skills.map((s) => s.value),
    benefits: data.benefits.map((b) => b.value),
    applicationDeadline: data.applicationDeadline?.toISOString(),
    applicationMethod: data.applicationMethod,
    applicationUrl: data.applicationUrl || undefined,
    applicationEmail: data.applicationEmail || undefined,
    ...(status ? { status } : {}),
  };
}

const EditJob = () => {
  const { id: jobId } = useParams();
  const { jobs, updateJob, loaded, fetchJobs } = useJobsStore();
  const job = jobs.find((j) => j.id === jobId) ?? null;

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("saved");
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [showBenefitSuggestions, setShowBenefitSuggestions] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const originalValuesRef = useRef<EditJobForm>(emptyFormDefaults);
  const formInitializedRef = useRef(false);

  const form = useForm<EditJobForm>({
    resolver: zodResolver(editJobSchema),
    defaultValues: emptyFormDefaults,
    mode: "onChange",
  });

  useEffect(() => {
    if (!loaded) fetchJobs().catch(() => {});
  }, [loaded, fetchJobs]);

  const [loadError, setLoadError] = useState<string | null>(null);

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

  /**
   * The store's job is a list row — no description, skills, salary or work
   * arrangement — so the form has to load the real thing before it can show
   * what the job actually says. Resetting here also re-baselines the autosave
   * dirty flag, so loading isn't mistaken for the user editing.
   */
  useEffect(() => {
    if (!jobId || formInitializedRef.current) return;
    let cancelled = false;
    getJobForEdit(jobId)
      .then((full) => {
        if (cancelled) return;
        const values = mapJobToForm(full);
        originalValuesRef.current = values;
        form.reset(values);
        formInitializedRef.current = true;
        dirtyRef.current = false;
        setUnsaved(false);
      })
      .catch((e) => {
        if (!cancelled) setLoadError((e as Error).message || "Couldn't load this job");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, form]);

  const saveToStore = useCallback((showToast = false) => {
    if (!job) return;
    setSaveState("saving");
    const values = form.getValues();
    const title = values.title || "Job";
    const storeType = values.jobType.charAt(0).toUpperCase() + values.jobType.slice(1);
    const storeStatus: JobStatus =
      values.status === "open" ? "Open" : values.status === "draft" ? "Draft" : "Closed";
    const statusChanged = storeStatus !== job.status;

    patchJob(job.id, formToPatch(values, statusChanged ? UI_TO_BACKEND_STATUS[storeStatus] : undefined))
      .then(() => {
        updateJob(job.id, {
          title: values.title,
          location: values.location,
          department: values.department,
          type: storeType,
          status: storeStatus,
        });
        setUnsaved(false);
        setSaveState("saved");
        setLastSaved(new Date());
        dirtyRef.current = false;
        if (showToast) toast.success(`"${title}" saved.`);
      })
      .catch((e) => {
        setSaveState("idle");
        toast.error((e as Error).message);
      });
  }, [form, job, updateJob]);

  // Auto-save to store every 3 s of inactivity
  useEffect(() => {
    const sub = form.watch(() => {
      dirtyRef.current = true;
      setUnsaved(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (dirtyRef.current) saveToStore();
      }, 3000);
    });
    return () => sub.unsubscribe();
  }, [form, saveToStore]);

  // Warn before page unload if changes are unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  const simulateAI = useCallback(
    (key: string, duration = 2000) => {
      setAiLoading(key);
      setTimeout(() => setAiLoading(null), duration);
    },
    []
  );

  const handleAIGenerateDescription = () => {
    simulateAI("description", 2500);
    setTimeout(() => {
      form.setValue(
        "description",
        `About the Role\nWe're seeking an exceptional Senior Frontend Engineer to drive the evolution of our user-facing products. In this role, you'll architect and build high-performance web applications that serve millions of users worldwide.\n\nWhat You'll Do\n• Design and implement complex frontend architectures using React and TypeScript\n• Champion code quality through testing, code reviews, and best practices\n• Collaborate with cross-functional teams to define product requirements\n• Optimize application performance and improve Core Web Vitals\n• Contribute to our open-source design system\n\nWhat We're Looking For\n• 5+ years of professional frontend development experience\n• Deep expertise in React, TypeScript, and modern CSS\n• Track record of building and shipping production applications\n• Strong understanding of web accessibility (WCAG 2.1)\n• Experience with state management solutions (Redux, Zustand, Jotai)\n• Familiarity with CI/CD pipelines and testing frameworks`,
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
    if (!job) return;
    const isPublishing = job.status === "Draft";
    const storeType = data.jobType.charAt(0).toUpperCase() + data.jobType.slice(1);
    const storeStatus: JobStatus = isPublishing
      ? "Open"
      : data.status === "open" ? "Open" : data.status === "draft" ? "Draft" : "Closed";
    const statusChanged = storeStatus !== job.status;

    try {
      await patchJob(
        job.id,
        formToPatch(data, statusChanged ? UI_TO_BACKEND_STATUS[storeStatus] : undefined),
      );
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    updateJob(job.id, {
      title: data.title,
      location: data.location,
      department: data.department,
      type: storeType,
      status: storeStatus,
    });

    setSaveState("saved");
    setLastSaved(new Date());
    toast.success(
      isPublishing ? `"${data.title}" is now live.` : `"${data.title}" saved.`,
      isPublishing ? { description: "Your job posting is now accepting applications." } : undefined,
    );
  };

  if (!loaded && !job) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
        <div className="max-w-[1400px] mx-auto px-6 py-20 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Job not found</p>
          <p className="text-sm text-muted-foreground">
            No job with ID {jobId} exists in this account.
          </p>
          <Link to="/employers/jobs" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to Jobs
          </Link>
        </div>
    );
  }

  // A failed load would otherwise leave every field blank with no explanation,
  // and saving would then overwrite the real job with those blanks.
  if (loadError) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-20 text-center space-y-3">
        <p className="text-lg font-semibold text-foreground">Couldn't load this job</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Link to="/employers/jobs" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to Jobs
        </Link>
      </div>
    );
  }

  return (
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          {/* ── Sticky Header ── */}
          <div className="sticky z-20 bg-background/80 backdrop-blur-xl border-b border-border">
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
                    <BreadcrumbPage className="text-xs">Edit Job</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isEditingTitle ? (
                    <div className="flex-1 max-w-md">
                      <Input
                        {...form.register("title")}
                        className="text-lg font-semibold h-9"
                        autoFocus
                        onBlur={() => {
                          if (form.getValues("title").length >= 3) {
                            setTitleError(null);
                            setIsEditingTitle(false);
                          } else {
                            setTitleError("Title must be at least 3 characters");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (form.getValues("title").length >= 3) {
                              setTitleError(null);
                              setIsEditingTitle(false);
                            } else {
                              setTitleError("Title must be at least 3 characters");
                            }
                          }
                        }}
                      />
                      {titleError && (
                        <p className="text-xs text-destructive mt-0.5">{titleError}</p>
                      )}
                    </div>
                  ) : (
                    <h1
                      className="text-lg font-semibold truncate cursor-pointer hover:text-primary/80 transition-colors"
                      onClick={() => setIsEditingTitle(true)}
                      title="Click to edit"
                    >
                      {watchedValues.title || "Untitled Job"}
                    </h1>
                  )}
                  <Badge className={cn("text-xs shrink-0", statusConfig[watchedValues.status].className)} variant="secondary">
                    {statusConfig[watchedValues.status].label}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                    {unsaved && saveState !== "saving" && (
                      <><span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" /> Unsaved</>
                    )}
                    {saveState === "saving" && (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    )}
                    {!unsaved && saveState === "saved" && (
                      <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Saved {format(lastSaved, "h:mm a")}</>
                    )}
                  </span>

                  <Separator orientation="vertical" className="h-6 hidden sm:block" />

                  {unsaved && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => { form.reset(originalValuesRef.current); setUnsaved(false); setTitleError(null); }}
                    >
                      Discard
                    </Button>
                  )}

                  <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!unsaved || saveState === "saving"}
                    onClick={() => saveToStore(true)}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {job.status === "Draft" ? "Save Draft" : "Save"}
                  </Button>
                  <Button
                    variant="default"
                    type="button"
                    size="sm"
                    className="gradient-accent"
                    disabled={
                      form.formState.isSubmitting ||
                      saveState === "saving" ||
                      (job.status === "Draft" ? !form.formState.isValid : !unsaved)
                    }
                    onClick={() => {
                      if (job.status === "Draft") {
                        form.handleSubmit(onSubmit)();
                      } else {
                        saveToStore(true);
                      }
                    }}
                  >
                    {form.formState.isSubmitting || (saveState === "saving" && job.status !== "Draft") ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
                    ) : job.status === "Draft" ? (
                      <><Send className="h-3.5 w-3.5 mr-1.5" /> Publish</>
                    ) : (
                      <><Save className="h-3.5 w-3.5 mr-1.5" /> Save Changes</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Job metadata */}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                {job.applicants > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {job.applicants} applicant{job.applicants !== 1 ? "s" : ""}
                  </span>
                )}
                {job.posted && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Posted {formatPostedDate(job.posted)}
                  </span>
                )}
                {job.recruiter && <span>{job.recruiter}</span>}
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            <div className="flex gap-6 items-start">
              {/* ── Left: Form ── */}
              <div className="flex-1 min-w-0 space-y-6">
                <JobDetailsSection form={form} logoUrl={logoUrl} onLogoChange={setLogoUrl} />
                <JobDescriptionSection
                  form={form}
                  aiLoading={aiLoading}
                  onGenerate={handleAIGenerateDescription}
                  onImprove={() => simulateAI("improve", 2000)}
                />
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
                <SalarySection form={form} />
                <BenefitsSection
                  fields={benefitFields}
                  append={appendBenefit}
                  remove={removeBenefit}
                  aiLoading={aiLoading}
                  onSuggest={handleAISuggestBenefits}
                  showSuggestions={showBenefitSuggestions}
                  setShowSuggestions={setShowBenefitSuggestions}
                />
                <ApplicationSettingsSection
                  form={form}
                  watchedApplicationMethod={watchedValues.applicationMethod}
                />
              </div>

              {/* ── Right: Live Preview ── */}
              <LivePreview
                values={watchedValues as EditJobForm}
                skillFields={skillFields}
                benefitFields={benefitFields}
                previewOpen={previewOpen}
                setPreviewOpen={setPreviewOpen}
                logoUrl={logoUrl}
                companyName="Your Company"
              />
            </div>
          </div>
        </form>
      </Form>
  );
};

export default EditJob;
