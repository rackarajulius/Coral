const SOURCE_LABELS: Record<string, string> = {
  platform: "Our platform",
  adzuna: "Adzuna",
  jsearch: "Web",
  talent: "Talent.com",
  greenhouse: "Employer",
  lever: "Employer",
  ashby: "Employer",
};

/**
 * Where the job is listed. Web results say which site they came from — "via
 * LinkedIn", "via Job Bank" — or "Employer" for the company's own careers
 * site, rather than a generic "Web".
 */
export function SourceBadge({
  source,
  publishedOn,
}: {
  source: string;
  publishedOn?: { name: string; isEmployer: boolean };
}) {
  const label = publishedOn
    ? publishedOn.isEmployer
      ? "Employer"
      : `via ${publishedOn.name}`
    : SOURCE_LABELS[source] ?? "Web";
  const isPlatform = source === "platform";
  return (
    <span
      title={publishedOn && !publishedOn.isEmployer ? `Listed on ${publishedOn.name}` : undefined}
      className={`shrink-0 max-w-[9rem] truncate px-2 py-0.5 rounded-full text-[10px] font-medium ${
        isPlatform ? "bg-coral/10 text-coral" : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}
