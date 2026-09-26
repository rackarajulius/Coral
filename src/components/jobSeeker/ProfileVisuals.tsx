import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The profile photo and banner, with honest defaults.
 *
 * Both used to fall back to stock photographs: a portrait of a smiling woman in
 * a blazer stood in as *anyone's* profile photo, and a boardroom scene as their
 * banner. On a hiring product that is worse than an empty frame — it puts a
 * face, and with it an apparent age, gender and ethnicity, on a candidate who
 * never uploaded one, and it looks like a picture they chose. A recruiter
 * cannot tell the difference until the call.
 *
 * What replaces them says "nothing here yet" plainly: initials for a person,
 * a flat brand wash for a banner.
 */

/** Up to two letters, from a name we may not have. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const letters = parts.length === 1
    ? parts[0].slice(0, 2)
    : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

export function ProfileAvatar({
  name,
  avatarUrl,
  className,
  textClassName,
}: {
  name: string;
  avatarUrl?: string;
  /** Sizing and shape come from the caller; the fallback fills the same box. */
  className?: string;
  textClassName?: string;
}) {
  /**
   * A stored URL can stop resolving — a bucket rotated, a file removed, the
   * image blocked. Without this the browser shows its broken-image glyph, so
   * the failure is caught and the initials take over.
   */
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);

  const initials = initialsOf(name);

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        // Empty alt where the name is unknown: inventing "Profile photo of
        // someone" tells a screen reader nothing it cannot already infer.
        alt={name ? `${name}'s profile photo` : ''}
        onError={() => setFailed(true)}
        className={cn('object-cover', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-primary/10 text-primary select-none',
        className,
      )}
      // The initials are decoration beside a name that is already on screen.
      aria-hidden="true"
    >
      <span className={cn('font-semibold tracking-wide', textClassName ?? 'text-2xl')}>
        {initials || '—'}
      </span>
    </div>
  );
}

export function ProfileBanner({
  bannerUrl,
  className,
}: {
  bannerUrl?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [bannerUrl]);

  if (bannerUrl && !failed) {
    return (
      <img
        src={bannerUrl}
        alt=""
        onError={() => setFailed(true)}
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }

  // Purely decorative, and clearly a default — no place, no people, nothing
  // that reads as a photograph the person put there.
  return (
    <div
      aria-hidden="true"
      className={cn(
        'h-full w-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent dark:from-primary/20 dark:via-primary/10',
        className,
      )}
    />
  );
}
