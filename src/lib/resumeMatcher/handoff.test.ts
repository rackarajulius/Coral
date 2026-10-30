import assert from "node:assert/strict";
import test from "node:test";
import { handoffParams, matcherPath, readMatcherHandoff } from "./handoff.ts";

const read = (path: string) => readMatcherHandoff(new URL(path, "https://coral.test").searchParams);

test("a plain link matches the profile as it stands", () => {
  assert.equal(matcherPath(), "/resume-matcher");
  assert.equal(matcherPath({ query: "  ", location: "" }), "/resume-matcher");
  assert.deepEqual(read("/resume-matcher"), { remote: false });
});

test("a role and a place travel together", () => {
  const path = matcherPath({ query: "Sales Assistant", location: "Ontario, Canada" });
  assert.equal(path, "/resume-matcher?q=Sales+Assistant&where=Ontario%2C+Canada");
  assert.deepEqual(read(path), {
    search: { query: "Sales Assistant", location: "Ontario, Canada", countryCode: undefined },
    remote: false,
  });
});

test("a role without a place searches around the person's own city", () => {
  const { search } = read(matcherPath({ query: "Nurse" }));
  assert.equal(search?.query, "Nurse");
  assert.equal(search?.location, undefined);
});

test("Remote is a workplace, not a place", () => {
  for (const h of [{ query: "Designer", location: " remote " }, { query: "Designer", remote: true }]) {
    const path = matcherPath(h);
    assert.equal(path, "/resume-matcher?q=Designer&where=&workplace=remote");
    assert.deepEqual(read(path), {
      search: { query: "Designer", location: "", countryCode: undefined },
      remote: true,
    });
  }
});

test("a search run on the page reads back the same", () => {
  const search = { query: "Teacher", location: "Kampala", countryCode: "UG" };
  const params = handoffParams(search, false);
  assert.deepEqual(readMatcherHandoff(params), { search, remote: false });
  // Anywhere carries no country of its own.
  const anywhere = handoffParams({ query: "Teacher", location: "", countryCode: "UG" }, false);
  assert.equal(anywhere.toString(), "q=Teacher&where=");
});
