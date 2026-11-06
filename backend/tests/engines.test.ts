import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.BLOCKLIST_FAILURE_MODE = "open";

const { TrackerEngine } = await import(
  "../service/engines/tracker.engine.js"
);
const { AllowlistEngine } = await import(
  "../service/engines/allowlist.engine.js"
);
const { ProviderEngine, RuleBucket } = await import(
  "../service/engines/provider.engine.js"
);
const { BlocklistEngine } = await import(
  "../service/engines/blocklist.engine.js"
);

const emptyBuckets = { exact: [], prefixes: [], regex: [] };

test("TrackerEngine uses exact, prefix, regex, and URL exceptions", () => {
  const engine = new TrackerEngine({
    lynky: {
      exact: ["fbclid"],
      prefixes: ["utm_"],
      patterns: ["^_ga(?:_|$)"],
      exceptions: [],
    },
    clearurlsGlobal: {
      exact: [],
      prefixes: [],
      patterns: ["^(?:ref_?)$"],
      exceptions: ["^https?:\\/\\/github\\.com"],
    },
  });

  assert.equal(engine.matches("FBCLID"), true);
  assert.equal(engine.matches("utm_source"), true);
  assert.equal(engine.matches("_ga_foo"), true);
  assert.equal(engine.matches("ref"), true);
  assert.equal(
    engine.matches("ref", "https://github.com/owner/repo"),
    false
  );
  assert.equal(engine.matches("ref", "https://example.com/"), true);
  assert.equal(engine.matches("unrelated"), false);
});

test("AllowlistEngine merges global and parent-domain parameters", () => {
  const engine = new AllowlistEngine({
    schemaVersion: 1,
    global: ["gclid"],
    domains: {
      "youtube.com": ["v"],
      "example.com": ["id"],
    },
  });

  const youtube = engine.forHost("www.youtube.com");
  assert.equal(youtube.has("v"), true);
  assert.equal(youtube.has("gclid"), true);
  assert.equal(youtube.has("id"), false);

  assert.equal(engine.isAllowed("sub.example.com", "id"), true);
  assert.equal(engine.isAllowed("example.com", "other"), false);
});

test("RuleBucket matches literal, prefix, and regex rules", () => {
  const bucket = new RuleBucket({
    exact: ["qid"],
    prefixes: ["utm_"],
    regex: ["^(?:srs?)$"],
  });

  assert.equal(bucket.matches("QID"), true);
  assert.equal(bucket.matches("utm_source"), true);
  assert.equal(bucket.matches("sr"), true);
  assert.equal(bucket.matches("srs"), true);
  assert.equal(bucket.matches("other"), false);
});

test("ProviderEngine prefilters by host but still verifies the regex and order", () => {
  const engine = new ProviderEngine({
    schemaVersion: 1,
    providers: [
      {
        id: "example",
        urlPattern: "^https?:\\/\\/example\\.com",
        hostHints: ["example.com"],
        completeProvider: false,
        rules: emptyBuckets,
        referralMarketing: emptyBuckets,
        exceptions: [],
        redirections: [],
        rawRules: [],
      },
      {
        id: "google-stem",
        urlPattern: "^https?:\\/\\/.*\\.?google\\.[a-z.]+",
        hostHints: ["google"],
        completeProvider: false,
        rules: emptyBuckets,
        referralMarketing: emptyBuckets,
        exceptions: [],
        redirections: [],
        rawRules: [],
      },
      {
        id: "fallback",
        urlPattern: "^https?:\\/\\/fallback\\.example",
        hostHints: [],
        completeProvider: false,
        rules: emptyBuckets,
        referralMarketing: emptyBuckets,
        exceptions: [],
        redirections: [],
        rawRules: [],
      },
      {
        id: "unrelated-hint",
        urlPattern: "^https?:\\/\\/",
        hostHints: ["never.example"],
        completeProvider: false,
        rules: emptyBuckets,
        referralMarketing: emptyBuckets,
        exceptions: [],
        redirections: [],
        rawRules: [],
      },
    ],
  });

  assert.deepEqual(
    engine
      .match("https://example.com/x", "example.com")
      .map((provider) => provider.artifact.id),
    ["example"]
  );

  assert.deepEqual(
    engine
      .match("https://www.google.com/search", "www.google.com")
      .map((provider) => provider.artifact.id),
    ["google-stem"]
  );

  assert.deepEqual(
    engine
      .match("https://fallback.example/x", "fallback.example")
      .map((provider) => provider.artifact.id),
    ["fallback"]
  );

  assert.deepEqual(
    engine
      .match("https://example.com/x", "example.com")
      .map((provider) => provider.artifact.id)
      .includes("unrelated-hint"),
    false
  );
});

test("an unavailable blocklist fails open with a degraded status", () => {
  const engine = BlocklistEngine.unavailable("simulated failure");
  const result = engine.check(new URL("https://example.com/"));

  assert.equal(result.blocked, false);
  assert.equal(result.status, "degraded");

  const state = engine.getState();
  assert.equal(state.status, "degraded");
  assert.equal(state.decision, "allow");
  assert.equal(state.counters.load_errors >= 0, true);
});
