import test from "node:test";
import assert from "node:assert/strict";

import { redactUrl } from "../service/logger.js";

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
