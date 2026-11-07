import assert from "node:assert/strict";
import test from "node:test";
import type { CitySuggestion } from "../api/locations";
import { placeLine, placeParts, splitLocation } from "./places.ts";

const toronto: CitySuggestion = {
  name: "Toronto", region: "Ontario", regionCode: "ON", countryCode: "CA", country: "Canada", label: "Toronto, ON",
};
const kampala: CitySuggestion = {
  name: "Kampala", region: "Central Region", countryCode: "UG", country: "Uganda", label: "Kampala, Uganda",
};

test("a picked city is written so the profile reads it back into the right columns", () => {
  assert.equal(placeLine(toronto), "Toronto, Ontario, Canada");
  assert.deepEqual(splitLocation(placeLine(toronto)), { city: "Toronto", state: "Ontario", country: "Canada" });
  assert.equal(placeLine(kampala), "Kampala, Uganda");
  assert.deepEqual(splitLocation(placeLine(kampala)), { city: "Kampala", state: "", country: "Uganda" });
});

test("its columns are what that line splits into", () => {
  assert.deepEqual(placeParts(toronto), splitLocation(placeLine(toronto)));
  assert.deepEqual(placeParts(kampala), splitLocation(placeLine(kampala)));
});

test("the short label would put a province in the country column, which is why it isn't used", () => {
  assert.deepEqual(splitLocation(toronto.label), { city: "Toronto", state: "", country: "ON" });
});
