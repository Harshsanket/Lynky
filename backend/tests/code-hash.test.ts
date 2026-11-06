import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { CODE_HASH_PATTERN, hashCode, isCurrentCodeHash } = await import(
  "../service/code-hash.service.js"
);

test("hashes a short code deterministically with a version prefix", () => {
  const first = hashCode("abc123");

  assert.equal(first, hashCode("abc123"));
  assert.match(first, CODE_HASH_PATTERN);
  assert.equal(isCurrentCodeHash(first), true);
});

test("different codes produce different hashes", () => {
  assert.notEqual(hashCode("abc123"), hashCode("abc124"));
});

test("does not expose the plaintext code", () => {
  const hash = hashCode("secret");

  assert.equal(hash.includes("secret"), false);
  assert.equal(isCurrentCodeHash("secret"), false);
  assert.equal(isCurrentCodeHash(null), false);
});
