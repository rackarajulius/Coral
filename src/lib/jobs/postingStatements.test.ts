import { test } from "node:test";
import assert from "node:assert/strict";
import {
  asksForCanadianExperience,
  looksOntario,
  payRangeTooWide,
  vacancyForJob,
  vacancyFromJob,
} from "./postingStatements.ts";

test("the vacancy answer round-trips, and unstated clears", () => {
  assert.equal(vacancyFromJob(true), "open");
  assert.equal(vacancyFromJob(false), "future");
  assert.equal(vacancyFromJob(null), "");
  assert.equal(vacancyFromJob(undefined), "");
  assert.equal(vacancyForJob("open"), true);
  assert.equal(vacancyForJob("future"), false);
  assert.equal(vacancyForJob(""), null);
});

test("a yearly range wider than $50,000 is flagged, up to the $200,000 ceiling", () => {
  assert.equal(payRangeTooWide(60000, 120000, "yearly"), true);
  assert.equal(payRangeTooWide(60000, 110000, "yearly"), false);
  assert.equal(payRangeTooWide(150000, 250000, "yearly"), false);
  assert.equal(payRangeTooWide(20, 90000, "hourly"), false);
  assert.equal(payRangeTooWide(0, 120000, "yearly"), false);
});

test("Canadian experience is found however it is put", () => {
  assert.equal(asksForCanadianExperience("Minimum 2 years Canadian work experience"), true);
  assert.equal(asksForCanadianExperience("Experience working in Canada preferred"), true);
  assert.equal(asksForCanadianExperience("Expérience canadienne un atout"), true);
  assert.equal(asksForCanadianExperience("Serve Canadian clients across the country"), false);
});

test("Ontario locations are recognised as people write them", () => {
  assert.equal(looksOntario("Toronto, ON"), true);
  assert.equal(looksOntario("Ottawa, Ontario, Canada"), true);
  assert.equal(looksOntario("ONTARIO CANADA"), true);
  assert.equal(looksOntario("Vancouver, BC"), false);
  assert.equal(looksOntario("London"), false);
  assert.equal(looksOntario("Boston"), false);
});
