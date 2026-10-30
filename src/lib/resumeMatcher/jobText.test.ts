import assert from "node:assert/strict";
import test from "node:test";
import { jobTextBlocks } from "./jobText.ts";

test("an empty or missing ad has no blocks", () => {
  assert.deepEqual(jobTextBlocks(undefined), []);
  assert.deepEqual(jobTextBlocks("  \n\n "), []);
});

test("Ashby: capitalised headings and ' - ' bullets with blank lines between", () => {
  const ad =
    "WHO ARE WE?\n\nCohere is the leading security-first enterprise AI company.\n\n\n\n" +
    "AS A FULL-STACK SOFTWARE ENGINEER ON THE INTERNAL APPLICATIONS TEAM, YOU WILL:\n\n" +
    " - Work with a small team\n\n - Contribute to delightful experiences";
  assert.deepEqual(jobTextBlocks(ad), [
    { kind: "heading", text: "WHO ARE WE?" },
    { kind: "paragraph", lines: ["Cohere is the leading security-first enterprise AI company."] },
    { kind: "heading", text: "AS A FULL-STACK SOFTWARE ENGINEER ON THE INTERNAL APPLICATIONS TEAM, YOU WILL" },
    { kind: "list", ordered: false, items: ["Work with a small team", "Contribute to delightful experiences"] },
  ]);
});

test("Greenhouse and Lever, as the server writes them: a colon heading, then '• ' items", () => {
  assert.deepEqual(jobTextBlocks("About the Role:\n\nWe fix cars.\nWhat You’ll Do:\n• Review repairs.\n• Track schedules."), [
    { kind: "heading", text: "About the Role" },
    { kind: "paragraph", lines: ["We fix cars."] },
    { kind: "heading", text: "What You’ll Do" },
    { kind: "list", ordered: false, items: ["Review repairs.", "Track schedules."] },
  ]);
});

test("Indeed-style details stay prose: a colon inside a line is not a heading", () => {
  const ad = "Job Types: Full-time, Permanent\n\nPay: $50,000-$60,000 per year\n\nBenefits:\n\n* Dental care\n* Extended health care";
  assert.deepEqual(jobTextBlocks(ad), [
    { kind: "paragraph", lines: ["Job Types: Full-time, Permanent"] },
    { kind: "paragraph", lines: ["Pay: $50,000-$60,000 per year"] },
    { kind: "heading", text: "Benefits" },
    { kind: "list", ordered: false, items: ["Dental care", "Extended health care"] },
  ]);
});

test("a short line inside a paragraph, or the last line, is not a heading", () => {
  assert.deepEqual(jobTextBlocks("We are growing fast\nand hiring now\n\nApply today"), [
    { kind: "paragraph", lines: ["We are growing fast", "and hiring now"] },
    { kind: "paragraph", lines: ["Apply today"] },
  ]);
});

test("numbered steps are an ordered list, and '1.5 years' is not a step", () => {
  assert.deepEqual(jobTextBlocks("1. Apply online\n2) Meet the team\n\n1.5 years of experience."), [
    { kind: "list", ordered: true, items: ["Apply online", "Meet the team"] },
    { kind: "paragraph", lines: ["1.5 years of experience."] },
  ]);
});

test("a bullet alone on its line takes the next line as its item", () => {
  assert.deepEqual(jobTextBlocks("•\nReview repairs.\n•\n\nTrack schedules."), [
    { kind: "list", ordered: false, items: ["Review repairs.", "Track schedules."] },
  ]);
});

test("bullets written on one line become a list", () => {
  assert.deepEqual(jobTextBlocks("You will: • Build APIs • Review code • Mentor"), [
    { kind: "heading", text: "You will" },
    { kind: "list", ordered: false, items: ["Build APIs", "Review code", "Mentor"] },
  ]);
});
