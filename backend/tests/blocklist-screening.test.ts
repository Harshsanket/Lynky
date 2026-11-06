import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.BLOCKLIST_FAILURE_MODE = "open";

const { screenBlocklist } = await import(
  "../service/blocklist-screening.service.js"
);

test("compiled screening blocks a listed host and allows a clean host", () => {
  const blocked = screenBlocklist(
    new URL("https://cdn.zzztube.tv/asset.js")
  );
  const clean = screenBlocklist(new URL("https://example.com/"));

  assert.equal(blocked.blocked, true);
  assert.equal(blocked.status, "ok");
  assert.equal(clean.blocked, false);
  assert.equal(clean.status, "ok");
});
