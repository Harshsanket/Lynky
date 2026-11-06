import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.BLOCKLIST_FAILURE_MODE = "closed";

const { BlocklistEngine } = await import(
  "../service/engines/blocklist.engine.js"
);

test("BLOCKLIST_FAILURE_MODE=closed rejects create traffic when unavailable", () => {
  const engine = BlocklistEngine.unavailable("simulated failure");
  const result = engine.check(new URL("https://example.com/"));

  assert.equal(result.blocked, true);
  assert.equal(result.status, "closed");

  const state = engine.getState();
  assert.equal(state.status, "degraded");
  assert.equal(state.decision, "block");
});
