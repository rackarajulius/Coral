import assert from "node:assert/strict";
import test from "node:test";
import { ctaSite, normaliseCtaUrl } from "./ctaLink.ts";

test("a public web address, with https:// added when it was left off", () => {
  assert.equal(normaliseCtaUrl("example.com/book"), "https://example.com/book");
  assert.equal(normaliseCtaUrl(" https://shop.example.co.ug/item?id=4 "), "https://shop.example.co.ug/item?id=4");
  assert.equal(normaliseCtaUrl("http://example.org"), "http://example.org/");
});

test("never a script, the reader's own machine or network, or a disguised link", () => {
  for (const raw of [
    "javascript:alert(1)", "data:text/html,x", "mailto:a@example.com", "http://localhost:8081", "http://127.0.0.1",
    "http://192.168.1.1", "http://10.1.2.3", "http://169.254.169.254", "http://intranet", "https://bank.example@evil.example",
    "two words.com", "",
  ]) {
    assert.equal(normaliseCtaUrl(raw), null, raw);
  }
});

test("the bar names the site from the link itself", () => {
  assert.equal(ctaSite("https://www.example.com/page"), "example.com");
  assert.equal(ctaSite("https://shop.example.co.ug/"), "shop.example.co.ug");
  // A look-alike name shows as the address it really is.
  assert.equal(ctaSite("https://exаmple.com/"), "xn--exmple-4nf.com");
  assert.equal(ctaSite("not a url"), "");
});
