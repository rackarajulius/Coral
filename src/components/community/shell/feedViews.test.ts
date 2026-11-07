import assert from "node:assert/strict";
import test from "node:test";
import { parseView, startingPurpose } from "./feedViews.ts";

test("on a section's tab, a new post starts as what that person's side puts out", () => {
  assert.equal(startingPurpose("opportunity", "freelancer"), "showcase");
  assert.equal(startingPurpose("showcase", "client"), "opportunity");
  // Reached by a link, past the hidden tab: still their own side's.
  assert.equal(startingPurpose("showcase", "freelancer"), "showcase");
  assert.equal(startingPurpose("opportunity", "client"), "opportunity");
});

test("with no side known, a post starts as what the tab is for", () => {
  assert.equal(startingPurpose("showcase", null), "showcase");
  assert.equal(startingPurpose("opportunity", null), "opportunity");
});

test("everywhere else, a new post starts as the composer's default", () => {
  assert.equal(startingPurpose(null, "freelancer"), undefined);
  assert.equal(startingPurpose("following", "client"), undefined);
  assert.equal(startingPurpose("mine", null), undefined);
});

test("an old Discussions link falls back to Home", () => {
  assert.equal(parseView("discussion"), null);
});
