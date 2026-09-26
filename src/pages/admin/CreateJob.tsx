import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, ChevronsUpDown, Save, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { validateApplicationSettings, ValidationErrors } from "@/data/admin/job/job-validation";
import { toast } from "@/hooks/use-toast";
import { ApplicationSettingsSection } from "@/components/adminDashboard/job/ApplicationSettingsSection";
import { PublishConfirmDialog } from "@/components/adminDashboard/job/PublishConfirmDialog";
import supabase from "@/lib/supabase";
import { WORK_ARRANGEMENTS, toRemoteFlags } from "@/lib/jobs/workArrangement";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const industries = ["Technology", "Finance", "Healthcare", "Marketing", "Logistics", "Design", "Education", "Legal"];
const employmentTypes = ["Full-time", "Part-time", "Contract", "Internship"];
const experienceLevels = ["Entry Level", "Mid Level", "Senior", "Lead", "Executive"];

export default function CreateJob() {
  const navigate = useNavigate();

  // Basic info
  const [title, setTitle] = useState("");
  const [employerMode, setEmployerMode] = useState<"existing" | "manual">("existing");
  const [selectedEmployer, setSelectedEmployer] = useState<{ id: string; name: string } | null>(null);
  const [employerSearchOpen, setEmployerSearchOpen] = useState(false);
  const [employers, setEmployers] = useState<{ id: string; name: string; company: string }[]>([]);
  const [manualCompanyName, setManualCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workplaceType, setWorkplaceType] = useState("");
  const [location, setLocation] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("cad");

  // Description
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [adminBenefits, setAdminBenefits] = useState("");

  // Tags & Visibility
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState("");
  const [featured, setFeatured] = useState(false);
  const [urgent, setUrgent] = useState(false);

  // Sidebar publishing
  const [sidebarStatus, setSidebarStatus] = useState("draft");

  // Company logo
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Application settings
  const [applicationMethod, setApplicationMethod] = useState<"platform" | "external" | "">("");
  const [externalUrl, setExternalUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [appErrors, setAppErrors] = useState<ValidationErrors>({});

  // Publish flow
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/admin/employers/list`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok || cancelled) return;
      const { data } = await res.json();
      if (!cancelled) {
        setEmployers((data ?? []).map((e: { id: string; name: string; company: string }) => ({
          id: e.id,
          name: e.name,
          company: e.company,
        })));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogoFile = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 2MB.", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256);
        setCompanyLogo(canvas.toDataURL("image/png"));
        setLogoUploading(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setLogoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoFile(file);
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const handleMethodChange = (method: "platform" | "external") => {
    setApplicationMethod(method);
    if (method === "platform") setExternalUrl("");
    if (method === "external") setScreeningQuestions([]);
    setAppErrors((prev) => {
      const next = { ...prev };
      delete next.applicationMethod;
      if (method === "platform") delete next.externalUrl;
      return next;
    });
  };

  const buildAppData = useCallback(() => ({
    applicationMethod: applicationMethod as "platform" | "external",
    externalUrl,
    deadline,
    screeningQuestions,
  }), [applicationMethod, externalUrl, deadline, screeningQuestions]);

  const runValidation = useCallback(() => {
    if (!applicationMethod) {
      return { applicationMethod: "Please select an application method." };
    }
    return validateApplicationSettings(buildAppData());
  }, [applicationMethod, buildAppData]);

  const handleBlurField = (field: string) => {
    const errors = runValidation();
    setAppErrors((prev) => {
      const next = { ...prev };
      if (errors[field]) {
        next[field] = errors[field];
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handlePublishClick = () => {
    const errors = runValidation();
    setAppErrors(errors);

    if (Object.keys(errors).length > 0) {
      const section = document.getElementById("application-settings-section");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      toast({
        title: "Validation Failed",
        description: "Please fix the highlighted errors before publishing.",
        variant: "destructive",
      });
      return;
    }

    setShowConfirm(true);
  };

  const postJob = async (jobStatus: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    const splitLines = (text: string) =>
      text.split('\n').map((l) => l.trim()).filter(Boolean);

    const payload = {
      title,
      employerId: employerMode === 'existing' ? (selectedEmployer?.id || undefined) : undefined,
      companyName: employerMode === 'manual' ? (manualCompanyName.trim() || undefined) : undefined,
      companyLogo: employerMode === 'manual' ? (companyLogo || undefined) : undefined,
      description,
      category: industry || undefined,
      employmentType: employmentType || undefined,
      experienceLevel: experienceLevel || undefined,
      location: location || undefined,
      ...toRemoteFlags(workplaceType),
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      salaryMax: salaryMax ? Number(salaryMax) : undefined,
      salaryCurrency: currency.toUpperCase(),
      skills,
      responsibilities: responsibilities ? splitLines(responsibilities) : undefined,
      requirements: requirements ? splitLines(requirements) : undefined,
      benefits: adminBenefits ? splitLines(adminBenefits) : undefined,
      applicationDeadline: deadline || undefined,
      // The admin UI says "platform"; the API calls that route "internal".
      applicationMethod:
        applicationMethod === 'platform' ? 'internal' : applicationMethod || undefined,
      applicationUrl:
        applicationMethod === 'external' ? externalUrl.trim() || undefined : undefined,
      featured,
      urgent,
      status: jobStatus,
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
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    return res.json();
  };

  const handleConfirmPublish = async () => {
    setIsPublishing(true);
    try {
      await postJob('active');
      toast({ title: "Job Published", description: "The job listing has been published successfully." });
      navigate("/jobs");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast({ title: "Publish Failed", description: message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
      setShowConfirm(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await postJob('draft');
      toast({ title: "Draft Saved", description: "The job listing has been saved as a draft." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast({ title: "Save Failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/admin/jobs")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Create Job Listing</h1>
              <p className="text-xs text-muted-foreground">Post a job on behalf of an employer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/jobs")}>Cancel</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button variant="default" size="sm" className="gap-2" onClick={handlePublishClick}>
              <Send className="h-3.5 w-3.5" /> Publish Job
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-8 p-6 lg:p-8">
        {/* Left Column — Form */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Basic Information */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4">Basic Information</h2>
            <div className="space-y-4">
              {/* Job Title + Company Logo row */}
              <div className="flex gap-5">
                {/* Company Logo */}
                <div className="flex flex-col items-center gap-1.5">
                  <Label className="text-sm">Company Logo</Label>
                  <div
                    className={`relative h-[72px] w-[72px] rounded-xl overflow-hidden cursor-pointer transition-all ${
                      logoDragOver
                        ? "border-2 border-dashed border-primary bg-primary/5"
                        : companyLogo
                        ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                        : "border-2 border-dashed border-border hover:border-muted-foreground"
                    }`}
                    onClick={() => logoInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
                    onDragLeave={() => setLogoDragOver(false)}
                    onDrop={handleLogoDrop}
                  >
                    {logoUploading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
                        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                    ) : companyLogo ? (
                      <>
                        <img src={companyLogo} alt="Company logo" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCompanyLogo(null); }}
                          className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Building2 className="h-5 w-5 mb-0.5" />
                        <span className="text-[10px]">Upload</span>
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG · 2MB</span>
                </div>

                {/* Job Title */}
                <div className="flex-1">
                  <Label className="text-sm">Job Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="mt-1.5 h-11 bg-card"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Employer</Label>
                    <div className="flex rounded-md border border-input p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => { setEmployerMode("existing"); setManualCompanyName(""); }}
                        className={`rounded px-2.5 py-1 transition-colors ${employerMode === "existing" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Select existing
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEmployerMode("manual"); setSelectedEmployer(null); }}
                        className={`rounded px-2.5 py-1 transition-colors ${employerMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Enter manually
                      </button>
                    </div>
                  </div>

                  {employerMode === "existing" ? (
                    <Popover open={employerSearchOpen} onOpenChange={setEmployerSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={employerSearchOpen}
                          className="mt-1.5 h-11 w-full justify-between font-normal"
                        >
                          {selectedEmployer ? selectedEmployer.name : "Search employer..."}
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Search employer..." />
                          <CommandList>
                            <CommandEmpty>No employers found.</CommandEmpty>
                            <CommandGroup>
                              {employers.map((employer) => (
                                <CommandItem
                                  key={employer.id}
                                  value={`${employer.name} ${employer.company}`}
                                  onSelect={() => {
                                    setSelectedEmployer({ id: employer.id, name: employer.company || employer.name });
                                    setEmployerSearchOpen(false);
                                  }}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{employer.company || employer.name}</p>
                                    <p className="text-xs text-muted-foreground">{employer.name}</p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input
                      value={manualCompanyName}
                      onChange={(e) => setManualCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      className="mt-1.5 h-11 bg-card"
                    />
                  )}
                </div>
                <div>
                  <Label className="text-sm">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="mt-1.5 h-11 bg-card"><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      {industries.map((i) => <SelectItem key={i} value={i.toLowerCase()}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Employment Type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger className="mt-1.5 h-11 bg-card"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {employmentTypes.map((t) => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Workplace Type</Label>
                  <Select value={workplaceType} onValueChange={setWorkplaceType}>
                    <SelectTrigger className="mt-1.5 h-11 bg-card"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {WORK_ARRANGEMENTS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Toronto, CA"
                    className="mt-1.5 h-11 bg-card"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Salary Min</Label>
                  <Input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="0"
                    className="mt-1.5 h-11 bg-card"
                  />
                </div>
                <div>
                  <Label className="text-sm">Salary Max</Label>
                  <Input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="0"
                    className="mt-1.5 h-11 bg-card"
                  />
                </div>
                <div>
                  <Label className="text-sm">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="mt-1.5 h-11 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cad">CAD ($)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="salary-visible" />
                <Label htmlFor="salary-visible" className="text-sm text-muted-foreground">Show salary on listing</Label>
              </div>
            </div>
          </section>

          <Separator />

          {/* Job Description */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4">Job Description</h2>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a compelling job description..."
              className="min-h-[200px] text-sm leading-relaxed border border-border bg-card"
            />
            <div className="space-y-2">
              <Label>Responsibilities</Label>
              <Textarea
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="List key responsibilities, one per line…"
                className="min-h-[200px] text-sm bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label>Requirements</Label>
              <Textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="List requirements, one per line…"
                className="min-h-[200px] text-sm bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label>Benefits</Label>
              <Textarea
                value={adminBenefits}
                onChange={(e) => setAdminBenefits(e.target.value)}
                placeholder="List benefits, one per line…"
                className="min-h-[200px] text-sm bg-card"
              />
            </div>
          </section>

          <Separator />

          {/* Application Settings */}
          <ApplicationSettingsSection
            applicationMethod={applicationMethod}
            onMethodChange={handleMethodChange}
            externalUrl={externalUrl}
            onExternalUrlChange={setExternalUrl}
            deadline={deadline}
            onDeadlineChange={setDeadline}
            screeningQuestions={screeningQuestions}
            onScreeningQuestionsChange={setScreeningQuestions}
            errors={appErrors}
            onBlurField={handleBlurField}
          />

          <Separator />

          {/* Tags & Visibility */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4">Tags & Visibility</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Skills</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add skill…"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    className="border border-border h-11 bg-card"
                  />
                  <Button variant="default" size="sm" className="h-11" onClick={addSkill}>Add</Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skills.map((s) => (
                      <Badge key={s} variant="default" className="gap-1">
                        {s}
                        <button onClick={() => removeSkill(s)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm">Experience Level</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger className="mt-1.5 h-11 w-full sm:w-64 bg-card"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {experienceLevels.map((l) => <SelectItem key={l} value={l.toLowerCase()}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
                  <Label htmlFor="featured" className="text-sm text-muted-foreground">Featured listing</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="urgent" checked={urgent} onCheckedChange={setUrgent} />
                  <Label htmlFor="urgent" className="text-sm text-muted-foreground">Urgent hiring</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="promoted" />
                  <Label htmlFor="promoted" className="text-sm text-muted-foreground">Promote to top</Label>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column — Admin Controls */}
        <aside className="hidden lg:block w-[300px] shrink-0">
          <div className="sticky top-[85px] space-y-6">
            {/* Publishing */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-4 border border-border">
              <h3 className="text-sm font-semibold text-foreground">Publishing</h3>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={sidebarStatus} onValueChange={setSidebarStatus}>
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Publish Date</Label>
                <Input type="date" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                <Input type="date" className="mt-1 h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="auto-expire" defaultChecked />
                <Label htmlFor="auto-expire" className="text-xs text-muted-foreground">Auto-expire</Label>
              </div>
            </div>

            {/* Moderation Controls */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-4 border border-border">
              <h3 className="text-sm font-semibold text-foreground">Moderation Controls</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="skip-approval" />
                  <Label htmlFor="skip-approval" className="text-xs text-muted-foreground">Skip approval workflow</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="verified" />
                  <Label htmlFor="verified" className="text-xs text-muted-foreground">Mark verified employer</Label>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Internal Notes</Label>
                <Textarea placeholder="Add internal notes..." className="mt-1 text-sm min-h-[80px]" />
              </div>
            </div>

            {/* Preview Card */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Live Preview</h3>
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="h-10 w-10 rounded-lg object-cover ring-1 ring-border" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{title || "Job Title"}</p>
                    <p className="text-xs text-muted-foreground">Company Name</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {location || "Location"} • {employmentType || "Full-time"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {salaryMin || salaryMax
                    ? `${salaryMin ? `$${Number(salaryMin).toLocaleString()}` : ''}${salaryMin && salaryMax ? ' – ' : ''}${salaryMax ? `$${Number(salaryMax).toLocaleString()}` : ''}`
                    : "Salary not specified"}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal */}
      <PublishConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmPublish}
        isPublishing={isPublishing}
      />
    </div>
  );
}
