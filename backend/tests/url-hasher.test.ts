import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { hashUrl } = await import(
  "../service/url-hasher.service.js"
);

test("hashUrl is deterministic and returns the keyed digest", () => {
  const first = hashUrl("https://example.com/path");
  const second = hashUrl("https://example.com/path");

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("hashUrl is keyed, not a bare SHA-256 of the URL", () => {
  const url = "https://example.com/path";
  const bare = crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");

  assert.notEqual(hashUrl(url), bare);
});

test("different URLs produce different hashes", () => {
  assert.notEqual(
    hashUrl("https://example.com/a"),
    hashUrl("https://example.com/b")
  );
});
