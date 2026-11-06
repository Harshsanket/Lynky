import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.FRONTEND_URL = "https://lynky.test";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.EXPIRATION_DAYS = "30";

const { PublicError, getPublicErrorMessage } = await import(
  "../service/public-error.service.js"
);

test("production keeps PublicError copy", () => {
  assert.equal(
    getPublicErrorMessage(
      new PublicError("This URL is not allowed"),
      "Internal server error"
    ),
    "This URL is not allowed"
  );
});

test("production masks internal error text behind the fallback", () => {
  assert.equal(
    getPublicErrorMessage(
      new Error("database password=secret"),
      "Internal server error"
    ),
    "Internal server error"
  );

  assert.equal(
    getPublicErrorMessage(
      new Error("stack trace detail"),
      "Unable to shorten URL"
    ),
    "Unable to shorten URL"
  );
});
