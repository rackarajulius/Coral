import assert from "node:assert/strict";
import test from "node:test";
import { acceptFor, kindOf, sortPicked } from "./mediaPick.ts";

const file = (name: string, type: string) => ({ name, type });
const photo = (n = 1) => file(`photo-${n}.jpg`, "image/jpeg");
const video = file("clip.mov", "video/quicktime");
const pdf = file("deck.pdf", "application/pdf");
const empty = { streaming: true, attached: 0 };

test("the file decides what it is, by type or, untyped, by name", () => {
  assert.equal(kindOf(photo()), "image");
  assert.equal(kindOf(file("IMG_0001.MOV", "")), "video");
  assert.equal(kindOf(file("report.PDF", "")), "document");
  assert.equal(kindOf(file("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")), "other");
  // A typed file is taken at its type, whatever it is called.
  assert.equal(kindOf(file("looks-like.pdf", "image/png")), "image");
});

test("pictures go in together; a video or a PDF on its own", () => {
  assert.deepEqual(sortPicked([photo(1), photo(2)], empty), { kind: "photos", files: [photo(1), photo(2)] });
  assert.deepEqual(sortPicked([video], empty), { kind: "video", file: video });
  assert.deepEqual(sortPicked([pdf], empty), { kind: "document", file: pdf });
  assert.equal(sortPicked([], empty), null);
});

test("a pick mixing what can't go together is refused whole, saying why", () => {
  assert.match((sortPicked([photo(), video], empty) as { message: string }).message, /video is posted on its own/);
  assert.match((sortPicked([photo(), pdf], empty) as { message: string }).message, /PDF is posted on its own/);
  assert.match((sortPicked([pdf, pdf], empty) as { message: string }).message, /just the one document/);
  assert.match((sortPicked([photo(), file("a.zip", "application/zip")], empty) as { message: string }).message, /can't be posted/);
});

test("with photos already in, a video or PDF is refused and the picker offers only pictures", () => {
  const withPhotos = { streaming: true, attached: 2 };
  assert.match((sortPicked([video], withPhotos) as { message: string }).message, /Remove the photos first/);
  assert.match((sortPicked([pdf], withPhotos) as { message: string }).message, /Remove the photos first/);
  assert.equal(acceptFor(withPhotos), "image/png,image/jpeg,image/webp,image/gif");
  assert.match(acceptFor(empty), /video\/quicktime/);
  assert.match(acceptFor(empty), /application\/pdf/);
});

test("without Mux, short clips sit beside pictures as before", () => {
  const plain = { streaming: false, attached: 0 };
  const clip = file("clip.mp4", "video/mp4");
  assert.deepEqual(sortPicked([photo(), clip], plain), { kind: "photos", files: [photo(), clip] });
  assert.doesNotMatch(acceptFor(plain), /quicktime/);
  assert.match(acceptFor({ streaming: false, attached: 1 }), /video\/mp4/);
});
