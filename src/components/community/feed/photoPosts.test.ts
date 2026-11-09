import assert from "node:assert/strict";
import test from "node:test";
import { inTurn, usePhotoPosts } from "./photoPosts.ts";

/** A promise to settle by hand. */
function later<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const only = () => Object.values(usePhotoPosts.getState().posts)[0];
const reset = () => usePhotoPosts.setState({ posts: {} });

test("uploads go one at a time, in the order picked, and a failed one doesn't stop the next", async () => {
  const started: string[] = [];
  const first = later<string>();
  const run = (name: string, result: Promise<string>) => () => { started.push(name); return result; };
  const a = inTurn(run("a", first.promise), new AbortController().signal);
  const b = inTurn(run("b", Promise.resolve("b")), new AbortController().signal);
  await settle();
  assert.deepEqual(started, ["a"]);
  first.reject(new Error("too big"));
  await assert.rejects(a, /too big/);
  assert.equal(await b, "b");
  assert.deepEqual(started, ["a", "b"]);
});

test("one taken out of the draft while waiting its turn is never started", async () => {
  const started: string[] = [];
  const first = later<string>();
  const removed = new AbortController();
  const a = inTurn(() => { started.push("a"); return first.promise; }, new AbortController().signal);
  const b = inTurn(() => { started.push("b"); return Promise.resolve("b"); }, removed.signal);
  removed.abort();
  first.resolve("a");
  assert.equal(await a, "a");
  await assert.rejects(b);
  assert.deepEqual(started, ["a"]);
});

test("a post sent before its pictures are up goes out once they all are, in the order picked", async () => {
  reset();
  const one = later<string>();
  const two = later<string>();
  const sent: string[][] = [];
  usePhotoPosts.getState().postWhenUploaded({
    preview: { url: "https://x/one.jpg", kind: "image" },
    allImages: true,
    uploads: [one.promise, two.promise],
    send: async (urls) => { sent.push(urls); return "post-1"; },
  });
  assert.equal(only().status, "waiting");
  two.resolve("https://x/two.jpg");
  await settle();
  assert.equal(sent.length, 0, "not before the last one is up");
  one.resolve("https://x/one.jpg");
  await settle();
  assert.deepEqual(sent, [["https://x/one.jpg", "https://x/two.jpg"]]);
  assert.equal(only().status, "posted");
  assert.equal(only().postId, "post-1");
  usePhotoPosts.getState().dismiss(only().key);
  assert.equal(only(), undefined);
});

test("a picture that doesn't upload stops the post, and says why", async () => {
  reset();
  let sends = 0;
  usePhotoPosts.getState().postWhenUploaded({
    preview: { url: "https://x/one.jpg", kind: "image" },
    allImages: true,
    uploads: [Promise.resolve("https://x/one.jpg"), Promise.reject(new Error("That file isn't a picture."))],
    send: async () => { sends++; return "never"; },
  });
  await settle();
  assert.equal(sends, 0);
  assert.equal(only().status, "failed");
  assert.match(only().error!, /A photo didn't upload\. That file isn't a picture\./);
});

test("a post the server refuses is reported, not lost quietly", async () => {
  reset();
  usePhotoPosts.getState().postWhenUploaded({
    preview: { url: "https://x/one.jpg", kind: "image" },
    allImages: true,
    uploads: [Promise.resolve("https://x/one.jpg")],
    send: async () => { throw new Error("Posting too fast."); },
  });
  await settle();
  assert.equal(only().status, "failed");
  assert.equal(only().error, "Posting too fast.");
});
