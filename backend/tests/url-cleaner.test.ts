import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.FRONTEND_URL = "https://app.lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { cleanUrl } = await import(
  "../service/url-cleaner.service.js"
);
const { prepareUrl } = await import("../service/url.service.js");
const { isValidCode } = await import(
  "../service/shortcode-validator.service.js"
);

test("unwraps known tracking redirectors", () => {
  assert.equal(
    cleanUrl("https://www.google.com/url?q=https://example.com/a"),
    "https://example.com/a"
  );
});

test("does not unwrap navigation or share parameters", () => {
  const facebook =
    "https://www.facebook.com/sharer/sharer.php?u=https://news.example.org/a";
  const googleLogin =
    "https://accounts.google.com/ServiceLogin?continue=https://mail.google.com/mail/";
  const loginNext =
    "https://example.com/login?next=https://example.com/dashboard";

  assert.match(cleanUrl(facebook), /^https:\/\/www\.facebook\.com\//);
  assert.match(
    cleanUrl(googleLogin),
    /^https:\/\/accounts\.google\.com\//
  );
  assert.match(
    cleanUrl(loginNext),
    /^https:\/\/example\.com\/login/
  );
});

test("rejects a wrapped own-origin URL after provider unwrapping", () => {
  assert.throws(
    () =>
      prepareUrl(
        "https://www.google.com/url?q=https://lynky.test/abcd"
      ),
    /Lynky's own link/
  );
});

test("does not unwrap generic url parameters on arbitrary hosts", () => {
  assert.equal(
    cleanUrl(
      "https://example.com/go?url=https://evil.example/phish"
    ),
    "https://example.com/go?url=https%3A%2F%2Fevil.example%2Fphish"
  );
});

test("keeps repeated parameters with different values", () => {
  assert.equal(
    cleanUrl("https://shop.example.com/search?tag=red&tag=blue"),
    "https://shop.example.com/search?tag=red&tag=blue"
  );
});

test("collapses identical repeated parameters", () => {
  assert.equal(
    cleanUrl("https://shop.example.com/search?a=1&a=1"),
    "https://shop.example.com/search?a=1"
  );
});

test("removes referral parameters but keeps allowlisted affiliate tags", () => {
  const google = cleanUrl(
    "https://www.google.com/search?q=lynky&referrer=spam&utm_source=news"
  );

  assert.equal(google, "https://www.google.com/search?q=lynky");

  const amazon = cleanUrl(
    "https://www.amazon.in/dp/B0FQFW4MVJ?tag=affiliate-21&ascsubtag=tracking&ref=sr_1_3"
  );

  assert.match(amazon, /[?&]tag=affiliate-21(?:&|$)/);
  assert.doesNotMatch(amazon, /ascsubtag|ref=/);
});

test("validates short codes before database lookup", () => {
  assert.equal(isValidCode("abcd"), true);
  assert.equal(isValidCode("ab"), true);
  assert.equal(isValidCode("a".repeat(64)), true);
  assert.equal(isValidCode("a".repeat(65)), false);
  assert.equal(isValidCode("abc!"), false);
});
