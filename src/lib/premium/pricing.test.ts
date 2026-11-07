import assert from "node:assert/strict";
import test from "node:test";
import { allowanceText, formatPlanPrice, perMonth, yearlySaving } from "./pricing.ts";

const monthly = { interval: "MONTHLY" as const, unitAmount: 1000, currency: "usd" };
const yearly = { interval: "YEARLY" as const, unitAmount: 5000, currency: "usd" };

test("whole prices read without cents", () => {
  assert.match(formatPlanPrice(1000, "usd"), /^\D*10$/);
  assert.match(formatPlanPrice(0, "usd"), /^\D*0$/);
  assert.match(formatPlanPrice(417, "usd"), /4\.17/);
});

test("a yearly price over twelve months", () => {
  assert.equal(perMonth(yearly), 417);
});

test("the yearly saving is worked out, and rounded down", () => {
  // $50 against 12 × $10 = $120 saves 58.3%.
  assert.equal(yearlySaving(monthly, yearly), 58);
});

test("no saving is claimed when there isn't one", () => {
  assert.equal(yearlySaving(monthly, { ...yearly, unitAmount: 12000 }), null);
  assert.equal(yearlySaving(monthly, { ...yearly, unitAmount: 13000 }), null);
  assert.equal(yearlySaving(monthly, { ...yearly, currency: "cad" }), null);
  assert.equal(yearlySaving(undefined, yearly), null);
});

test("allowances in words", () => {
  assert.equal(allowanceText(null, "day"), "Unlimited");
  assert.equal(allowanceText(0, "month"), null);
  assert.equal(allowanceText(2, "month"), "2 a month");
  assert.equal(allowanceText(20, "day"), "20 a day");
});
