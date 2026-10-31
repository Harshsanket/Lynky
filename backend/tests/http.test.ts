import test from "node:test";
import assert from "node:assert/strict";

import { extractBearerSecret } from "../src/utils/http.js";

const requestWith = (authorization?: string) =>
  ({ headers: { authorization } }) as any;

test("accepts the standard Bearer scheme", () => {
  assert.equal(
    extractBearerSecret(requestWith("Bearer secret-123")),
    "secret-123"
  );
});

test("accepts a lowercase bearer scheme", () => {
  assert.equal(
    extractBearerSecret(requestWith("bearer secret-123")),
    "secret-123"
  );
});

test("rejects missing, empty, and non-bearer headers", () => {
  assert.equal(extractBearerSecret(requestWith()), null);
  assert.equal(extractBearerSecret(requestWith("Bearer   ")), null);
  assert.equal(
    extractBearerSecret(requestWith("Basic abc")),
    null
  );
});
