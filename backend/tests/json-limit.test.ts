import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { JSON_BODY_LIMIT_BYTES } = await import(
  "../middleware/json.middleware.js"
);
const { env } = await import("../src/config/env.js");

test("JSON body limit covers the maximum URL in worst-case UTF-8", () => {
  // A single character can take up to 4 UTF-8 bytes, and the JSON envelope
  // plus escapes needs headroom beyond that.
  assert.ok(
    JSON_BODY_LIMIT_BYTES >= env.MAX_URL_LENGTH * 4 + 1024,
    `${JSON_BODY_LIMIT_BYTES} should cover ${env.MAX_URL_LENGTH} characters`
  );
  assert.ok(JSON_BODY_LIMIT_BYTES >= 8 * 1024);
});
