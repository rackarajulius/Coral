import { useFieldArray, useFormContext, Controller } from "react-hook-form";
import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageDropzone } from "../ImageDropzone";
import { Plus, X, Quote, Video, Image } from "lucide-react";

export function PeopleTestimonialsStep() {
  const { register, control } = useFormContext<EmployerBrand>();
  const tt = useFieldArray({ control, name: "testimonials" });
  const vt = useFieldArray({ control, name: "videoTestimonials" });
  const dei = useFieldArray({ control, name: "deiStats" });

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">Employee testimonials</Label>
            <p className="text-xs text-muted-foreground">Real voices outperform marketing copy. Aim for 2–4.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              tt.append({ id: crypto.randomUUID(), name: "", role: "", avatar: undefined, quote: "" })
            }
          >
            <Plus className="w-3.5 h-3.5" /> Add testimonial
          </Button>
        </div>
        <div className="space-y-3">
          {tt.fields.map((f, i) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4 relative">
              <Quote className="absolute top-3 right-3 w-4 h-4 text-muted-foreground/40" />
              <div className="flex gap-4">
                <Controller
                  control={control}
                  name={`testimonials.${i}.avatar`}
                  render={({ field }) => (
                    <ImageDropzone
                      value={field.value}
                      onChange={field.onChange}
                      shape="circle"
                      label=""
                      className="w-16 h-16 shrink-0"
                    />
                  )}
                />
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="bg-card" {...register(`testimonials.${i}.name`)} placeholder="Full name" />
                    <Input className="bg-card" {...register(`testimonials.${i}.role`)} placeholder="Role / team" />
                  </div>
                  <Textarea
                    {...register(`testimonials.${i}.quote`)}
                    rows={3}
                    placeholder="What's the most honest thing you'd say about working here?"
                    className="resize-none text-sm bg-card"
                  />
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => tt.remove(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {tt.fields.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Add a testimonial to start building social proof.
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-muted-foreground" />
              Video testimonials
            </Label>
            <p className="text-xs text-muted-foreground">Short clips from real employees. High trust, high engagement.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              vt.append({
                id: crypto.randomUUID(),
                name: "",
                role: "",
                videoUrl: undefined,
                thumbnail: undefined,
              })
            }
          >
            <Plus className="w-3.5 h-3.5" /> Add video
          </Button>
        </div>
        <div className="space-y-3">
          {vt.fields.map((f, i) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
              <div className="flex gap-4 min-w-0">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input className="bg-card" {...register(`videoTestimonials.${i}.name`)} placeholder="Full name" />
                    <Input className="bg-card" {...register(`videoTestimonials.${i}.role`)} placeholder="Role / team" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <div className="min-w-0">
                      <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Video className="w-3 h-3 shrink-0" /> Video
                      </Label>
                      <Controller
                        control={control}
                        name={`videoTestimonials.${i}.videoUrl`}
                        render={({ field }) => (
                          <ImageDropzone
                            value={field.value}
                            onChange={field.onChange}
                            accept="video/*"
                            size="compact"
                            label="Drop video"
                            hint="MP4, WebM, MOV"
                            className="h-28"
                          />
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Image className="w-3 h-3 shrink-0" /> Thumbnail
                      </Label>
                      <Controller
                        control={control}
                        name={`videoTestimonials.${i}.thumbnail`}
                        render={({ field }) => (
                          <ImageDropzone
                            value={field.value}
                            onChange={field.onChange}
                            size="compact"
                            label="Drop thumbnail"
                            hint="JPG, PNG, WebP"
                            className="h-28"
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 self-start" onClick={() => vt.remove(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {vt.fields.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Add a video testimonial to bring your employer brand to life.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-5">
          <Label className="text-sm font-semibold">Diversity &amp; Inclusion statement</Label>
          <p className="text-xs text-muted-foreground mb-2">A short paragraph on your commitment to diversity &amp; inclusion.</p>
          <Textarea
            {...register("diversityStatement")}
            rows={3}
            placeholder="We're building a team that reflects the world we serve. Inclusion isn't a program — it's how we hire, grow, and make decisions…"
            className="resize-none bg-card"
          />
        </div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">DEI stats</Label>
            <p className="text-xs text-muted-foreground">Showcase the numbers you're proud of and the ones you're working on.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => dei.append({ id: crypto.randomUUID(), label: "", value: "" })}
          >
            <Plus className="w-3.5 h-3.5" /> Add stat
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {dei.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2 items-center bg-card border border-border rounded-xl p-2">
              <Input className="flex-[2] min-w-0 bg-card" placeholder="Label (e.g. Women in engineering)" {...register(`deiStats.${i}.label`)} />
              <Input className="flex-1 min-w-0 bg-card" placeholder="Value (e.g. 42%)" {...register(`deiStats.${i}.value`)} />
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => dei.remove(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
