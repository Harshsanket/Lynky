import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.MIN_CODE_LENGTH = "4";
process.env.MAX_CODE_LENGTH = "6";

const {
  deriveCodeFromSalt,
  generateCodeSalt,
  hashCode,
  isValidCodeSalt,
} = await import("../service/code-hash.service.js");
const { isValidCode } = await import(
  "../service/shortcode-validator.service.js"
);

test("generates 16-byte hex salts with validation", () => {
  const salt = generateCodeSalt();

  assert.match(salt, /^[a-f0-9]{32}$/);
  assert.equal(isValidCodeSalt(salt), true);
  assert.equal(isValidCodeSalt(salt.toUpperCase()), false);
  assert.equal(isValidCodeSalt(""), false);
  assert.equal(isValidCodeSalt(null), false);
  assert.notEqual(generateCodeSalt(), salt);
});

test("derives the same code from the same urlHash and salt", () => {
  const urlHash = `${"a".repeat(64)}`;
  const salt = generateCodeSalt();

  const first = deriveCodeFromSalt(urlHash, salt);
  const second = deriveCodeFromSalt(urlHash, salt);

  assert.equal(first, second);
  assert.equal(first.length, 6);
  assert.equal(isValidCode(first), true);
  assert.match(first, /^[0-9A-Za-z]+$/);
});

test("different urlHash or salt derives a different code", () => {
  const salt = generateCodeSalt();
  const otherSalt = generateCodeSalt();
  const first = deriveCodeFromSalt(`${"a".repeat(64)}`, salt);
  const second = deriveCodeFromSalt(`${"b".repeat(64)}`, salt);
  const third = deriveCodeFromSalt(`${"a".repeat(64)}`, otherSalt);

  assert.notEqual(first, second);
  assert.notEqual(first, third);
});

test("derived code hashes like any other short code", () => {
  const salt = generateCodeSalt();
  const code = deriveCodeFromSalt(`${"c".repeat(64)}`, salt);

  assert.equal(hashCode(code), hashCode(code));
  assert.equal(hashCode(code).includes(code), false);
});

test("rejects an invalid salt", () => {
  assert.throws(
    () => deriveCodeFromSalt(`${"a".repeat(64)}`, "not-a-salt"),
    /Invalid code salt/
  );
});
