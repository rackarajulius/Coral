import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Globe, Mail, Phone, Linkedin, Twitter, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEmployerCompanyStore } from "@/stores/employerCompanyStore";
import {
  updateMyCompany,
  uploadCompanyLogo,
  type CompanySocialLink,
  type EmployerCompany,
} from "@/lib/api/employerCompany";
import { SectionCard, Field } from "./shared";

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Retail", "Education", "Manufacturing"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

/** Finds a social link by platform, tolerating however it was labelled. */
function findSocial(links: CompanySocialLink[], platform: string): CompanySocialLink | undefined {
  return links.find((l) => (l.label ?? "").toLowerCase().includes(platform));
}

type FormState = {
  companyName: string;
  industry: string;
  companySize: string;
  headquarters: string;
  companyWebsite: string;
  supportEmail: string;
  supportPhone: string;
  linkedin: string;
  twitter: string;
  companyDescription: string;
};

const toForm = (c: EmployerCompany): FormState => ({
  companyName: c.companyName ?? "",
  industry: c.industry ?? "",
  companySize: c.companySize ?? "",
  headquarters: c.headquarters ?? "",
  companyWebsite: c.companyWebsite ?? "",
  supportEmail: c.supportEmail ?? "",
  supportPhone: c.supportPhone ?? "",
  linkedin: findSocial(c.socialLinks ?? [], "linkedin")?.url ?? "",
  twitter: findSocial(c.socialLinks ?? [], "twitter")?.url ?? "",
  companyDescription: c.companyDescription ?? "",
});

export default function General() {
  const queryClient = useQueryClient();
  const { company, loaded, fetchCompany, setCompany } = useEmployerCompanyStore();
  const [form, setForm] = useState<FormState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompany().catch(() => toast.error("Couldn't load your company details"));
  }, [fetchCompany]);

  // Seeded once from the server; typing must not be clobbered by a refetch.
  useEffect(() => {
    setForm((f) => (f === null && company ? toForm(company) : f));
  }, [company]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("Nothing to save");

      // Social links live in one flexible list, so rebuild it rather than
      // overwrite — anything the company profile editor added stays put.
      const existing = company?.socialLinks ?? [];
      const others = existing.filter(
        (l) =>
          !["linkedin", "twitter"].some((p) => (l.label ?? "").toLowerCase().includes(p)),
      );
      const socialLinks: CompanySocialLink[] = [...others];
      if (form.linkedin.trim()) {
        socialLinks.push({
          id: findSocial(existing, "linkedin")?.id ?? crypto.randomUUID(),
          label: "LinkedIn",
          url: form.linkedin.trim(),
        });
      }
      if (form.twitter.trim()) {
        socialLinks.push({
          id: findSocial(existing, "twitter")?.id ?? crypto.randomUUID(),
          label: "Twitter",
          url: form.twitter.trim(),
        });
      }

      return updateMyCompany({
        companyName: form.companyName.trim(),
        industry: form.industry || undefined,
        companySize: form.companySize || undefined,
        headquarters: form.headquarters.trim() || undefined,
        companyWebsite: form.companyWebsite.trim() || undefined,
        supportEmail: form.supportEmail.trim() || undefined,
        supportPhone: form.supportPhone.trim() || undefined,
        companyDescription: form.companyDescription.trim() || undefined,
        socialLinks,
      });
    },
    onSuccess: (updated) => {
      setCompany(updated);
      // Several of these fields are scored, so the brand score is now stale.
      queryClient.invalidateQueries({ queryKey: ["employer-brand-score"] });
      queryClient.invalidateQueries({ queryKey: ["employer-onboarding"] });
      toast.success("Changes saved");
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't save your changes"),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: (updated) => {
      setCompany(updated);
      queryClient.invalidateQueries({ queryKey: ["employer-brand-score"] });
      toast.success("Logo updated");
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't upload that image"),
  });

  if (!loaded || !form) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  const dirty = company ? JSON.stringify(form) !== JSON.stringify(toForm(company)) : false;
  const busy = save.isPending;

  const saveAction = (
    <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || busy}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      Save changes
    </Button>
  );

  const initial = (form.companyName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-6">
      <SectionCard
        title="Organization information"
        description="This information will be displayed publicly on your company profile."
        action={saveAction}
      >
        <div className="flex items-start gap-6 mb-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-light))] flex items-center justify-center text-white text-2xl font-semibold shrink-0 overflow-hidden">
            {company?.companyLogo ? (
              <img src={company.companyLogo} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1">
            <Label className="text-sm">Company logo</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-3">PNG or SVG, max 2MB. Recommended 256×256.</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              aria-label="Company logo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo.mutate(f);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
                disabled={uploadLogo.isPending}
              >
                {uploadLogo.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload new
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Company name">
            <Input className="bg-card" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
          </Field>
          <Field label="Website URL">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" value={form.companyWebsite} onChange={(e) => set("companyWebsite", e.target.value)} placeholder="acme.com" />
            </div>
          </Field>
          <Field label="Industry">
            <Select value={form.industry} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger className="bg-card"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {/* Keeps whatever was stored, even if it predates this list. */}
                {Array.from(new Set([...INDUSTRIES, form.industry].filter(Boolean))).map(i =>
                  <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Company size">
            <Select value={form.companySize} onValueChange={(v) => set("companySize", v)}>
              <SelectTrigger className="bg-card"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...SIZES, form.companySize].filter(Boolean))).map(i =>
                  <SelectItem key={i} value={i}>{i} employees</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Headquarters" className="md:col-span-2">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" value={form.headquarters} onChange={(e) => set("headquarters", e.target.value)} placeholder="Nairobi, Kenya" />
            </div>
          </Field>
          <Field label="Company description" className="md:col-span-2">
            <Textarea
              value={form.companyDescription}
              onChange={(e) => set("companyDescription", e.target.value)}
              rows={4}
              maxLength={500}
              className="bg-card"
              placeholder="Tell candidates and partners what your company does..."
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{form.companyDescription.length}/500</p>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Contact information"
        description="How candidates and partners can reach you. Shown on your public company profile."
        action={saveAction}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Support email">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} placeholder="careers@acme.com" />
            </div>
          </Field>
          <Field label="Phone number">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" value={form.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} />
            </div>
          </Field>
          <Field label="LinkedIn">
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/company/acme" />
            </div>
          </Field>
          <Field label="Twitter / X">
            <div className="relative">
              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="x.com/acme" />
            </div>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
