import { useState } from "react";
import { ExternalLink, FileText, Film, FolderGit2, Palette } from "lucide-react";
import { ImageLightbox } from "@/components/community/feed/ImageLightbox";
import type { PortfolioItem } from "@/contexts/ProfileContext";

type FeaturedType = PortfolioItem["type"];

/** What a Featured item's link says, by kind. */
export const FEATURED_LINK_VERB: Record<FeaturedType, string> = {
  project: "View project",
  video: "Watch",
  document: "Open document",
  design: "View design",
};

const KIND: Record<FeaturedType, { label: string; icon: typeof FileText }> = {
  project: { label: "Project", icon: FolderGit2 },
  video: { label: "Video", icon: Film },
  document: { label: "Document", icon: FileText },
  design: { label: "Design", icon: Palette },
};

export interface FeaturedWorkItem {
  key: string | number;
  type: FeaturedType;
  title: string;
  description?: string | null;
  link?: string | null;
  imageUrl?: string | null;
}

/**
 * A link that opens: typed without a scheme is allowed when saving
 * ("github.com/me/app"), anything that isn't a web address is not shown.
 */
function openableLink(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Featured items as visitors see them, on the profile and the provider page:
 * a picture of the work, what it is, and where it lives. The picture opens
 * full size here; only the link leaves Coral.
 */
export function FeaturedWork({ items }: { items: FeaturedWorkItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const pictures = items.flatMap((item) => (item.imageUrl ? [item.imageUrl] : []));

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const kind = KIND[item.type] ?? KIND.project;
          const link = openableLink(item.link);
          return (
            <li key={item.key} className="flex flex-col overflow-hidden rounded-xl border border-border">
              {item.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setOpen(pictures.indexOf(item.imageUrl!))}
                  aria-label={`View the picture of ${item.title} full size`}
                  className="aspect-video overflow-hidden bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
                </button>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted/40 text-muted-foreground" aria-hidden="true">
                  <kind.icon className="h-8 w-8" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kind.label}</span>
                <p className="mt-0.5 line-clamp-2 break-words text-sm font-semibold text-foreground">{item.title}</p>
                {item.description && <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{item.description}</p>}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex w-fit items-center gap-1 text-xs font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FEATURED_LINK_VERB[item.type] ?? FEATURED_LINK_VERB.project}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ImageLightbox images={pictures} index={open} onClose={() => setOpen(null)} />
    </>
  );
}

export default FeaturedWork;
