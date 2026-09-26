import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Building2, ExternalLink, Globe, MapPin, Users } from "lucide-react";
import { fetchPublicJobById } from "@/lib/jobs/fetchJobs";
import type { Job } from "@/data/jobs";
import { resolveJobIcon } from "@/lib/utils";
import CompanyResearchPanel from "./CompanyResearchPanel";
import EmployerBrandSections from "./EmployerBrandSections";

/**
 * "About {company}" — the employer's OWN profile first (authoritative, always
 * available), with AI web research offered underneath as optional enrichment.
 *
 * Every field renders only when the employer actually filled it in; nothing is
 * inferred or padded out.
 */
export default function AboutCompanySection({ job }: { job: Job }) {
  /**
   * The job handed to us usually comes from a list row, and list rows carry no
   * brand content — it is fetched only on the detail endpoint. So the brand
   * blocks ask for the full job themselves rather than silently rendering
   * nothing. Everything above them already works from the list fields, so this
   * request never blocks what is on screen.
   */
  const detail = useQuery({
    queryKey: ["job-detail", job.id],
    queryFn: () => fetchPublicJobById(job.id),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const p = detail.data?.companyProfile ?? job.companyProfile;

  const facts = [
    p?.industry && { icon: Building2, value: p.industry },
    p?.size && { icon: Users, value: `${p.size} employees` },
    p?.headquarters && { icon: MapPin, value: p.headquarters },
  ].filter(Boolean) as { icon: React.ElementType; value: string }[];

  /**
   * Brand content counts here too. An employer who filled in only the
   * why-work-here cards would otherwise be told they "haven't added a company
   * profile yet" directly above their own three cards.
   */
  const hasBrandContent = !!(
    p?.whyWorkHere?.length ||
    p?.coreValues?.length ||
    p?.awards?.length ||
    p?.galleryPhotos?.length ||
    p?.mission?.trim() ||
    p?.diversityStatement?.trim()
  );

  const hasOwnInfo = !!(
    p?.description?.trim() ||
    p?.tagline?.trim() ||
    facts.length ||
    p?.culture?.trim() ||
    hasBrandContent
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start gap-3">
        <img
          src={resolveJobIcon(job.icon)}
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
            About {job.company}
            {/* Only for a status a human approved. Absence is not a mark
                against the employer, so nothing is shown when unverified. */}
            {p?.verified && (
              <span title="Verified employer">
                <BadgeCheck className="h-4 w-4 text-coral" aria-label="Verified employer" />
              </span>
            )}
          </h2>
          {p?.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
        </div>
        {p?.website && (
          <a
            href={p.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-coral hover:underline"
          >
            <Globe className="h-3.5 w-3.5" /> Website
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {hasOwnInfo ? (
        <div className="space-y-3">
          {facts.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {facts.map((f) => (
                <span
                  key={f.value}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <f.icon className="h-3.5 w-3.5" /> {f.value}
                </span>
              ))}
              {p?.foundedYear && (
                <span className="text-xs text-muted-foreground">Founded {p.foundedYear}</span>
              )}
            </div>
          )}

          {p?.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          )}

          {p?.culture && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Culture
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.culture}</p>
            </div>
          )}

          {p?.benefits && p.benefits.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company benefits
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.benefits.slice(0, 10).map((b) => (
                  <span key={b} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {job.company} hasn't added a company profile yet.
        </p>
      )}

      {/* The employer's own brand content, when they have written any. */}
      {p && <EmployerBrandSections profile={p} company={job.company} />}

      {/* Optional enrichment from public sources — clearly separate from the
          employer's own words above. */}
      <div className="mt-4 border-t border-border pt-4">
        <CompanyResearchPanel jobId={job.id} company={job.company} variant="inline" />
      </div>
    </section>
  );
}
