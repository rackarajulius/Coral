import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, UserPlus } from "lucide-react";
import type { EmployerFormData, AdminControls } from "@/data/admin/employer/add-employer";
import { AccountOwnerSection, AccountSetupSection, BrandingSection, CompanyInformationSection,
   CompanyProfileSection, ComplianceSection, InternalNotesSection, 
   JobPostingPermissionsSection } from "@/components/adminDashboard/employers/add-employer/EmployerFormSections";
import { AdminControlPanel } from "@/components/adminDashboard/employers/add-employer/AdminControlPanel";

const initialFormData: EmployerFormData = {
  companyName: "",
  companyEmail: "",
  websiteUrl: "",
  companySize: "",
  industry: "",
  foundedYear: "",
  description: "",
  country: "",
  province: "",
  city: "",
  remotePolicy: "onsite",
  firstName: "",
  lastName: "",
  workEmail: "",
  phone: "",
  passwordMode: "auto",
  manualPassword: "",
  sendInviteEmail: true,
  emailVerification: "require",
  accountStatus: "pending",
  allowJobPosting: true,
  requireApproval: true,
  maxActiveJobs: 10,
  featuredEmployer: false,
  businessRegNumber: "",
  taxId: "",
  verifiedCompany: false,
  logoFile: null,
  logoPreview: "",
  coverFile: null,
  coverPreview: "",
  internalNotes: "",
  tags: [],
};

const initialAdminControls: AdminControls = {
  markedVerified: false,
  markedPremium: false,
  flaggedFraud: false,
  restrictPosting: false,
  sendWelcomeEmail: true,
  sendOnboardingGuide: false,
  sendPasswordSetupLink: true,
  forcePasswordReset: true,
  restrictLogin: false,
  addInternalAlert: false,
};

function validateForm(data: EmployerFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.companyName.trim()) errors.companyName = "Company name is required";
  if (!data.companyEmail.trim()) errors.companyEmail = "Company email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.companyEmail)) errors.companyEmail = "Invalid email format";
  if (data.websiteUrl && !/^https?:\/\/.+/.test(data.websiteUrl)) errors.websiteUrl = "Must be a valid URL";
  if (!data.firstName.trim()) errors.firstName = "First name is required";
  if (!data.lastName.trim()) errors.lastName = "Last name is required";
  if (!data.workEmail.trim()) errors.workEmail = "Work email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.workEmail)) errors.workEmail = "Invalid email format";
  return errors;
}

export default function AddEmployerPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<EmployerFormData>(initialFormData);
  const [adminControls, setAdminControls] = useState<AdminControls>(initialAdminControls);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = useCallback((updates: Partial<EmployerFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors for changed fields
    const clearedErrors: Record<string, string> = {};
    Object.keys(updates).forEach((key) => {
      clearedErrors[key] = "";
    });
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  const handleControlChange = useCallback((updates: Partial<AdminControls>) => {
    setAdminControls((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSubmitAttempt = () => {
    const validationErrors = validateForm(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      // Scroll to first error
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(firstErrorKey);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmCreate = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    setIsSubmitting(false);
    toast({
      title: "Employer created",
      description: `${formData.companyName} has been successfully created.`,
    });
    navigate("/admin/employers");
  };

  const handleSaveDraft = () => {
    toast({
      title: "Draft saved",
      description: "Employer draft has been saved.",
    });
  };

  const sectionProps = { data: formData, onChange: handleChange, errors };

  const isFormValid = formData.companyName.trim() && formData.companyEmail.trim() && formData.firstName.trim() && formData.lastName.trim() && formData.workEmail.trim();

  return (
    <>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => navigate("/admin/employers")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Add Employer</h1>
              <p className="text-sm text-muted-foreground mt-1">Create a new employer account and company profile</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="secondary" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5" />Save Draft</Button>
            <Button variant="default" onClick={handleSubmitAttempt} disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserPlus className="h-3.5 w-3.5" />}
              Create Employer
            </Button>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left — Form */}
          <div className="flex-1 min-w-0 space-y-8">
            <div className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-8">
              <CompanyInformationSection {...sectionProps} />
              <Separator />
              <CompanyProfileSection {...sectionProps} />
              <Separator />
              <BrandingSection data={formData} onChange={handleChange} />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-8">
              <AccountOwnerSection {...sectionProps} />
              <Separator />
              <AccountSetupSection {...sectionProps} />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-8">
              <JobPostingPermissionsSection {...sectionProps} />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-8">
              <ComplianceSection {...sectionProps} />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-8">
              <InternalNotesSection {...sectionProps} />
            </div>
          </div>

          {/* Right — Admin Controls (sticky) */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-8">
              <AdminControlPanel
                controls={adminControls}
                onControlChange={handleControlChange}
                formData={formData}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Employer Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a company profile for <strong>{formData.companyName}</strong> and allow access to the employer dashboard.
              {formData.accountStatus === "suspended" && (
                <span className="block mt-2 text-destructive font-medium">
                  Note: This account will be created in a suspended state.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreate}>Create Employer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
