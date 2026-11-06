import test from "node:test";
import assert from "node:assert/strict";

import { loadEnv } from "../src/config/env-loader.js";

const baseEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/lynky-test",
  ENCRYPTION_KEY: "test-encryption-key-0123456789abcdef",
  PUBLIC_URL: "http://localhost:5001",
  EXPIRATION_DAYS: "7",
};

const upstashEnv = {
  UPSTASH_REDIS_REST_URL: "https://upstash.example",
  UPSTASH_REDIS_REST_TOKEN: "test-token",
};

test("treats lowercase production as production", () => {
  const env = loadEnv({
    ...baseEnv,
    ...upstashEnv,
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
    ...upstashEnv,
    NODE_ENV: "PRODUCTION",
    FRONTEND_URL: "https://lynky.example",
  });

  assert.equal(env.isProduction, true);
});

test("requires FRONTEND_URL in production", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, ...upstashEnv, NODE_ENV: "production" }),
    /FRONTEND_URL is not configured/
  );
});

test("normalises a trailing slash on FRONTEND_URL", () => {
  const env = loadEnv({
    ...baseEnv,
    ...upstashEnv,
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
    /API_KEY_LENGTH must be an integer between 16 and 512/
  );
});

test("rejects non-integer numeric configuration", () => {
  for (const [name, value] of [
    ["API_KEY_LENGTH", "45.5"],
    ["MIN_CODE_LENGTH", "4.5"],
    ["MAX_CODE_LENGTH", "5.5"],
    ["MAX_CODE_ATTEMPTS", "2.5"],
    ["MAX_URL_LENGTH", "640.5"],
  ] as const) {
    assert.throws(
      () => loadEnv({ ...baseEnv, [name]: value }),
      /not configured correctly|must be an integer/,
      `${name}=${value} should be rejected`
    );
  }
});

test("rejects unknown NODE_ENV values", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, NODE_ENV: "staging" }),
    /NODE_ENV must be one of/
  );
});

test("requires a strong enough encryption key", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, ENCRYPTION_KEY: "short-key" }),
    /ENCRYPTION_KEY must be at least 32 characters/
  );
});

test("validates PUBLIC_URL shape", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, PUBLIC_URL: "not a url" }),
    /PUBLIC_URL must be a valid/
  );

  assert.throws(
    () =>
      loadEnv({
        ...baseEnv,
        PUBLIC_URL: "https://example.com/?token=1",
      }),
    /PUBLIC_URL must be a valid/
  );

  const env = loadEnv({
    ...baseEnv,
    PUBLIC_URL: "https://example.com/lynky/",
  });

  assert.equal(env.PUBLIC_URL, "https://example.com/lynky");
});

test("validates FRONTEND_URL as an origin", () => {
  assert.throws(
    () =>
      loadEnv({
        ...baseEnv,
        ...upstashEnv,
        NODE_ENV: "production",
        FRONTEND_URL: "https://example.com/path",
      }),
    /FRONTEND_URL must be a valid http\(s\) origin/
  );

  const env = loadEnv({
    ...baseEnv,
    ...upstashEnv,
    NODE_ENV: "production",
    FRONTEND_URL: "https://example.com/",
  });

  assert.equal(env.FRONTEND_URL, "https://example.com");
});

test("development CORS includes a configured FRONTEND_URL", () => {
  const env = loadEnv({
    ...baseEnv,
    FRONTEND_URL: "http://localhost:4173/",
  });

  assert.deepEqual(env.ALLOWED_ORIGINS, [
    "http://localhost:5173",
    "http://localhost:4173",
  ]);
});

test("rejects a code length beyond the generator's entropy", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, MAX_CODE_LENGTH: "9" }),
    /MAX_CODE_LENGTH must be <= 8/
  );
});

test("private public suffixes are rejected by default", () => {
  const env = loadEnv(baseEnv);

  assert.equal(env.ALLOW_PRIVATE_SUFFIXES, false);
});

test("ALLOW_PRIVATE_SUFFIXES accepts 1/true in any case", () => {
  for (const value of ["1", "true", "TRUE", " True "]) {
    const env = loadEnv({
      ...baseEnv,
      ALLOW_PRIVATE_SUFFIXES: value,
    });

    assert.equal(env.ALLOW_PRIVATE_SUFFIXES, true, value);
  }

  for (const value of ["0", "false", "", "yes"]) {
    const env = loadEnv({
      ...baseEnv,
      ALLOW_PRIVATE_SUFFIXES: value,
    });

    assert.equal(env.ALLOW_PRIVATE_SUFFIXES, false, value);
  }
});
