import { useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";
import { uploadCompanyMedia } from "@/lib/api/employerCompany";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { IconPicker } from "../IconPicker";
import { BenefitCategoriesBuilder } from "../BenefitCategoriesBuilder";

import { ImageDropzone } from "../ImageDropzone";

export function CultureEvpStep() {
  const { register, control } = useFormContext<EmployerBrand>();
  const why = useFieldArray({ control, name: "whyWorkHere" });
  const awards = useFieldArray({ control, name: "awards" });
  const [uploadingImage, setUploadingImage] = useState(false);

  async function uploadTeamImage(file: File, onChange: (v: string) => void) {
    setUploadingImage(true);
    try {
      const url = await uploadCompanyMedia(file);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Why work here */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">Why work here</Label>
            <p className="text-xs text-muted-foreground">Three to five reasons candidates should join you.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => why.append({ id: crypto.randomUUID(), icon: "Sparkles", title: "", description: "" })}
          >
            <Plus className="w-3.5 h-3.5" /> Add reason
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {why.fields.map((f, i) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name={`whyWorkHere.${i}.icon`}
                  render={({ field }) => (
                    <IconPicker value={field.value} onChange={field.onChange} />
                  )}
                />
                <Input
                  {...register(`whyWorkHere.${i}.title`)}
                  placeholder="Why join (e.g. Truly remote-first)"
                  className="flex-1 bg-card"
                />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => why.remove(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                {...register(`whyWorkHere.${i}.description`)}
                rows={2}
                placeholder="Make it specific. Numbers and examples beat adjectives."
                className="resize-none text-sm bg-card"
              />
            </div>
          ))}
        </div>
      </section>

      <BenefitCategoriesBuilder />

      <section>
        <Label className="text-sm font-semibold">Culture description</Label>
        <p className="text-xs text-muted-foreground mb-2">How does it actually feel to work here, day to day?</p>
        <Textarea
          {...register("cultureDescription")}
          rows={5}
          placeholder="We move fast but never alone. Decisions happen in writing, work happens in deep focus blocks…"
          className="resize-none bg-card"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-semibold">Work philosophy</Label>
          <p className="text-xs text-muted-foreground mb-2">How you approach work — focus, autonomy, pace.</p>
          <Textarea
            {...register("culturePhilosophy")}
            rows={3}
            placeholder="e.g. Deep work over busywork. We protect focus time and default to async."
            className="resize-none bg-card"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold">Collaboration</Label>
          <p className="text-xs text-muted-foreground mb-2">How your team works together.</p>
          <Textarea
            {...register("cultureCollaboration")}
            rows={3}
            placeholder="e.g. Decisions in writing, demos on Fridays, generous code reviews."
            className="resize-none bg-card"
          />
        </div>
      </section>

      <section>
        <Label className="text-sm font-semibold">Team image</Label>
        <p className="text-xs text-muted-foreground mb-2">A photo of your team or office for the “Life at …” card.</p>
        <Controller
          control={control}
          name="cultureImage"
          render={({ field }) => (
            <ImageDropzone
              value={field.value}
              onChange={field.onChange}
              uploading={uploadingImage}
              onFile={(file) => uploadTeamImage(file, field.onChange)}
              label="Drop a team photo"
              hint="PNG, JPG, WEBP · landscape works best"
              className="aspect-video w-full"
            />
          )}
        />
      </section>

      {/* Awards & Accreditations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">Awards & Accreditations</Label>
            <p className="text-xs text-muted-foreground">Build trust and employer credibility.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => awards.append({ id: crypto.randomUUID(), title: "", organization: "", year: "", description: "", badgeUrl: undefined })}
          >
            <Plus className="w-3.5 h-3.5" /> Add award
          </Button>
        </div>
        <div className="space-y-3">
          {awards.fields.map((f, i) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4 relative">
              <div className="flex items-start gap-4">
                <Controller
                  control={control}
                  name={`awards.${i}.badgeUrl`}
                  render={({ field }) => (
                    <ImageDropzone
                      value={field.value}
                      onChange={field.onChange}
                      shape="circle"
                      size="compact"
                      label="Badge/Logo"
                      className="w-20 h-20 shrink-0"
                    />
                  )}
                />
                <div className="flex-1 space-y-3 min-w-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input {...register(`awards.${i}.title`)} placeholder="Award title (e.g. Great Place to Work)" className="md:col-span-1 bg-card" />
                    <Input {...register(`awards.${i}.organization`)} placeholder="Organization" className="md:col-span-1 bg-card" />
                    <Input {...register(`awards.${i}.year`)} placeholder="Year received" className="md:col-span-1 bg-card" />
                  </div>
                  <Textarea
                    {...register(`awards.${i}.description`)}
                    rows={2}
                    placeholder="Short description of the award..."
                    className="resize-none text-sm bg-card"
                  />
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => awards.remove(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {awards.fields.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Add awards and recognitions to build credibility.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
