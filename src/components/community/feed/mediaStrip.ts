/**
 * The rules behind a post's row of pictures (see PostMedia.tsx), kept apart
 * from the page so they can be tested on their own.
 *
 * Every picture in the row is the same height and keeps its own shape — as on
 * X — between these two: a phone screenshot stays narrow without becoming a
 * sliver, and a panorama is cropped at the sides rather than filling the row
 * and hiding that there are more.
 */
export const NARROWEST = 0.5;
export const WIDEST = 1.25;
/** Until a picture has loaded and its shape is known. */
export const UNKNOWN_SHAPE = 1;

/** Width over height for a picture's tile. */
export function tileRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return UNKNOWN_SHAPE;
  return Math.min(WIDEST, Math.max(NARROWEST, width / height));
}

/**
 * Where the row scrolls to for the next or previous picture: the start of the
 * first tile past the one now at the start, or the last one before it.
 *
 * `starts` are the tiles' left edges in the row, already less the row's
 * padding, so the first is 0. Past either end it stays put.
 */
export function stepTarget(starts: number[], scrollLeft: number, direction: 1 | -1, maxScroll: number): number {
  const slack = 2;
  if (direction > 0) {
    const next = starts.find((x) => x > scrollLeft + slack);
    return Math.min(next ?? maxScroll, maxScroll);
  }
  const before = [...starts].reverse().find((x) => x < scrollLeft - slack);
  return Math.max(before ?? 0, 0);
}

/** Whether there is anything to scroll to on either side. */
export function stripEdges(scrollLeft: number, clientWidth: number, scrollWidth: number) {
  const slack = 2;
  return {
    canPrevious: scrollLeft > slack,
    canNext: scrollLeft + clientWidth < scrollWidth - slack,
  };
}
