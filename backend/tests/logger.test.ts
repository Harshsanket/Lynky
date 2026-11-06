import test from "node:test";
import assert from "node:assert/strict";

import {
  redactUrl,
  redactUrlToOrigin,
  sanitizeLogContext,
} from "../service/logger.js";

test("strips query strings and fragments from logged URLs", () => {
  assert.equal(
    redactUrl("https://example.com/path?token=secret#section"),
    "https://example.com/path"
  );
});

test("keeps the origin and path", () => {
  assert.equal(
    redactUrl("https://example.com/a/b"),
    "https://example.com/a/b"
  );
});

test("redacts invalid and non-string values", () => {
  assert.equal(redactUrl("not a url"), "<invalid-url>");
  assert.equal(redactUrl(undefined), "<redacted>");
  assert.equal(redactUrl(123), "<redacted>");
});

test("origin-only redaction drops path tokens", () => {
  assert.equal(
    redactUrlToOrigin(
      "https://example.com/reset/secret-token?x=1#frag"
    ),
    "https://example.com"
  );
  assert.equal(redactUrlToOrigin("not a url"), "<invalid-url>");
  assert.equal(redactUrlToOrigin(null), "<redacted>");
});

test("log context drops URL paths, queries, fragments, and credentials", () => {
  const sanitized = sanitizeLogContext({
    destination: "https://user:pass@example.com/reset/token?x=1#frag",
    nested: {
      message: "redirect https://example.com/path?token=secret failed",
    },
  });

  assert.deepEqual(sanitized, {
    destination: "https://example.com",
    nested: { message: "redirect https://example.com failed" },
  });
});

test("log context redacts sensitive keys and non-http connection strings", () => {
  const sanitized = sanitizeLogContext({
    authorization: "Bearer secret",
    headers: { cookie: "session=secret" },
    apiKey: "secret-key",
    query: "token=secret",
    mongo: "mongodb://user:pass@db.example/lynky?retryWrites=true",
  });

  assert.equal(sanitized.authorization, "<redacted>");
  assert.equal(sanitized.headers, "<redacted>");
  assert.equal(sanitized.apiKey, "<redacted>");
  assert.equal(sanitized.query, "<redacted>");
  assert.equal(sanitized.mongo, "<redacted-url>");
});

test("log context handles circular values without throwing", () => {
  const value: Record<string, unknown> = { ok: true };
  value.self = value;

  const sanitized = sanitizeLogContext(value);

  assert.equal(sanitized.ok, true);
  assert.equal(sanitized.self, "<circular>");
});
