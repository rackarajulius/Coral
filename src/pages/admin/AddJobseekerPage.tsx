import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, UserPlus, X, Upload, Eye, EyeOff, RefreshCw, Loader2, User, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";


const DRAFT_KEY = "addJobSeeker_draft";

const experienceLevels = ["Entry", "Mid", "Senior", "Lead", "Executive"];
const industries = ["Technology", "Finance", "Healthcare", "Marketing", "Design", "Education", "Legal", "Logistics"];
const educationLevels = ["High School", "Associate", "Bachelor's", "Master's", "Ph.D.", "Other"];
const employmentTypes = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"];
const countries = ["United States", "Canada", "United Kingdom", "Germany", "Australia", "India", "Other"];

const suggestedSkills = [
  "React", "TypeScript", "JavaScript", "Python", "Node.js", "SQL", "AWS", "Docker",
  "Figma", "UI Design", "Product Management", "Data Analysis", "Machine Learning",
  "Go", "Kubernetes", "PostgreSQL", "GraphQL", "Tailwind CSS",
];

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  resume?: string;
  avatar?: string;
}

interface DraftState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  autoGeneratePassword: boolean;
  password: string;
  sendInviteEmail: boolean;
  emailVerification: "verified" | "require";
  accountStatus: "Active" | "Suspended" | "Pending";
  headline: string;
  yearsExperience: string;
  experienceLevel: string;
  industry: string;
  skills: string[];
  education: string;
  desiredTitle: string;
  preferredLocations: string;
  selectedEmploymentTypes: string[];
  salaryRange: [number, number];
  salaryCurrency: string;
  remotePreference: boolean;
  prefillApplications: string;
  prefillSavedJobs: string;
  adminNotes: string;
  isPremium: boolean;
  isVerifiedCandidate: boolean;
  isFlagged: boolean;
  sendWelcomeEmail: boolean;
  sendPasswordLink: boolean;
  forcePasswordReset: boolean;
  restrictLogin: boolean;
  internalNote: string;
  avatarDataUrl: string | null;
}

