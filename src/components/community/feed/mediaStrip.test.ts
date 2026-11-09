import assert from "node:assert/strict";
import test from "node:test";
import { NARROWEST, UNKNOWN_SHAPE, WIDEST, stepTarget, stripEdges, tileRatio } from "./mediaStrip.ts";

test("each picture keeps its own shape, within limits", () => {
  assert.equal(tileRatio(1200, 1600), 0.75); // a phone photo
  assert.equal(tileRatio(1600, 1600), 1);
  assert.equal(tileRatio(1170, 2532), NARROWEST); // a tall screenshot stays readable
  assert.equal(tileRatio(4000, 1000), WIDEST); // a panorama is cropped, not row-wide
  assert.equal(tileRatio(0, 0), UNKNOWN_SHAPE); // not loaded yet
});

test("Next goes to the start of the following picture, Previous to the one before", () => {
  const starts = [0, 268, 536, 804];
  const max = 700;
  assert.equal(stepTarget(starts, 0, 1, max), 268);
  assert.equal(stepTarget(starts, 268, 1, max), 536);
  // The last picture can't come to the start; the row stops at its end.
  assert.equal(stepTarget(starts, 536, 1, max), 700);
  assert.equal(stepTarget(starts, 700, -1, max), 536);
  assert.equal(stepTarget(starts, 268, -1, max), 0);
  assert.equal(stepTarget(starts, 0, -1, max), 0);
  // Midway between two (a swipe that hasn't settled): forward is the next one, back the one before.
  assert.equal(stepTarget(starts, 300, 1, max), 536);
  assert.equal(stepTarget(starts, 300, -1, max), 268);
});

test("arrows only where there is more to see", () => {
  assert.deepEqual(stripEdges(0, 500, 1100), { canPrevious: false, canNext: true });
  assert.deepEqual(stripEdges(300, 500, 1100), { canPrevious: true, canNext: true });
  assert.deepEqual(stripEdges(600, 500, 1100), { canPrevious: true, canNext: false });
  // Everything fits: no arrows at all.
  assert.deepEqual(stripEdges(0, 500, 480), { canPrevious: false, canNext: false });
});
