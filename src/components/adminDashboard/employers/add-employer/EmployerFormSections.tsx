import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, X, Building2 } from "lucide-react";
import type { EmployerFormData } from "@/data/admin/employer/add-employer";
import { COMPANY_SIZES, INDUSTRIES, TAG_OPTIONS } from "@/data/admin/employer/add-employer";

interface SectionProps {
  data: EmployerFormData;
  onChange: (updates: Partial<EmployerFormData>) => void;
  errors: Record<string, string>;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm text-destructive mt-1">{error}</p>;
}

export function CompanyInformationSection({ data, onChange, errors }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Company Information</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Basic details about the company</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
          <Input id="companyName" placeholder="e.g. TechNova Inc." value={data.companyName} onChange={(e) => onChange({ companyName: e.target.value })} />
          <FieldError error={errors.companyName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyEmail">Company Email <span className="text-destructive">*</span></Label>
          <Input id="companyEmail" type="email" placeholder="contact@company.com" value={data.companyEmail} onChange={(e) => onChange({ companyEmail: e.target.value })} />
          <FieldError error={errors.companyEmail} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="websiteUrl">Website URL</Label>
          <Input id="websiteUrl" placeholder="https://company.com" value={data.websiteUrl} onChange={(e) => onChange({ websiteUrl: e.target.value })} />
          <FieldError error={errors.websiteUrl} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companySize">Company Size</Label>
          <Select value={data.companySize} onValueChange={(v) => onChange({ companySize: v })}>
            <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
            <SelectContent>
              {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Select value={data.industry} onValueChange={(v) => onChange({ industry: v })}>
            <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="foundedYear">Founded Year</Label>
          <Input id="foundedYear" placeholder="e.g. 2019" value={data.foundedYear} onChange={(e) => onChange({ foundedYear: e.target.value })} />
        </div>
      </div>
    </section>
  );
}

export function CompanyProfileSection({ data, onChange }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Company Profile</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Location and description</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="description">Company Description</Label>
          <Textarea id="description" placeholder="Brief description of the company..." rows={4} value={data.description} onChange={(e) => onChange({ description: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" placeholder="Canada" value={data.country} onChange={(e) => onChange({ country: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="province">Province / State</Label>
            <Input id="province" placeholder="Ontario" value={data.province} onChange={(e) => onChange({ province: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" placeholder="Toronto" value={data.city} onChange={(e) => onChange({ city: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Remote Policy</Label>
          <RadioGroup value={data.remotePolicy} onValueChange={(v) => onChange({ remotePolicy: v as EmployerFormData["remotePolicy"] })} className="flex gap-6">
            {[
              { value: "onsite", label: "On-site" },
              { value: "hybrid", label: "Hybrid" },
              { value: "remote", label: "Remote" },
            ].map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`remote-${opt.value}`} />
                <Label htmlFor={`remote-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
    </section>
  );
}

export function BrandingSection({ data, onChange }: Pick<SectionProps, "data" | "onChange">) {
  const handleFile = (
    field: "logoFile" | "coverFile",
    previewField: "logoPreview" | "coverPreview",
    maxMb: number
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      alert(`File must be under ${maxMb}MB`);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("Only PNG, JPG, or WebP files are accepted");
      return;
    }
    const url = URL.createObjectURL(file);
    onChange({ [field]: file, [previewField]: url }); // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  const clearFile = (
    field: "logoFile" | "coverFile",
    previewField: "logoPreview" | "coverPreview"
  ) => {
    if (data[previewField]) URL.revokeObjectURL(data[previewField]);
    onChange({ [field]: null, [previewField]: "" }); // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Branding</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Company logo and cover image</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logo */}
        <div className="space-y-1.5">
          <Label>Company Logo</Label>
          {data.logoPreview ? (
            <div className="relative w-full h-28 rounded-lg border border-border bg-muted/30 overflow-hidden">
              <img src={data.logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
              <button
                type="button"
                onClick={() => clearFile("logoFile", "logoPreview")}
                className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-background/80 border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="text-center">
                <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile("logoFile", "logoPreview", 2)} />
            </label>
          )}
        </div>

        {/* Cover */}
        <div className="space-y-1.5">
          <Label>Cover Image <span className="text-muted-foreground font-normal">(optional)</span></Label>
          {data.coverPreview ? (
            <div className="relative w-full h-28 rounded-lg border border-border bg-muted/30 overflow-hidden">
              <img src={data.coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => clearFile("coverFile", "coverPreview")}
                className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-background/80 border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="text-center">
                <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile("coverFile", "coverPreview", 5)} />
            </label>
          )}
        </div>
      </div>
    </section>
  );
}

export function AccountOwnerSection({ data, onChange, errors }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Employer Account Owner</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Primary contact for this employer</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
          <Input id="firstName" placeholder="John" value={data.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
          <FieldError error={errors.firstName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
          <Input id="lastName" placeholder="Smith" value={data.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
          <FieldError error={errors.lastName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workEmail">Work Email <span className="text-destructive">*</span></Label>
          <Input id="workEmail" type="email" placeholder="john@company.com" value={data.workEmail} onChange={(e) => onChange({ workEmail: e.target.value })} />
          <FieldError error={errors.workEmail} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" placeholder="+1 (555) 000-0000" value={data.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </div>
      </div>
    </section>
  );
}

export function AccountSetupSection({ data, onChange }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Account Setup</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Password and verification settings</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Password</Label>
          <RadioGroup value={data.passwordMode} onValueChange={(v) => onChange({ passwordMode: v as "auto" | "manual" })} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id="pw-auto" />
              <Label htmlFor="pw-auto" className="font-normal cursor-pointer">Auto-generate</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="pw-manual" />
              <Label htmlFor="pw-manual" className="font-normal cursor-pointer">Set manually</Label>
            </div>
          </RadioGroup>
          {data.passwordMode === "manual" && (
            <Input type="password" placeholder="Enter password" className="max-w-xs mt-2" value={data.manualPassword} onChange={(e) => onChange({ manualPassword: e.target.value })} />
          )}
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm">Send invite email</Label>
            <p className="text-xs text-muted-foreground">Send account credentials via email</p>
          </div>
          <Switch checked={data.sendInviteEmail} onCheckedChange={(v) => onChange({ sendInviteEmail: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Email Verification</Label>
            <Select value={data.emailVerification} onValueChange={(v) => onChange({ emailVerification: v as "verified" | "require" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="require">Require verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Account Status</Label>
            <Select value={data.accountStatus} onValueChange={(v) => onChange({ accountStatus: v as "active" | "pending" | "suspended" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>
  );
}

export function JobPostingPermissionsSection({ data, onChange }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Job Posting Permissions</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Control what this employer can do</p>
      </div>

      <div className="space-y-3">
        {[
          { key: "allowJobPosting" as const, label: "Allow job posting", desc: "Employer can create and publish job listings" },
          { key: "requireApproval" as const, label: "Require admin approval", desc: "Jobs must be approved before going live" },
          { key: "featuredEmployer" as const, label: "Featured employer", desc: "Highlight this employer on the platform" },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm">{item.label}</Label>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch checked={data[item.key] as boolean} onCheckedChange={(v) => onChange({ [item.key]: v })} />
          </div>
        ))}

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="maxActiveJobs">Max active job listings</Label>
          <Input id="maxActiveJobs" type="number" min={0} value={data.maxActiveJobs} onChange={(e) => onChange({ maxActiveJobs: parseInt(e.target.value) || 0 })} />
        </div>
      </div>
    </section>
  );
}

export function ComplianceSection({ data, onChange }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Compliance & Verification</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Business registration and trust verification</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="businessRegNumber">Business Registration Number</Label>
            <Input id="businessRegNumber" placeholder="e.g. BN 123456789" value={data.businessRegNumber} onChange={(e) => onChange({ businessRegNumber: e.target.value })} />
            <p className="text-xs text-muted-foreground">CRA Business Number (Canada)</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxId">Tax ID</Label>
            <Input id="taxId" placeholder="Optional" value={data.taxId} onChange={(e) => onChange({ taxId: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm">Verified company</Label>
            <p className="text-xs text-muted-foreground">Mark this company as officially verified</p>
          </div>
          <Switch checked={data.verifiedCompany} onCheckedChange={(v) => onChange({ verifiedCompany: v })} />
        </div>

        <div className="space-y-1.5">
          <Label>Documents</Label>
          <div className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="text-center">
              <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-1">Upload business license, proof of operation (PDF, PNG, JPG)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function InternalNotesSection({ data, onChange }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Internal Notes</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Admin-only notes and tags</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="internalNotes">Notes</Label>
          <Textarea id="internalNotes" placeholder="Add internal notes about this employer..." rows={3} value={data.internalNotes} onChange={(e) => onChange({ internalNotes: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => {
              const isSelected = data.tags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => {
                    const newTags = isSelected
                      ? data.tags.filter((t) => t !== tag)
                      : [...data.tags, tag];
                    onChange({ tags: newTags });
                  }}
                >
                  {tag}
                  {isSelected && <X className="h-3 w-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CompanyPreviewCard({ data }: { data: EmployerFormData }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
      <div className="flex items-center gap-3">
        {data.logoPreview ? (
          <img src={data.logoPreview} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-muted" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.companyName || "Company Name"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {[data.city, data.province, data.country].filter(Boolean).join(", ") || "Location"}
          </p>
        </div>
      </div>
      {data.industry && (
        <Badge variant="secondary" className="text-xs">{data.industry}</Badge>
      )}
    </div>
  );
}
