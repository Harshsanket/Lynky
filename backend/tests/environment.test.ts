import test from "node:test";
import assert from "node:assert/strict";

import {
  isProductionNodeEnv,
  normalizeNodeEnv,
} from "../src/config/environment.js";

test("normalises lowercase production", () => {
  assert.equal(normalizeNodeEnv("production"), "production");
  assert.equal(isProductionNodeEnv("production"), true);
});

test("normalises uppercase production", () => {
  assert.equal(normalizeNodeEnv("PRODUCTION"), "production");
  assert.equal(isProductionNodeEnv("PRODUCTION"), true);
});

test("defaults to development when unset", () => {
  assert.equal(normalizeNodeEnv(undefined), "development");
  assert.equal(isProductionNodeEnv(undefined), false);
});

test("treats development and test as non-production", () => {
  assert.equal(isProductionNodeEnv("development"), false);
  assert.equal(isProductionNodeEnv("test"), false);
  assert.equal(isProductionNodeEnv(" staging "), false);
});
