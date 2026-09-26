import { useRef, useState, forwardRef } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, X, Building2, Globe, MapPin, Star, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmployerBrand, INDUSTRIES, COMPANY_SIZES } from  "@/data/companyProfile/employer-brand-schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageDropzone } from "../ImageDropzone";
import { cn } from "@/lib/utils";
import { getSocialIcon } from "@/lib/socialIcons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadCompanyBanner, uploadCompanyLogo } from "@/lib/api/employerCompany";
import { useEmployerCompanyStore } from "@/stores/employerCompanyStore";

export function BasicInfoStep() {
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<EmployerBrand>();
  const { fields, append, remove, update } = useFieldArray({ control, name: "locations" });
  const { fields: socialFields, append: appendSocial, remove: removeSocial } = useFieldArray({ control, name: "social" });
  const industries = watch("industries");

  function toggleIndustry(name: string) {
    if (industries.includes(name)) {
      setValue("industries", industries.filter((i) => i !== name), { shouldDirty: true });
    } else {
      setValue("industries", [...industries, name], { shouldDirty: true });
    }
  }

  return (
    <div className="space-y-8">
      {/* Banner + logo */}
      <section>
        <h3 className="text-base font-semibold mb-1">Brand visuals</h3>
        <p className="text-sm text-muted-foreground mb-4">Your cover banner and logo are the first thing candidates see.</p>
        <Controller
          control={control}
          name="banner"
          render={({ field }) => {
            const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
            const MAX_MB = 5;
            const MIN_W = 1200;
            const MIN_H = 300;

            async function uploadBanner(file: File) {
              setUploadingBanner(true);
              try {
                const updated = await uploadCompanyBanner(file);
                field.onChange(updated.companyBanner ?? undefined);
                useEmployerCompanyStore.getState().setCompany(updated);
                toast.success("Cover banner uploaded");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to upload banner");
              } finally {
                setUploadingBanner(false);
              }
            }

            function pickAndValidate(file?: File) {
              if (!file) return;
              if (!ALLOWED.includes(file.type)) {
                toast.error("Unsupported file type", { description: "Use PNG, JPG, or WEBP." });
                return;
              }
              if (file.size > MAX_MB * 1024 * 1024) {
                toast.error("File too large", {
                  description: `Max ${MAX_MB}MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
                });
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const img = new Image();
                img.onload = () => {
                  if (img.width < MIN_W || img.height < MIN_H) {
                    toast.error("Banner too small", {
                      description: `Needs at least ${MIN_W}×${MIN_H}px. Yours is ${img.width}×${img.height}px.`,
                    });
                    return;
                  }
                  uploadBanner(file);
                };
                img.onerror = () => toast.error("Couldn't read image");
                img.src = result;
              };
              reader.readAsDataURL(file);
            }
            return (
              <div className="space-y-2">
                <ImageDropzone
                  value={field.value}
                  onChange={field.onChange}
                  label="Drop your cover banner"
                  hint="Recommended 1600×400 · PNG, JPG, WEBP · max 5MB"
                  className="aspect-[4/1] w-full"
                  uploading={uploadingBanner}
                  onFile={pickAndValidate}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {field.value
                      ? "Cover banner uploaded."
                      : `No banner yet — PNG, JPG, or WEBP · min ${MIN_W}×${MIN_H}px · max ${MAX_MB}MB.`}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept={ALLOWED.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        pickAndValidate(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploadingBanner}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload banner
                    </Button>
                    {field.value && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => field.onChange(undefined)}
                        disabled={uploadingBanner}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        />
        <div className="mt-4 flex items-center gap-4">
          <Controller
            control={control}
            name="logo"
            render={({ field }) => {
              const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
              const MAX_MB = 5;

              async function handleLogoFile(file: File) {
                if (!ALLOWED.includes(file.type)) {
                  toast.error("Unsupported file type", { description: "Use PNG, JPG, or WEBP." });
                  return;
                }
                if (file.size > MAX_MB * 1024 * 1024) {
                  toast.error("File too large", {
                    description: `Max ${MAX_MB}MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
                  });
                  return;
                }
                setUploadingLogo(true);
                try {
                  const updated = await uploadCompanyLogo(file);
                  field.onChange(updated.companyLogo ?? undefined);
                  useEmployerCompanyStore.getState().setCompany(updated);
                  toast.success("Logo uploaded");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to upload logo");
                } finally {
                  setUploadingLogo(false);
                }
              }

              return (
                <ImageDropzone
                  value={field.value}
                  onChange={field.onChange}
                  shape="circle"
                  label="Logo"
                  className="w-24 h-24 shrink-0"
                  uploading={uploadingLogo}
                  onFile={handleLogoFile}
                />
              );
            }}
          />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Logo</p>
            Square works best · at least 256×256
          </div>
        </div>
      </section>

      {/* Identity */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Company name" error={errors.displayName?.message}>
          <Input className="bg-card" {...register("displayName")} placeholder="e.g. Acme Technologies" />
        </Field>
        <Field label="Tagline" error={errors.tagline?.message}>
          <Input className="bg-card" {...register("tagline")} placeholder="One memorable line about your mission" />
        </Field>
        <Field label="Company size" error={errors.companySize?.message}>
          <Controller
            control={control}
            name="companySize"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Founded" error={errors.foundedYear?.message}>
          <Input className="bg-card" {...register("foundedYear")} placeholder="2019" inputMode="numeric" maxLength={4} />
        </Field>
      </section>

      {/* Industries */}
      <section>
        <Label className="mb-2 block">Industries</Label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((name) => {
            const on = industries.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleIndustry(name)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
        {errors.industries && <p className="text-xs text-destructive mt-2">{errors.industries.message as string}</p>}
      </section>

      {/* Locations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="block">Locations</Label>
            <p className="text-xs text-muted-foreground">Mark one as your headquarters.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ id: crypto.randomUUID(), city: "", country: "", isHQ: false })}
          >
            <Plus className="w-3.5 h-3.5" /> Add location
          </Button>
        </div>
        <div className="space-y-2">
          {fields.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-xl">
              No locations yet — add your first one.
            </div>
          )}
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2 items-center bg-card border border-border rounded-xl p-2">
              <MapPin className="w-4 h-4 text-muted-foreground col-span-1 ml-2" />
              <Input className="col-span-4 bg-card" placeholder="City" {...register(`locations.${i}.city`)} />
              <Input className="col-span-4 bg-card" placeholder="Country" {...register(`locations.${i}.country`)} />
              <button
                type="button"
                onClick={() => {
                  fields.forEach((ff, idx) => update(idx, { ...watch(`locations.${idx}`), isHQ: idx === i }));
                }}
                className={cn(
                  "col-span-2 flex items-center justify-center gap-1 text-xs font-medium rounded-lg py-2 border transition-colors",
                  watch(`locations.${i}.isHQ`)
                    ? "bg-accent/10 text-accent border-accent/30"
                    : "text-muted-foreground border-transparent hover:border-border"
                )}
              >
                <Star className="w-3 h-3" /> HQ
              </button>
              <Button type="button" size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => remove(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Web & headquarters */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Website" error={errors.website?.message}>
          <InputWithIcon icon={<Globe className="w-4 h-4" />} placeholder="https://yourcompany.com" {...register("website")} />
        </Field>
        <Field label="Headquarters" error={errors.headquarters?.message}>
          <InputWithIcon icon={<Building2 className="w-4 h-4" />} placeholder="San Francisco, CA" {...register("headquarters")} />
        </Field>
      </section>

      {/* Social links */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="block">Social links</Label>
            <p className="text-xs text-muted-foreground">Add any social profiles your company uses.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => appendSocial({ id: crypto.randomUUID(), label: "", url: "" })}
          >
            <Plus className="w-3.5 h-3.5" /> Add social link
          </Button>
        </div>
        <div className="space-y-2">
          {socialFields.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-xl">
              No social links yet — add your first one.
            </div>
          )}
          {socialFields.map((f, i) => {
            const label = watch(`social.${i}.label`);
            const Icon = getSocialIcon(label || "");
            return (
              <div key={f.id} className="grid grid-cols-12 gap-2 items-start bg-card border border-border rounded-xl p-2">
                <Icon className="w-4 h-4 text-muted-foreground col-span-1 mt-2.5 ml-2" />
                <div className="col-span-4">
                  <Input className="bg-card" placeholder="Platform (e.g. LinkedIn)" {...register(`social.${i}.label`)} />
                  {errors.social?.[i]?.label && (
                    <p className="text-xs text-destructive mt-1">{errors.social[i]?.label?.message}</p>
                  )}
                </div>
                <div className="col-span-6">
                  <Input className="bg-card" placeholder="https://…" {...register(`social.${i}.url`)} />
                  {errors.social?.[i]?.url && (
                    <p className="text-xs text-destructive mt-1">{errors.social[i]?.url?.message}</p>
                  )}
                </div>
                <Button type="button" size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => removeSocial(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const InputWithIcon = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }>(
  ({ icon, ...props }, ref) => (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">{icon}</div>
      <Input ref={ref} {...props} className="pl-9 bg-card" />
    </div>
  )
);