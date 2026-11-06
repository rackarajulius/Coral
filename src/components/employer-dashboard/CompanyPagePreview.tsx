import { Building2, Globe, Landmark, MapPin, Users } from "lucide-react";
import { companySizeLabel, companyTypeLabel } from "@/lib/companyFacts";

/**
 * The company page as it will look, updating while the creation form is
 * filled in — LinkedIn shows one beside its form. The same pieces as the top
 * of the editor's PublicProfilePreview, cut down to fit beside a form.
 */
export function CompanyPagePreview({
  name,
  slug,
  industry,
  size,
  type,
  headquarters,
  website,
  logoUrl,
  tagline,
}: {
  name: string;
  slug?: string;
  industry?: string;
  size?: string;
  type?: string;
  headquarters?: string;
  website?: string;
  logoUrl?: string | null;
  tagline?: string | null;
}) {
  const facts = [
    { icon: Landmark, label: companyTypeLabel(type) },
    { icon: Users, label: companySizeLabel(size) },
    { icon: MapPin, label: headquarters?.trim() || null },
    { icon: Globe, label: website?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "") || null },
  ].filter((f): f is { icon: typeof Landmark; label: string } => !!f.label);

  return (
    <section aria-label="Page preview" className="overflow-hidden rounded-xl border border-border bg-card">
      <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-foreground">
        Page preview
      </p>
      <div className="aspect-[4/1] w-full bg-muted">
        <div className="h-full w-full gradient-hero" />
      </div>
      <div className="px-4 pb-5">
        <div className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-card shadow-elevated">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <p className="mt-3 break-words font-display text-lg font-bold tracking-tight">
          {name.trim() || "Your company name"}
        </p>
        {tagline?.trim() && <p className="mt-0.5 text-sm text-muted-foreground">{tagline}</p>}

        {industry && (
          <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground">
            {industry}
          </span>
        )}

        {facts.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {facts.map(({ icon: Icon, label }) => (
              <li key={label} className="flex min-w-0 items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
        )}

        {/* What visitors will press — shown, not working, in a preview. */}
        <span
          aria-hidden="true"
          className="mt-4 inline-flex h-8 items-center rounded-full bg-orange-500 px-4 text-xs font-medium text-white"
        >
          Follow
        </span>

        {slug && (
          <p className="mt-3 truncate text-[11px] text-muted-foreground">
            {window.location.host}/company/{slug}
          </p>
        )}
      </div>
    </section>
  );
}

export default CompanyPagePreview;
