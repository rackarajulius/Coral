import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { addPostToFeeds } from "./feedCache.ts";

type Post = { id: string; authorId: string; space: { id: string } | null; company: { id: string } | null };

const page = (ids: string[], total = ids.length) => ({
  data: ids.map((id) => ({ id, authorId: "x", space: null, company: null })),
  meta: { page: 1, limit: 20, total, totalPages: 1 },
});
const infinite = (...pages: string[][]) => ({ pages: pages.map((ids) => page(ids)), pageParams: pages.map((_, i) => i + 1) });
const ids = (data: { pages: { data: { id: string }[] }[] }) => data.pages.map((p) => p.data.map((x) => x.id));

function cache() {
  const qc = new QueryClient();
  qc.setQueryData(["community-posts", "feed", null], infinite(["a", "b"], ["c"]));
  qc.setQueryData(["community-posts", "feed", "mine"], infinite(["m1"]));
  qc.setQueryData(["community-posts", "feed", "following"], infinite(["f1"]));
  qc.setQueryData(["community-posts", "feed", "my-spaces"], infinite(["s1"]));
  qc.setQueryData(["community-posts", "person", "me"], infinite(["p1"]));
  qc.setQueryData(["community-posts", "person", "someone-else"], infinite(["q1"]));
  qc.setQueryData(["community-posts", "company", "acme"], infinite(["k1"]));
  qc.setQueryData(["community-posts", "space", "space-1", 1], page(["x1"]));
  qc.setQueryData(["community-posts", "space", "space-1", 2], page(["x2"]));
  qc.setQueryData(["community-posts", "rail", "top"], page(["r1"]));
  return qc;
}

test("your own post goes to the top of Home, Your posts and your page — page one only", () => {
  const qc = cache();
  const post: Post = { id: "new", authorId: "me", space: null, company: null };
  addPostToFeeds(qc, post as never);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", null])!), [["new", "a", "b"], ["c"]]);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", "mine"])!), [["new", "m1"]]);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "person", "me"])!), [["new", "p1"]]);
  // Not someone else's page, not Following (your own posts aren't in it), not My spaces (no space).
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "person", "someone-else"])!), [["q1"]]);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", "following"])!), [["f1"]]);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", "my-spaces"])!), [["s1"]]);
  assert.equal((qc.getQueryData(["community-posts", "feed", null]) as { pages: { meta: { total: number } }[] }).pages[0].meta.total, 3);
});

test("a company post goes to the company's feed, not your personal page; a space post to that space", () => {
  const qc = cache();
  addPostToFeeds(qc, { id: "co", authorId: "me", space: { id: "space-1" }, company: { id: "acme" } } as never);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "company", "acme"])!), [["co", "k1"]]);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "person", "me"])!), [["p1"]]);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", "my-spaces"])!), [["co", "s1"]]);
  assert.deepEqual((qc.getQueryData(["community-posts", "space", "space-1", 1]) as { data: { id: string }[] }).data.map((p) => p.id), ["co", "x1"]);
  assert.deepEqual((qc.getQueryData(["community-posts", "space", "space-1", 2]) as { data: { id: string }[] }).data.map((p) => p.id), ["x2"]);
});

test("never twice, and nothing is fetched — the rest is only marked out of date", () => {
  const qc = cache();
  const post = { id: "a", authorId: "me", space: null, company: null };
  addPostToFeeds(qc, post as never);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", null])!), [["a", "b"], ["c"]]);
  const rail = qc.getQueryCache().find({ queryKey: ["community-posts", "rail", "top"] })!;
  assert.equal(rail.state.isInvalidated, true);
  assert.equal(rail.state.fetchStatus, "idle");
});

test("a deleted post leaves every list at once, and a refused delete puts them all back", async () => {
  const { removePostFromFeeds, restoreFeeds } = await import("./feedCache.ts");
  const qc = cache();
  const snapshot = removePostFromFeeds(qc, "a");
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", null])!), [["b"], ["c"]]);
  assert.equal((qc.getQueryData(["community-posts", "feed", null]) as { pages: { meta: { total: number } }[] }).pages[0].meta.total, 1);
  // Lists without it are left exactly as they were.
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", "mine"])!), [["m1"]]);
  removePostFromFeeds(qc, "x1");
  assert.deepEqual((qc.getQueryData(["community-posts", "space", "space-1", 1]) as { data: { id: string }[] }).data.map((p) => p.id), []);
  restoreFeeds(qc, snapshot);
  assert.deepEqual(ids(qc.getQueryData(["community-posts", "feed", null])!), [["a", "b"], ["c"]]);
});
