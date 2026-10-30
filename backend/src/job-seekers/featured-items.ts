import { isOurStorageHost } from '../storage/our-storage-url';
import { PROFILE_BUCKET } from '../storage/storage.service';

/**
 * Featured items — the work a person puts first on their profile — as anyone
 * but the owner sees them: on the profile, and on their provider page.
 */

export const FEATURED_TYPES = ['project', 'video', 'document', 'design'] as const;
export type FeaturedType = (typeof FEATURED_TYPES)[number];

export interface PublicFeaturedItem {
  id: string;
  type: FeaturedType;
  title: string;
  description: string | null;
  /** Where the work lives. */
  link: string | null;
  /** A picture of it, uploaded to Coral by the owner. */
  imageUrl: string | null;
}

interface StoredFeaturedItem {
  id: string;
  title: string;
  mediaType: string | null;
  description: string | null;
  projectUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
}

const PICTURE_FILE = /\.(png|jpe?g|webp)$/i;

/**
 * The item's picture, when the owner uploaded it here; null otherwise.
 *
 * Never another site's address, which would learn who looked. Nor an old
 * picture kept inside the row as text: megabytes per item, to every visitor.
 */
export function ownFeaturedPicture(value: string | null | undefined, ownerUserId: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && isOurStorageHost(url)
      && url.pathname.includes(`/storage/v1/object/public/${PROFILE_BUCKET}/portfolio/${ownerUserId}-`)
      && PICTURE_FILE.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * A link a visitor can open. Typed without a scheme is allowed when saving
 * ("github.com/me/app"), so one is added; anything that isn't a web address
 * (javascript:, data:) is dropped.
 */
export function featuredLink(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text || text.length > 2048) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * What a visitor sees of each item. The picture is shown as a picture and
 * never stands in for the link: an item without one used to offer "Open" on
 * the bare image file.
 */
export function publicFeaturedItems(items: StoredFeaturedItem[], ownerUserId: string): PublicFeaturedItem[] {
  return items.map((item) => ({
    id: item.id,
    type: FEATURED_TYPES.includes(item.mediaType as FeaturedType) ? (item.mediaType as FeaturedType) : 'project',
    title: item.title,
    description: item.description,
    link: featuredLink(item.projectUrl ?? item.videoUrl),
    imageUrl: ownFeaturedPicture(item.imageUrl, ownerUserId),
  }));
}
