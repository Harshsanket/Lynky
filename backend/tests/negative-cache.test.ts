import test from "node:test";
import assert from "node:assert/strict";

import {
  clearNegative,
  clearNegativeCacheForTests,
  isNegativelyCached,
  markNegative,
} from "../service/negative-cache.service.js";

test("marks and clears a code", () => {
  clearNegativeCacheForTests();

  assert.equal(isNegativelyCached("abc123"), false);

  markNegative("abc123");
  assert.equal(isNegativelyCached("abc123"), true);

  clearNegative("abc123");
  assert.equal(isNegativelyCached("abc123"), false);
});
