/**
 * What one "Media" pick becomes in the draft.
 *
 * One button for pictures, video and documents, as on X, so the file decides
 * what it is rather than the button someone guessed. The rules are the ones
 * the separate buttons kept: up to four pictures (and, without Mux, short
 * clips beside them); a streamed video on its own; a PDF on its own. A pick
 * that mixes what can't go together is refused whole, with what can, rather
 * than half-attached.
 */

type FileLike = { name: string; type: string };

export type MediaKindOfFile = "image" | "video" | "document" | "other";

export type MediaPick<F extends FileLike> =
  | { kind: "photos"; files: F[] }
  | { kind: "video"; file: F }
  | { kind: "document"; file: F }
  | { kind: "refused"; message: string };

/** By its type, or its name when the browser gives none (an iPhone .mov often comes untyped). */
export function kindOf(file: FileLike): MediaKindOfFile {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/") || (!type && /\.(mov|m4v|mp4|webm)$/i.test(file.name))) return "video";
  if (type === "application/pdf" || (!type && /\.pdf$/i.test(file.name))) return "document";
  return "other";
}

/** What the file picker offers, given what the draft already holds. */
export function acceptFor(draft: { streaming: boolean; attached: number }): string {
  const images = "image/png,image/jpeg,image/webp,image/gif";
  const shortClips = "video/mp4,video/webm";
  // With pictures already in, only more of what can sit beside them.
  if (draft.attached > 0) return draft.streaming ? images : `${images},${shortClips}`;
  const video = draft.streaming ? "video/mp4,video/webm,video/quicktime,.mov,.m4v" : shortClips;
  return `${images},${video},application/pdf,.pdf`;
}

export function sortPicked<F extends FileLike>(
  files: F[],
  draft: { streaming: boolean; attached: number },
): MediaPick<F> | null {
  if (files.length === 0) return null;
  const kinds = files.map(kindOf);
  if (kinds.includes("other")) {
    return { kind: "refused", message: "That file can't be posted. Pick photos, a video or a PDF." };
  }
  const only = <K extends MediaKindOfFile>(kind: K) => files.filter((_, i) => kinds[i] === kind);

  const documents = only("document");
  if (documents.length > 0) {
    if (draft.attached > 0) return { kind: "refused", message: "A PDF is posted on its own. Remove the photos first." };
    if (files.length > 1) return { kind: "refused", message: "A PDF is posted on its own. Pick just the one document." };
    return { kind: "document", file: documents[0] };
  }

  const videos = only("video");
  if (draft.streaming && videos.length > 0) {
    if (draft.attached > 0) return { kind: "refused", message: "A video is posted on its own. Remove the photos first." };
    if (files.length > 1) return { kind: "refused", message: "A video is posted on its own. Pick just the one video." };
    return { kind: "video", file: videos[0] };
  }

  // Pictures, and short clips beside them when videos aren't streamed. The
  // cap of four is applied as they go in.
  return { kind: "photos", files };
}
