import { Lightbulb } from "lucide-react";
import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";

export function TipsCard({ data }: { data: EmployerBrand }) {
  const tips: string[] = [];
  if (!data.cultureVideo) tips.push("Add a culture video — profiles with video get 40% more interest.");
  if (data.testimonials.length < 2) tips.push("Add 2+ employee testimonials for stronger social proof.");
  if (data.gallery.length < 3) tips.push("Upload 3+ gallery photos to bring your culture to life.");
  if (!data.tagline) tips.push("Write a memorable tagline — it appears in search results.");
  if ((data.overview || "").length < 80) tips.push("Expand your overview to at least 80 characters.");
  if (tips.length === 0) tips.push("Looking great! Review and publish when you're ready.");

  return (
    <div className="dashboard-section !p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center">
          <Lightbulb className="w-3.5 h-3.5 text-accent-foreground" />
        </div>
        <p className="text-sm font-semibold">Completion tips</p>
      </div>
      <ul className="space-y-2">
        {tips.slice(0, 4).map((t, i) => (
          <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
            <span className="text-accent shrink-0">›</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
