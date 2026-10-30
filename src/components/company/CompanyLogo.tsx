import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A company's logo in its tile, or its first letter when there is none.
 *
 * One tile for every job card and job page, so a company looks the same
 * wherever it appears. A logo that is missing or fails to load shows the
 * letter instead of a broken image. Size and rounding come from `className`;
 * the default is the 48px card tile.
 */
export default function CompanyLogo({
  company,
  src,
  className,
}: {
  company: string;
  src?: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showLogo = !!src && failedSrc !== src;
  const letter = company.trim().match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted p-1.5 text-lg font-semibold text-muted-foreground shadow-inner",
        className,
      )}
    >
      {showLogo ? (
        <img
          src={src}
          alt={`${company} logo`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailedSrc(src)}
          className="h-full w-full rounded-sm object-contain"
        />
      ) : (
        <span aria-hidden="true">{letter}</span>
      )}
    </div>
  );
}
