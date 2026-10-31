import test from "node:test";
import assert from "node:assert/strict";

import { loadEnv } from "../src/config/env-loader.js";

const baseEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/lynky-test",
  ENCRYPTION_KEY: "test-encryption-key",
  PUBLIC_URL: "http://localhost:5001",
  EXPIRATION_DAYS: "7",
};

test("treats lowercase production as production", () => {
  const env = loadEnv({
    ...baseEnv,
    NODE_ENV: "production",
    FRONTEND_URL: "https://lynky.example",
  });

  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.isProduction, true);
  assert.deepEqual(env.ALLOWED_ORIGINS, ["https://lynky.example"]);
});

test("treats uppercase production as production", () => {
  const env = loadEnv({
    ...baseEnv,
    NODE_ENV: "PRODUCTION",
    FRONTEND_URL: "https://lynky.example",
  });

  assert.equal(env.isProduction, true);
});

test("requires FRONTEND_URL in production", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, NODE_ENV: "production" }),
    /FRONTEND_URL is not configured/
  );
});

test("normalises a trailing slash on FRONTEND_URL", () => {
  const env = loadEnv({
    ...baseEnv,
    NODE_ENV: "production",
    FRONTEND_URL: "https://lynky.example/",
  });

  assert.deepEqual(env.ALLOWED_ORIGINS, ["https://lynky.example"]);
});

test("allows local development without FRONTEND_URL", () => {
  const env = loadEnv(baseEnv);

  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.isProduction, false);
  assert.deepEqual(env.ALLOWED_ORIGINS, ["http://localhost:5173"]);
});

test("respects a configured API key length", () => {
  const env = loadEnv({ ...baseEnv, API_KEY_LENGTH: "64" });

  assert.equal(env.API_KEY_LENGTH, 64);
});

test("rejects an invalid MONGODB_URI", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, MONGODB_URI: "https://example.com" }),
    /MONGODB_URI is invalid/
  );
});

test("defaults a non-positive monthly limit", () => {
  const env = loadEnv({
    ...baseEnv,
    API_KEY_MONTHLY_LIMIT: "-1",
  });

  assert.equal(env.API_KEY_MONTHLY_LIMIT, 10000);
});

test("rejects an invalid port", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, PORT: "70000" }),
    /PORT is not configured correctly/
  );
});

test("rejects an invalid code attempt count", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, MAX_CODE_ATTEMPTS: "0" }),
    /MAX_CODE_ATTEMPTS is not configured correctly/
  );
});

test("rejects a key length larger than the UI limit", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, API_KEY_LENGTH: "513" }),
    /API_KEY_LENGTH must be between 16 and 512/
  );
});

test("rejects a code length beyond the generator's entropy", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, MAX_CODE_LENGTH: "9" }),
    /MAX_CODE_LENGTH must be <= 8/
  );
});
