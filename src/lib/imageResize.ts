/**
 * Pictures made the right size in the browser, before they are uploaded.
 *
 * A phone photo is 3,000–4,000 pixels across and 2–5 MB; a feed shows it at
 * most ~1,200 device pixels wide, and a logo at under 100. Sending the
 * original costs the person uploading (often on mobile data) and then every
 * reader, every time it is shown. LinkedIn never serves a picture larger than
 * its slot; this keeps ours close to that.
 *
 * Re-encoding also drops the photo's metadata, which on a phone usually
 * includes where it was taken.
 *
 * Left alone: GIFs (resizing would flatten an animation), SVGs and anything
 * this browser can't decode — the server still checks every file, so the
 * original is simply sent as before.
 */

/** How big each kind of picture needs to be, on its longest side. */
export const IMAGE_SIZES = {
  /** A post picture, a space banner, a listing or project picture: fills a feed slot on a 2–3x phone. */
  post: 1600,
  /** Logos and profile photos, shown at 100–200 px at most. */
  avatar: 400,
  /** Page and profile banners, full width on a desktop. */
  banner: 2000,
} as const;

const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Small enough to send as is — unless it is a JPEG, which may carry a location. */
const SMALL_ENOUGH_BYTES = 300 * 1024;
const JPEG_QUALITY = 0.82;

/**
 * The file at no more than `maxEdge` pixels on its longest side, or the
 * original when it is already small, can't be decoded here, or would not get
 * smaller.
 */
export async function fitImage(file: File, maxEdge: number): Promise<File> {
  if (!RESIZABLE.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    // Turned upright first: phones store most photos sideways with a note
    // saying which way is up, and the note is dropped below.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES && file.type !== "image/jpeg") return file;

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    // A logo's see-through background has to survive: WebP keeps it, and so
    // does PNG where this browser can't write WebP (Safari).
    const transparent = file.type !== "image/jpeg" && hasTransparency(ctx, width, height);
    const blob = transparent
      ? (await toBlob(canvas, "image/webp", 0.9)) ?? (await toBlob(canvas, "image/png"))
      : await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (!blob) return file;
    // Never trade a file for a bigger one, except a JPEG's, whose metadata
    // is the point of re-encoding it.
    if (blob.size >= file.size && file.type !== "image/jpeg") return file;

    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.${ext}`, { type: blob.type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

/**
 * The encoded picture, or null when the browser can't produce `type` —
 * Safari answers a WebP request with a PNG, which is caught here.
 */
function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob && blob.type === type ? blob : null), type, quality),
  );
}

/** Whether any pixel is less than fully opaque. Sampled on large pictures. */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  // Every pixel up to ~1M, then every few: a transparent background is never
  // a single stray pixel.
  const step = Math.max(1, Math.floor((width * height) / 1_000_000)) * 4;
  for (let i = 3; i < data.length; i += step) if (data[i] < 255) return true;
  return false;
}
