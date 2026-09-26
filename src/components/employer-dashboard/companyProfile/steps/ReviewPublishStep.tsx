import { Controller, useFormContext } from "react-hook-form";
import { EmployerBrand, calcProfileStrength } from "@/data/companyProfile/employer-brand-schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, AlertCircle, Globe, EyeOff, Lock, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReviewPublishStep({
  onGoToStep,
  verificationStatus,
}: {
  onGoToStep: (step: number) => void;
  verificationStatus?: "unverified" | "verified";
}) {
  const { watch, control } = useFormContext<EmployerBrand>();
  const data = watch();
  const strength = calcProfileStrength(data);

  const checklist: { label: string; ok: boolean; tip?: string; step: number }[] = [
    { label: "Logo uploaded", ok: !!data.logo, step: 1 },
    { label: "Cover banner uploaded", ok: !!data.banner, step: 1 },
    { label: "Tagline added", ok: !!data.tagline, step: 1 },
    { label: "Compelling overview (80+ chars)", ok: (data.overview || "").length >= 80, step: 2 },
    { label: "Mission & vision filled", ok: !!data.mission && !!data.vision, step: 2 },
    { label: "At least 3 core values", ok: data.values.length >= 3, step: 2 },
    { label: "3+ photos in gallery", ok: data.gallery.length >= 3, step: 3 },
    { label: "Culture video added", ok: !!data.cultureVideo, tip: "Optional but boosts engagement by 40%", step: 3 },
    { label: "2+ reasons to work here", ok: data.whyWorkHere.length >= 2, step: 4 },
    { label: "4+ benefits added", ok: data.benefitCategories.reduce((n, c) => n + c.items.length, 0) >= 4, step: 4 },
    { label: "2+ employee testimonials", ok: data.testimonials.length >= 2, step: 5 },
    { label: "1+ video testimonial", ok: data.videoTestimonials.some((v) => !!(v.videoUrl || v.thumbnail)), tip: "Optional but increases trust by 3x", step: 5 },
    { label: "DEI stats published", ok: data.deiStats.length >= 2, step: 5 },
  ];

  const completed = checklist.filter((c) => c.ok).length;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-primary to-navy-light text-primary-foreground rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Profile strength</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">{strength}</span>
            <span className="opacity-70">/100</span>
          </div>
          <div className="mt-3 h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-coral-light transition-all duration-500"
              style={{ width: `${strength}%` }}
            />
          </div>
          <p className="text-sm opacity-80 mt-3">
            {strength >= 90
              ? "Outstanding — you're ready to attract top talent."
              : strength >= 70
              ? "Strong profile. A few finishing touches will set you apart."
              : "Keep going — the checklist below shows what to add next."}
          </p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Completion checklist</Label>
          <span className="text-xs text-muted-foreground">
            {completed}/{checklist.length} complete
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {checklist.map((c) => (
            <div
              key={c.label}
              className={cn(
                "flex items-start gap-2 px-3 py-2.5 rounded-xl border",
                c.ok ? "bg-card border-border" : "bg-muted/30 border-dashed border-border"
              )}
            >
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                {!c.ok ? (
                  <button
                    type="button"
                    onClick={() => onGoToStep(c.step)}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 text-left"
                  >
                    {c.label}
                  </button>
                ) : (
                  <p className="text-sm">{c.label}</p>
                )}
                {!c.ok && c.tip && <p className="text-[11px] text-muted-foreground mt-0.5">{c.tip}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-sm font-semibold">Visibility & settings</Label>

        <Controller
          control={control}
          name="visibility"
          render={({ field }) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {([
                { v: "public", icon: Globe, title: "Public", desc: "Discoverable in search & listings" },
                { v: "unlisted", icon: EyeOff, title: "Unlisted", desc: "Only people with the link can view" },
                { v: "private", icon: Lock, title: "Private", desc: "Visible only to your team" },
              ] as const).map(({ v, icon: Icon, title, desc }) => {
                const on = field.value === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => field.onChange(v)}
                    className={cn(
                      "text-left rounded-none p-3 border-2 transition-all",
                      on ? "border-accent bg-accent/5" : "border-border bg-card hover:border-foreground/30"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 mb-2", on ? "text-accent" : "text-muted-foreground")} />
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </button>
                );
              })}
            </div>
          )}
        />

        <SettingRow
          name="showJobs"
          title="Show open jobs on profile"
          description="Display your live job openings on the public profile."
        />
        <SettingRow
          name="allowFollow"
          title="Allow candidates to follow"
          description="Get notified when candidates follow your company."
        />

        {verificationStatus && (
          <div
            className={cn(
              "flex items-start gap-2 p-3 rounded-xl border",
              verificationStatus === "verified"
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-muted/30 border-dashed border-border"
            )}
          >
            {verificationStatus === "verified" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldQuestion className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", verificationStatus === "verified" && "text-emerald-600")}>
                {verificationStatus === "verified" ? "Verified" : "Unverified"}
              </p>
              <p className="text-xs text-muted-foreground">
                {verificationStatus === "verified"
                  ? "Your sign-in email domain matches your company website."
                  : data.website
                  ? "Sign in with an email at your company's domain to get a Verified badge."
                  : "Add your company website to become eligible for verification."}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingRow({
  name,
  title,
  description,
}: {
  name: "showJobs" | "allowFollow";
  title: string;
  description: string;
}) {
  const { control } = useFormContext<EmployerBrand>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  );
}