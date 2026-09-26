import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X, Target, Eye } from "lucide-react";
import { IconPicker } from "../IconPicker";

export function AboutStoryStep() {
  const { register, control, watch, formState: { errors } } = useFormContext<EmployerBrand>();
  const { fields, append, remove } = useFieldArray({ control, name: "values" });
  const overview = watch("overview") || "";

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold">Company overview</Label>
          <span className="text-xs text-muted-foreground">{overview.length}/2000</span>
        </div>
        <Textarea
          {...register("overview")}
          rows={7}
          placeholder="Tell candidates who you are, what you build, and why it matters. Aim for a paragraph or two with personality."
          className="resize-none leading-relaxed bg-card"
        />
        {errors.overview && <p className="text-xs text-destructive mt-1">{errors.overview.message}</p>}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-primary" />
            </div>
            <Label className="text-sm font-semibold">Mission</Label>
          </div>
          <Textarea {...register("mission")} rows={4} placeholder="Why we exist." className="resize-none bg-card" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <Eye className="w-3.5 h-3.5 text-primary" />
            </div>
            <Label className="text-sm font-semibold">Vision</Label>
          </div>
          <Textarea {...register("vision")} rows={4} placeholder="The future we're building toward." className="resize-none bg-card" />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">Core values</Label>
            <p className="text-xs text-muted-foreground">3–6 values with a crisp title and description.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ id: crypto.randomUUID(), icon: "", title: "", description: "" })}
          >
            <Plus className="w-3.5 h-3.5" /> Add value
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map((f, i) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Controller
                  control={control}
                  name={`values.${i}.icon`}
                  render={({ field }) => (
                    <IconPicker value={field.value} onChange={field.onChange} size="sm" />
                  )}
                />
                <Input
                  {...register(`values.${i}.title`)}
                  placeholder="Value title (e.g. Ship with craft)"
                  className="flex-1 bg-card"
                />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                {...register(`values.${i}.description`)}
                rows={2}
                placeholder="One line on what this looks like in practice."
                className="resize-none text-sm bg-card"
              />
            </div>
          ))}
          {fields.length === 0 && (
            <div className="md:col-span-2 text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Add your first core value to get started.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
