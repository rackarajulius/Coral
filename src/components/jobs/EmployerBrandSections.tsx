import { useEffect, useRef, useState } from "react";
import {
  Award as AwardIcon, ArrowRight, ChevronLeft, ChevronRight, Heart, Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { CompanyProfile, GalleryPhoto } from "@/data/jobs";

/**
 * The employer's own brand content, as they wrote it.
 *
 * All of this was already being collected during company-profile setup and
 * stored — it simply had nowhere to appear, so jobseekers never saw the part of
 * the posting the employer put the most thought into.
 *
 * Every block renders only when its field has content. Nothing is inferred,
 * padded, or given a placeholder: an employer who skipped a step shows one
 * section fewer, not an empty one.
 *
 * This is a summary, not the company page. Lists are capped and a link out
 * carries the rest, so the job stays the subject of the job card.
 */
export default function EmployerBrandSections({
  profile,
  company,
}: {
  profile: CompanyProfile;
  company: string;
}) {
  const why = (profile.whyWorkHere ?? []).slice(0, 3);
  const values = (profile.coreValues ?? []).slice(0, 6);
  const awards = (profile.awards ?? []).slice(0, 3);
  const dei = (profile.deiStats ?? []).slice(0, 4);
  const photos = (profile.galleryPhotos ?? []).slice(0, 6);

  const hasAnything =
    why.length > 0 ||
    values.length > 0 ||
    awards.length > 0 ||
    photos.length > 0 ||
    !!profile.mission?.trim() ||
    !!profile.diversityStatement?.trim();

  if (!hasAnything) return null;

  return (
    <div className="mt-4 space-y-5 border-t border-border pt-4">
      {profile.mission?.trim() && (
        <Block label="Mission">
          <p className="text-sm leading-relaxed text-muted-foreground">{profile.mission}</p>
        </Block>
      )}

      {why.length > 0 && (
        <Block label={`Why work at ${company}`} icon={Sparkles}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {why.map((card, i) => (
              <div key={card.id ?? `${card.title}-${i}`} className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">{card.title}</p>
                {card.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {values.length > 0 && (
        <Block label="What they value">
          <ul className="space-y-2">
            {values.map((v, i) => (
              <li key={v.id ?? `${v.title}-${i}`} className="text-sm">
                <span className="font-medium text-foreground">{v.title}</span>
                {v.description && (
                  <span className="text-muted-foreground"> — {v.description}</span>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {photos.length > 0 && (
        <Block label="Inside the company">
          <PhotoStrip photos={photos} />
        </Block>
      )}

      {awards.length > 0 && (
        <Block label="Recognition" icon={AwardIcon}>
          <ul className="space-y-1.5">
            {awards.map((a, i) => (
              <li key={a.id ?? `${a.title}-${i}`} className="text-sm">
                <span className="font-medium text-foreground">{a.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {a.organization}, {a.year}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(profile.diversityStatement?.trim() || dei.length > 0) && (
        <Block label="Diversity & inclusion" icon={Heart}>
          {profile.diversityStatement?.trim() && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile.diversityStatement}
            </p>
          )}
          {dei.length > 0 && (
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {dei.map((s, i) => (
                <div key={s.id ?? `${s.label}-${i}`} className="rounded-lg bg-muted/50 p-2.5">
                  {/* The employer's own figure, shown as theirs. We do not
                      verify it, so we do not present it as verified. */}
                  <p className="text-base font-semibold text-foreground">{s.value}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </Block>
      )}

      {profile.id && (
        <Link
          to={`/company-profile/${profile.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-coral hover:underline"
        >
          See everything about {company}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/**
 * The photo strip.
 *
 * No scrollbar: a permanent grey track under six photos draws the eye to the
 * chrome instead of the pictures. The arrows sit over the edge photos and only
 * appear on hover, so at rest this is just the photographs.
 *
 * They are hidden when there is nothing further in that direction — an arrow
 * that does nothing is worse than no arrow. Touch devices never hover, so the
 * strip stays swipeable and the arrows simply never show.
 */
function PhotoStrip({ photos }: { photos: GalleryPhoto[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // The rounding slack matters: sub-pixel widths otherwise leave the end
    // arrow visible forever on a strip that cannot scroll any further.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    // Also on resize: a strip that fits at one width may not at another.
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [photos.length]);

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // Roughly one card and a gap, so a click lands on a photo edge.
    el.scrollBy({ left: direction * 168, behavior: "smooth" });
  };

  return (
    <div className="group/strip relative">
      <div
        ref={ref}
        onScroll={sync}
        // `overflow-x-auto` is what clips and scrolls; `no-scrollbar` only
        // hides the bar's appearance. Without the former the photos escape the
        // card and hand their scrollbar to whatever ancestor does clip.
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto scroll-smooth px-1"
      >
        {photos.map((photo, i) => (
          <figure key={photo.id ?? `${photo.url}-${i}`} className="w-40 shrink-0">
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              loading="lazy"
              className="h-24 w-40 rounded-lg object-cover"
              onError={(e) => {
                // A broken link should cost one photo, not leave a torn frame.
                (e.currentTarget.closest("figure") as HTMLElement).style.display = "none";
              }}
            />
            {photo.caption && (
              <figcaption className="mt-1 truncate text-[11px] text-muted-foreground">
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {!atStart && (
        <StripArrow side="left" onClick={() => scrollBy(-1)} />
      )}
      {!atEnd && (
        <StripArrow side="right" onClick={() => scrollBy(1)} />
      )}
    </div>
  );
}

function StripArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photos" : "More photos"}
      className={`absolute top-12 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1.5 text-foreground shadow-md ring-1 ring-border
        opacity-0 transition-opacity group-hover/strip:opacity-100 focus-visible:opacity-100
        ${side === "left" ? "left-1" : "right-1"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Block({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </p>
      {children}
    </div>
  );
}
