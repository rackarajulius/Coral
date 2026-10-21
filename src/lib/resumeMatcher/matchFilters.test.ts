import assert from "node:assert/strict";
import test from "node:test";
import type { MatchedJob } from "../api/resumeMatcher";
import { DEFAULT_FILTERS, applyMatchFilters, isFiltering, postedAgo } from "./matchFilters.ts";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 24 * 3600_000).toISOString();
const job = (id: string, extra: Partial<MatchedJob> = {}): MatchedJob => ({
  id, title: id, company: "Acme", location: "Toronto", source: "jsearch", matchScore: 50, ...extra,
});

const matches = [
  job("a", { postedAt: daysAgo(0.5), workplace: "remote", employmentType: "full_time", yearlyPay: { min: 90000, max: 110000 } }),
  job("b", { postedAt: daysAgo(5), workplace: "hybrid", employmentType: "contract", yearlyPay: { min: 130000 } }),
  job("c", { postedAt: daysAgo(20), workplace: "onsite", employmentType: "full_time" }),
  job("d"), // states nothing
];
const ids = (list: MatchedJob[]) => list.map((m) => m.id);

test("with no filters every match stays, in match order", () => {
  assert.deepEqual(ids(applyMatchFilters(matches, DEFAULT_FILTERS, NOW)), ["a", "b", "c", "d"]);
  assert.equal(isFiltering(DEFAULT_FILTERS), false);
});

test("date posted keeps only jobs that say when, within the window", () => {
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, postedWithin: 1 }, NOW)), ["a"]);
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, postedWithin: 7 }, NOW)), ["a", "b"]);
});

test("workplace keeps only jobs that state one of the chosen", () => {
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, workplaces: ["remote", "hybrid"] }, NOW)), ["a", "b"]);
});

test("job type and pay floor", () => {
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, employmentType: "full_time" }, NOW)), ["a", "c"]);
  // The top of a range counts: 90-110k passes a 100k floor.
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, minYearlyPay: 100000 }, NOW)), ["a", "b"]);
  assert.equal(isFiltering({ ...DEFAULT_FILTERS, minYearlyPay: 100000 }), true);
});

test("sorting by pay or date puts jobs that don't say last, in match order", () => {
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, sort: "pay" }, NOW)), ["b", "a", "c", "d"]);
  assert.deepEqual(ids(applyMatchFilters(matches, { ...DEFAULT_FILTERS, sort: "newest" }, NOW)), ["a", "b", "c", "d"]);
  assert.equal(isFiltering({ ...DEFAULT_FILTERS, sort: "pay" }), false);
});

test("posted ago reads like a person would say it", () => {
  assert.equal(postedAgo(daysAgo(0.2), NOW), "Today");
  assert.equal(postedAgo(daysAgo(1.2), NOW), "Yesterday");
  assert.equal(postedAgo(daysAgo(4), NOW), "4d ago");
  assert.equal(postedAgo(daysAgo(15), NOW), "2w ago");
  assert.equal(postedAgo(daysAgo(65), NOW), "2mo ago");
  assert.equal(postedAgo(undefined, NOW), undefined);
  assert.equal(postedAgo("garbage", NOW), undefined);
});
