import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "../src/config/env-loader.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

const readEnvFile = (filePath: string): Record<string, string> => {
  const values: Record<string, string> = {};

  for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }

  return values;
};

const baseEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/lynky-test",
  ENCRYPTION_KEY: "test-encryption-key-0123456789abcdef",
  PUBLIC_URL: "http://localhost:5001",
  EXPIRATION_DAYS: "7",
};

test("frontend request-shape values match the backend contract", () => {
  const env = loadEnv(baseEnv);
  const frontend = readEnvFile(
    path.join(testDir, "..", "..", "frontend", ".env.example")
  );
  const backend = readEnvFile(
    path.join(testDir, "..", ".env.example")
  );

  assert.equal(
    Number(frontend.VITE_API_KEY_LENGTH),
    env.API_KEY_LENGTH
  );
  assert.equal(
    Number(frontend.VITE_MAX_URL_LENGTH),
    env.MAX_URL_LENGTH
  );
  assert.equal(
    Number(backend.API_KEY_LENGTH),
    env.API_KEY_LENGTH
  );
  assert.equal(
    Number(backend.GLOBAL_RATE_LIMIT_PER_HOUR),
    env.GLOBAL_RATE_LIMIT_PER_HOUR
  );
});

test("defaults cache and click settings", () => {
  const env = loadEnv(baseEnv);

  assert.equal(env.REDIS_URL, undefined);
  assert.equal(env.GLOBAL_RATE_LIMIT_PER_HOUR, 5000);
  assert.equal(env.HOT_VISIT_THRESHOLD, 4);
  assert.equal(env.HOT_WINDOW_SECONDS, 300);
  assert.equal(env.HOT_CACHE_TTL_SECONDS, 900);
  assert.equal(env.CLICK_STORAGE_MODE, "hybrid");
  assert.equal(env.CLICK_FLUSH_EVERY_N, 10);
  assert.equal(env.CLICK_PENDING_TTL_SECONDS, 86400);
  assert.equal(env.SYSADMIN_ENABLED, false);
});

test("accepts a redis URL and validates its protocol", () => {
  const env = loadEnv({
    ...baseEnv,
    REDIS_URL: "rediss://default:secret@redis.example:6380",
  });

  assert.match(env.REDIS_URL ?? "", /^rediss:\/\//);

  assert.throws(
    () => loadEnv({ ...baseEnv, REDIS_URL: "https://example.com" }),
    /REDIS_URL must be a valid/
  );
});

test("rejects invalid numeric cache settings", () => {
  for (const [name, value] of [
    ["GLOBAL_RATE_LIMIT_PER_HOUR", "0"],
    ["HOT_VISIT_THRESHOLD", "1.5"],
    ["HOT_WINDOW_SECONDS", "0"],
    ["HOT_CACHE_TTL_SECONDS", "999999"],
    ["CLICK_FLUSH_EVERY_N", "0"],
    ["CLICK_FLUSH_INTERVAL_MS", "1.2"],
    ["CLICK_PENDING_TTL_SECONDS", "0"],
  ] as const) {
    assert.throws(
      () => loadEnv({ ...baseEnv, [name]: value }),
      /must be an integer/,
      `${name}=${value}`
    );
  }
});

test("validates the click storage mode", () => {
  for (const mode of ["hybrid", "exact", "dynamic"]) {
    const env = loadEnv({ ...baseEnv, CLICK_STORAGE_MODE: mode });
    assert.equal(env.CLICK_STORAGE_MODE, mode);
  }

  assert.throws(
    () => loadEnv({ ...baseEnv, CLICK_STORAGE_MODE: "sometimes" }),
    /CLICK_STORAGE_MODE must be one of/
  );
});

test("requires sysadmin credentials only when enabled", () => {
  assert.throws(
    () => loadEnv({ ...baseEnv, SYSADMIN_ENABLED: "true" }),
    /SYSADMIN_USERNAME is required/
  );

  assert.throws(
    () =>
      loadEnv({
        ...baseEnv,
        SYSADMIN_ENABLED: "true",
        SYSADMIN_USERNAME: "Bad Name",
      }),
    /SYSADMIN_USERNAME must be/
  );

  assert.throws(
    () =>
      loadEnv({
        ...baseEnv,
        SYSADMIN_ENABLED: "true",
        SYSADMIN_USERNAME: "ops.a",
        SYSADMIN_PASSWORD_HASH: "not-a-hash",
      }),
    /SYSADMIN_PASSWORD_HASH must use/
  );

  const env = loadEnv({
    ...baseEnv,
    SYSADMIN_ENABLED: "true",
    SYSADMIN_USERNAME: "ops.a",
    SYSADMIN_PASSWORD_HASH: `scrypt:${"a".repeat(32)}:${"b".repeat(128)}`,
  });

  assert.equal(env.SYSADMIN_ENABLED, true);
  assert.equal(env.SYSADMIN_USERNAME, "ops.a");
});