function loadDraft(): Partial<DraftState> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function AddJobSeeker() {
  const navigate = useNavigate();
  const draft = useRef(loadDraft()).current;

  // Section 1 — Basic Info
  const [firstName, setFirstName] = useState(draft?.firstName ?? "");
  const [lastName, setLastName] = useState(draft?.lastName ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [country, setCountry] = useState(draft?.country ?? "");
  const [province, setProvince] = useState(draft?.province ?? "");
  const [city, setCity] = useState(draft?.city ?? "");

  // Avatar
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(draft?.avatarDataUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Section 2 — Account Setup
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(draft?.autoGeneratePassword ?? true);
  const [password, setPassword] = useState(draft?.password ?? generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [sendInviteEmail, setSendInviteEmail] = useState(draft?.sendInviteEmail ?? true);
  const [emailVerification, setEmailVerification] = useState<"verified" | "require">(draft?.emailVerification ?? "require");
  const [accountStatus, setAccountStatus] = useState<"Active" | "Suspended" | "Pending">(draft?.accountStatus ?? "Active");

  // Section 3 — Profile
  const [headline, setHeadline] = useState(draft?.headline ?? "");
  const [yearsExperience, setYearsExperience] = useState(draft?.yearsExperience ?? "");
  const [experienceLevel, setExperienceLevel] = useState(draft?.experienceLevel ?? "");
  const [industry, setIndustry] = useState(draft?.industry ?? "");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>(draft?.skills ?? []);
  const [education, setEducation] = useState(draft?.education ?? "");

  // Section 4 — Resume
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const resumeRef = useRef<HTMLInputElement>(null);

  // Section 5 — Job Preferences
  const [desiredTitle, setDesiredTitle] = useState(draft?.desiredTitle ?? "");
  const [preferredLocations, setPreferredLocations] = useState(draft?.preferredLocations ?? "");
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>(draft?.selectedEmploymentTypes ?? []);
  const [salaryRange, setSalaryRange] = useState<[number, number]>(draft?.salaryRange ?? [40000, 120000]);
  const [salaryCurrency, setSalaryCurrency] = useState(draft?.salaryCurrency ?? "usd");
  const [remotePreference, setRemotePreference] = useState(draft?.remotePreference ?? false);

  // Section 6 — Activity Init
  const [prefillApplications, setPrefillApplications] = useState(draft?.prefillApplications ?? "");
  const [prefillSavedJobs, setPrefillSavedJobs] = useState(draft?.prefillSavedJobs ?? "");
  const [adminNotes, setAdminNotes] = useState(draft?.adminNotes ?? "");

  // Right Panel — Admin Controls
  const [isPremium, setIsPremium] = useState(draft?.isPremium ?? false);
  const [isVerifiedCandidate, setIsVerifiedCandidate] = useState(draft?.isVerifiedCandidate ?? false);
  const [isFlagged, setIsFlagged] = useState(draft?.isFlagged ?? false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(draft?.sendWelcomeEmail ?? true);
  const [sendPasswordLink, setSendPasswordLink] = useState(draft?.sendPasswordLink ?? false);
  const [forcePasswordReset, setForcePasswordReset] = useState(draft?.forcePasswordReset ?? false);
  const [restrictLogin, setRestrictLogin] = useState(draft?.restrictLogin ?? false);
  const [internalNote, setInternalNote] = useState(draft?.internalNote ?? "");

  // UI State
  const [errors, setErrors] = useState<FormErrors>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Autosave ───
  const saveDraft = useCallback(() => {
    const state: DraftState = {
      firstName, lastName, email, phone, country, province, city,
      autoGeneratePassword, password, sendInviteEmail, emailVerification, accountStatus,
      headline, yearsExperience, experienceLevel, industry, skills, education,
      desiredTitle, preferredLocations, selectedEmploymentTypes, salaryRange, salaryCurrency, remotePreference,
      prefillApplications, prefillSavedJobs, adminNotes,
      isPremium, isVerifiedCandidate, isFlagged,
      sendWelcomeEmail, sendPasswordLink, forcePasswordReset, restrictLogin, internalNote,
      avatarDataUrl,
    } as unknown as DraftState;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  }, [
    firstName, lastName, email, phone, country, province, city,
    autoGeneratePassword, password, sendInviteEmail, emailVerification, accountStatus,
    headline, yearsExperience, experienceLevel, industry, skills, education,
    desiredTitle, preferredLocations, selectedEmploymentTypes, salaryRange, salaryCurrency, remotePreference,
    prefillApplications, prefillSavedJobs, adminNotes,
    isPremium, isVerifiedCandidate, isFlagged,
    sendWelcomeEmail, sendPasswordLink, forcePasswordReset, restrictLogin, internalNote,
    avatarDataUrl,
  ]);

  useEffect(() => {
    const timer = setTimeout(saveDraft, 800);
    return () => clearTimeout(timer);
  }, [saveDraft]);

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  // ─── Avatar upload ───
  const processAvatarFile = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((p) => ({ ...p, avatar: "Only JPG, PNG, or WebP files accepted" }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((p) => ({ ...p, avatar: "File must be under 2MB" }));
      return;
    }
    setErrors((p) => { const { avatar, ...rest } = p; return rest; });
    setAvatarUploading(true);
    setAvatarProgress(0);

    // Simulate upload progress + auto-square-crop via canvas
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Square crop from center
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(
          img,
          (img.width - size) / 2, (img.height - size) / 2, size, size,
          0, 0, 256, 256
        );

        // Simulate upload progress
        let p = 0;
        const interval = setInterval(() => {
          p += Math.random() * 30 + 10;
          if (p >= 100) {
            p = 100;
            clearInterval(interval);
            setAvatarDataUrl(canvas.toDataURL("image/jpeg", 0.9));
            setAvatarUploading(false);
            setAvatarProgress(100);
          } else {
            setAvatarProgress(Math.round(p));
          }
        }, 150);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processAvatarFile(file);
  };

  // Skills
  const addSkill = (skill?: string) => {
    const s = (skill || skillInput).trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      if (!skill) setSkillInput("");
    }
  };
  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const filteredSuggestions = skillInput.length >= 1
    ? suggestedSkills.filter(
        (s) => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s)
      ).slice(0, 5)
    : [];

  const toggleEmploymentType = (type: string) => {
    setSelectedEmploymentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Validation
  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!firstName || firstName.length < 2) e.firstName = "First name must be at least 2 characters";
    if (!lastName || lastName.length < 2) e.lastName = "Last name must be at least 2 characters";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address";
    if (!autoGeneratePassword && password.length < 8) e.password = "Password must be at least 8 characters";
    if (resumeFile) {
      const ext = resumeFile.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "doc", "docx"].includes(ext || "")) e.resume = "Only PDF and DOC files accepted";
    }
    return e;
  };

  const handleBlur = (field: keyof FormErrors) => {
    const allErrors = validate();
    setErrors((prev) => {
      const next = { ...prev };
      if (allErrors[field]) next[field] = allErrors[field];
      else delete next[field];
      return next;
    });
  };

  const handleSubmitClick = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const firstError = document.querySelector("[data-error='true']");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast({ title: "Validation Failed", description: "Please fix the highlighted errors.", variant: "destructive" });
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmCreate = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSubmitting(false);
    setShowConfirm(false);
    clearDraft();
    toast({ title: "Account Created", description: `${firstName} ${lastName}'s account has been created successfully.` });
    navigate("/admin/jobseekers");
  };

  const handleSaveDraft = () => {
    saveDraft();
    toast({ title: "Draft Saved", description: "Jobseeker draft has been saved." });
  };

  const isFormValid = firstName.length >= 2 && lastName.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase();

  return (
    <>
    <div className="max-w-[1400px] mx-auto bg-card">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/admin/jobseekers")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Add Jobseeker</h1>
              <p className="text-xs text-muted-foreground">Create a new jobseeker account manually</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/jobseekers")}>Cancel</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button variant="default" size="sm" className="gap-2" disabled={!isFormValid || isSubmitting} onClick={handleSubmitClick}>
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Create Account
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 p-6 lg:p-8">
        {/* Left Column — Form */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Section 1 — Basic Information */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-1">Basic Information</h2>
            <p className="text-xs text-muted-foreground mb-4">Personal details for the jobseeker account</p>
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div
                  className={`relative w-20 h-20 rounded-[18px] overflow-hidden cursor-pointer transition-all group ${
                    avatarDragOver
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary"
                      : avatarDataUrl
                        ? "ring-2 ring-ring/20 ring-offset-2 ring-offset-background"
                        : "border-2 border-dashed border-border hover:border-muted-foreground/50"
                  }`}
                  onClick={() => !avatarUploading && avatarRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setAvatarDragOver(true); }}
                  onDragLeave={() => setAvatarDragOver(false)}
                  onDrop={handleAvatarDrop}
                >
                  {avatarUploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-12 h-12" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                          <circle
                            cx="24" cy="24" r="20" fill="none"
                            stroke="hsl(var(--primary))" strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${(avatarProgress / 100) * 125.6} 125.6`}
                            transform="rotate(-90 24 24)"
                            className="transition-all duration-200"
                          />
                        </svg>
                        <span className="absolute text-[10px] font-medium text-foreground">{avatarProgress}%</span>
                      </div>
                    </div>
                  ) : avatarDataUrl ? (
                    <>
                      <img src={avatarDataUrl} alt="Profile" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => { e.stopPropagation(); setAvatarDataUrl(null); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                      {initials ? (
                        <span className="text-lg font-semibold text-muted-foreground">{initials}</span>
                      ) : (
                        <User className="h-7 w-7 text-muted-foreground/60" />
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 gap-1 text-muted-foreground"
                  onClick={() => avatarRef.current?.click()}
                  disabled={avatarUploading}
                >
                  <Camera className="h-3 w-3" />
                  {avatarDataUrl ? "Change" : "Upload"}
                </Button>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processAvatarFile(file);
                    e.target.value = "";
                  }}
                />
                {errors.avatar && <p className="text-[10px] text-destructive text-center max-w-[100px]">{errors.avatar}</p>}
              </div>

              {/* Name / Email / Phone fields */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div data-error={!!errors.firstName || undefined}>
                    <Label className="text-sm">First Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onBlur={() => handleBlur("firstName")}
                      placeholder="e.g. Sarah"
                      className="mt-1.5 h-11"
                    />
                    {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
                  </div>
                  <div data-error={!!errors.lastName || undefined}>
                    <Label className="text-sm">Last Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onBlur={() => handleBlur("lastName")}
                      placeholder="e.g. Thompson"
                      className="mt-1.5 h-11"
                    />
                    {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
                  </div>
                </div>
                <div data-error={!!errors.email || undefined}>
                  <Label className="text-sm">Email Address <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur("email")}
                    placeholder="e.g. sarah.thompson@email.com"
                    className="mt-1.5 h-11"
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label className="text-sm">Phone Number</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (416) 555-0123"
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>
            </div>
            {/* Location row below the avatar+fields row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <Label className="text-sm">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Province / State</Label>
                <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="e.g. Ontario" className="mt-1.5 h-11" />
              </div>
              <div>
                <Label className="text-sm">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Toronto" className="mt-1.5 h-11" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 2 — Account Setup */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-1">Account Setup</h2>
            <p className="text-xs text-muted-foreground mb-4">Authentication and account status configuration</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch id="auto-gen" checked={autoGeneratePassword} onCheckedChange={(v) => { setAutoGeneratePassword(v); if (v) setPassword(generatePassword()); }} />
                <Label htmlFor="auto-gen" className="text-sm text-muted-foreground">Auto-generate password</Label>
              </div>
              <div data-error={!!errors.password || undefined}>
                <Label className="text-sm">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur("password")}
                    disabled={autoGeneratePassword}
                    className="h-11 pr-20"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    {autoGeneratePassword && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPassword(generatePassword())}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Switch id="send-invite" checked={sendInviteEmail} onCheckedChange={setSendInviteEmail} />
                <Label htmlFor="send-invite" className="text-sm text-muted-foreground">Send invite email</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Email Verification</Label>
                  <Select value={emailVerification} onValueChange={(v: "verified" | "require") => setEmailVerification(v)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="require">Require verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Account Status</Label>
                  <Select value={accountStatus} onValueChange={(v: "Active" | "Suspended" | "Pending") => setAccountStatus(v)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 3 — Profile Information */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-1">Profile Information</h2>
            <p className="text-xs text-muted-foreground mb-4">Professional details and skill set</p>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Headline</Label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Frontend Developer" className="mt-1.5 h-11" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Years of Experience</Label>
                  <Input type="number" min="0" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="0" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label className="text-sm">Experience Level</Label>
                  <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      {experienceLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm">Skills</Label>
                <div className="relative">
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      placeholder="Type to search skills…"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                      className="h-11"
                    />
                    <Button variant="outline" size="sm" className="h-11" onClick={() => addSkill()}>Add</Button>
                  </div>
                  {filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-16 mt-1 bg-popover border border-border rounded-md shadow-elevated p-1">
                      {filteredSuggestions.map((s) => (
                        <button
                          key={s}
                          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-secondary transition-colors"
                          onClick={() => { addSkill(s); setSkillInput(""); }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skills.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-1">
                        {s}
                        <button onClick={() => removeSkill(s)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm">Education Level</Label>
                <Select value={education} onValueChange={setEducation}>
                  <SelectTrigger className="mt-1.5 h-11 w-full sm:w-64"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {educationLevels.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 4 — Resume & Documents */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-1">Resume & Documents</h2>
            <p className="text-xs text-muted-foreground mb-4">Upload candidate files (PDF or DOC)</p>
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-muted-foreground/40 transition-colors cursor-pointer"
                onClick={() => resumeRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {resumeFile ? resumeFile.name : "Click or drag to upload resume"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX — Max 10MB</p>
                <input
                  ref={resumeRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setResumeFile(file);
                  }}
                />
              </div>
              {resumeFile && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{resumeFile.name.split(".").pop()?.toUpperCase()}</Badge>
                    <span className="text-sm text-foreground truncate max-w-[200px]">{resumeFile.name}</span>
                    <span className="text-xs text-muted-foreground">{(resumeFile.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setResumeFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {errors.resume && <p className="text-xs text-destructive">{errors.resume}</p>}
            </div>
          </section>

          <Separator />

          {/* Section 5 — Job Preferences */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-1">Job Preferences</h2>
            <p className="text-xs text-muted-foreground mb-4">Desired job criteria and preferences</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Desired Job Title</Label>
                  <Input value={desiredTitle} onChange={(e) => setDesiredTitle(e.target.value)} placeholder="e.g. Frontend Engineer" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label className="text-sm">Preferred Location(s)</Label>
                  <Input value={preferredLocations} onChange={(e) => setPreferredLocations(e.target.value)} placeholder="e.g. Toronto, Vancouver" className="mt-1.5 h-11" />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Employment Type</Label>
                <div className="flex flex-wrap gap-2">
                  {employmentTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleEmploymentType(type)}
                      className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                        selectedEmploymentTypes.includes(type)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Salary Expectation</Label>
                <div className="mt-3 px-1">
                  <Slider
                    value={salaryRange}
                    onValueChange={(v) => setSalaryRange(v as [number, number])}
                    min={0}
                    max={300000}
                    step={5000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">${salaryRange[0].toLocaleString()}</span>
                    <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                      <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="cad">CAD ($)</SelectItem>
                        <SelectItem value="gbp">GBP (£)</SelectItem>
                        <SelectItem value="eur">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">${salaryRange[1].toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="remote-pref" checked={remotePreference} onCheckedChange={setRemotePreference} />
                <Label htmlFor="remote-pref" className="text-sm text-muted-foreground">Open to remote work</Label>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 6 — Activity Initialization */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-1">Activity Initialization</h2>
            <p className="text-xs text-muted-foreground mb-4">Optional pre-fill for testing or migration</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Pre-fill Applications Count</Label>
                  <Input type="number" min="0" value={prefillApplications} onChange={(e) => setPrefillApplications(e.target.value)} placeholder="0" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label className="text-sm">Pre-fill Saved Jobs Count</Label>
                  <Input type="number" min="0" value={prefillSavedJobs} onChange={(e) => setPrefillSavedJobs(e.target.value)} placeholder="0" className="mt-1.5 h-11" />
                </div>
              </div>
              <div>
                <Label className="text-sm">Admin Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this account…"
                  className="mt-1.5 min-h-[80px] text-sm"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column — Admin Control Panel */}
        <aside className="w-full lg:w-[300px] shrink-0">
          <div className="lg:sticky lg:top-[85px] space-y-6">
            {/* Account Controls */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Account Controls</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="premium" checked={isPremium} onCheckedChange={setIsPremium} />
                  <Label htmlFor="premium" className="text-xs text-muted-foreground">Mark as premium user</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="verified-candidate" checked={isVerifiedCandidate} onCheckedChange={setIsVerifiedCandidate} />
                  <Label htmlFor="verified-candidate" className="text-xs text-muted-foreground">Mark as verified candidate</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="flagged" checked={isFlagged} onCheckedChange={setIsFlagged} />
                  <Label htmlFor="flagged" className="text-xs text-muted-foreground">Flag account (internal)</Label>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="welcome-email" checked={sendWelcomeEmail} onCheckedChange={setSendWelcomeEmail} />
                  <Label htmlFor="welcome-email" className="text-xs text-muted-foreground">Send welcome email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="password-link" checked={sendPasswordLink} onCheckedChange={setSendPasswordLink} />
                  <Label htmlFor="password-link" className="text-xs text-muted-foreground">Send password setup link</Label>
                </div>
              </div>
            </div>

            {/* Security Controls */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Security</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="force-reset" checked={forcePasswordReset} onCheckedChange={setForcePasswordReset} />
                  <Label htmlFor="force-reset" className="text-xs text-muted-foreground">Force password reset on login</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="restrict-login" checked={restrictLogin} onCheckedChange={setRestrictLogin} />
                  <Label htmlFor="restrict-login" className="text-xs text-muted-foreground">Restrict login</Label>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Internal Note</Label>
                <Textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Add internal note…"
                  className="mt-1 text-sm min-h-[80px]"
                />
              </div>
            </div>

            {/* Preview Card */}
            <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Preview</h3>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : initials ? (
                      <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Full Name"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[city, province, country].filter(Boolean).join(", ") || "Location"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{headline || "Headline"}</p>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {skills.slice(0, 4).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                    ))}
                    {skills.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{skills.length - 4} more</span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      accountStatus === "Active" ? "border-[hsl(var(--status-active))] text-[hsl(var(--status-active))]" :
                      accountStatus === "Pending" ? "border-[hsl(var(--status-pending))] text-[hsl(var(--status-pending))]" :
                      "border-[hsl(var(--status-rejected))] text-[hsl(var(--status-rejected))]"
                    }`}
                  >
                    {accountStatus}
                  </Badge>
                  {isPremium && <Badge className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0">Premium</Badge>}
                  {isVerifiedCandidate && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Verified</Badge>}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Jobseeker Account</AlertDialogTitle>
            <AlertDialogDescription>
              This account will be created for <strong>{firstName} {lastName}</strong> ({email}).
              {sendInviteEmail && " An invite email will be sent."}
              {sendWelcomeEmail && " A welcome email will be sent."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
