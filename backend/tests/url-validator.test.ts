import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.FRONTEND_URL = "https://app.lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.ALLOW_PRIVATE_SUFFIXES = "false";

const { validateUrl, getRejectionCounts } = await import(
  "../service/url-validator.service.js"
);
const {
  MESSAGES,
} = await import("../service/url-host-validator.service.js");
const { env } = await import("../src/config/env.js");

/**
 * Fixtures are shared with the frontend's `url-validation.test.js` so the two
 * implementations cannot drift. Keep both lists in sync (the backend asserts
 * stricter messages; the frontend asserts the boolean verdict + class).
 */

const validCases = [
  "https://example.net/path",
  "http://sub.example.co.uk/x?q=1",
  "http://9.9.9.9/",
  "https://example.net/",
];

/** [input, expected message fragment or `null` for "just rejects"] */
const rejectedCases: Array<[string, string | null]> = [
  // Non-URLs / protocols
  ["", null],
  ["   ", null],
  ["not a url", null],
  ["ftp://example.net/", null],
  ["data:text/html,hi", null],
  ["//example.net/x", null],

  // Control characters (C0/DEL/C1) + bidi overrides
  ["https://exa\u0000mple.net/", null],
  ["https://exa\u007Fmple.net/", null],
  ["https://exa\u0085mple.net/", null],
  ["https://exa\u202Emple.net/", null],
  ["ht\ttps://example.net/", null],
  ["https://example.net/\nx", null],

  // Backslash smuggling
  ["https:\\\\example.net", null],

  // Embedded credentials (including the empty-obfuscation `@` form)
  ["http://user:pass@example.net/", MESSAGES.credentials],
  ["http://user@example.net/", MESSAGES.credentials],
  ["http://:pass@example.net/", MESSAGES.credentials],
  ["http://@example.net/", MESSAGES.credentials],

  // Invalid hostnames (RFC 1123 shape)
  ["http://my_server.net/", null],
  ["http://-bad.net/", null],
  ["http://bad-.net/", null],
  ["http://a..b.net/", null],
  ["http://xn--fsq.net/", MESSAGES.idn],
  ["https://\u4F8B\u3048.jp/", MESSAGES.idn],

  // Localhost / loopback
  ["http://localhost/", MESSAGES.privateNetwork],
  ["http://sub.localhost/", MESSAGES.privateNetwork],
  ["http://localhost:8080/", MESSAGES.privateNetwork],
  ["http://127.0.0.1/", MESSAGES.privateNetwork],
  ["http://127.0.1.2/", MESSAGES.privateNetwork],
  ["http://[::1]/", MESSAGES.privateNetwork],
  ["http://0.0.0.0/", MESSAGES.privateNetwork],

  // Obfuscated IPs (WHATWG canonicalises these before checks run)
  ["http://2130706433/", MESSAGES.privateNetwork],
  ["http://0x7f.0.0.1/", MESSAGES.privateNetwork],
  ["http://0177.0.0.001/", MESSAGES.privateNetwork],
  ["http://0x7f000001/", MESSAGES.privateNetwork],
  ["http://[::ffff:127.0.0.1]/", MESSAGES.privateNetwork],
  ["http://[::ffff:10.0.0.1]/", MESSAGES.privateNetwork],

  // Private / special-use IPv4
  ["http://10.1.2.3/", MESSAGES.privateNetwork],
  ["http://172.16.0.5/", MESSAGES.privateNetwork],
  ["http://192.168.1.1/", MESSAGES.privateNetwork],
  ["http://100.64.0.1/", MESSAGES.privateNetwork],
  ["http://169.254.169.254/", MESSAGES.privateNetwork],
  ["http://192.0.2.11/", MESSAGES.privateNetwork],
  ["http://192.88.99.1/", MESSAGES.privateNetwork],
  ["http://198.18.0.3/", MESSAGES.privateNetwork],
  ["http://198.51.100.7/", MESSAGES.privateNetwork],
  ["http://203.0.113.9/", MESSAGES.privateNetwork],
  ["http://224.0.0.1/", MESSAGES.privateNetwork],
  ["http://240.0.0.1/", MESSAGES.privateNetwork],
  ["http://255.255.255.255/", MESSAGES.privateNetwork],

  // Private / special-use IPv6 (WHATWG requires brackets for IPv6 hosts)
  ["http://[::]/", MESSAGES.privateNetwork],
  ["http://[::7f00:1]/", MESSAGES.privateNetwork], // IPv4-compatible 127.0.0.1
  ["http://[::c0a8:101]/", MESSAGES.privateNetwork], // 192.168.1.1
  ["http://[::a00:1]/", MESSAGES.privateNetwork], // 10.0.0.1
  ["http://[fc00::1]/", MESSAGES.privateNetwork],
  ["http://[fe80::1]/", MESSAGES.privateNetwork],
  ["http://[ff02::1]/", MESSAGES.privateNetwork],
  ["http://[2001:db8::1]/", MESSAGES.privateNetwork],
  ["http://[2002:a00:1::]/", MESSAGES.privateNetwork], // 6to4 → 10.0.0.1
  [
    "http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/",
    MESSAGES.privateNetwork,
  ], // teredo

  // Internal / special-use hostnames
  ["http://foo.local/", MESSAGES.internal],
  ["http://service.internal/", MESSAGES.internal],
  ["http://db.lan/", MESSAGES.internal],
  ["http://app.home.arpa/", MESSAGES.internal],
  ["http://unit.test/", MESSAGES.internal],
  ["http://unit.example/", MESSAGES.internal],
  ["http://foo.invalid/", MESSAGES.internal],

  // No public suffix at all
  ["http://myserver/", null],
  ["http://myserver.corp/", null],

  // IPv6 zone / leftover percent-escapes in host
  ["http://[fe80::1%25eth0]/", null],
];

const expectReject = (input: string, expectedMessage: string | null) => {
  assert.throws(
    () => validateUrl(input),
    (error: unknown) => {
      assert.ok(
        error instanceof Error,
        `expected an Error for ${JSON.stringify(input)}, got ${String(error)}`
      );
      if (expectedMessage) {
        assert.equal(error.message, expectedMessage);
      }
      return true;
    },
    `expected rejection for ${JSON.stringify(input)}`
  );
};

test("accepts public internet URLs", () => {
  for (const input of validCases) {
    const parsed = validateUrl(input);

    assert.equal(parsed.protocol, new URL(input).protocol);
  }
});

test("rejects the whole validation matrix with human-readable messages", () => {
  for (const [input, expectedMessage] of rejectedCases) {
    expectReject(input, expectedMessage);
  }
});

test("URL is required surfaces as its own message", () => {
  assert.throws(
    () => validateUrl("!@#$"),
    /Invalid URL|internet address/
  );
});

test("exceeding MAX_URL_LENGTH is rejected for input", () => {
  const longUrl = `https://example.net/?pad=${"a".repeat(700)}`;

  assert.throws(
    () => validateUrl(longUrl),
    /maximum length/
  );
});

test("enforceMaxLength:false allows long already-cleaned URLs", () => {
  const longUrl = `https://example.net/?pad=${"a".repeat(700)}`;

  const parsed = validateUrl(longUrl, { enforceMaxLength: false });

  assert.equal(parsed.hostname, "example.net");
});

test("checkBlocklists:false skips screening without breaking the rest", () => {
  // With no blocklist files present both paths behave identically; this pins
  // the option contract so the redirect path can rely on it.
  const parsed = validateUrl("https://example.net/", {
    checkBlocklists: false,
  });

  assert.equal(parsed.hostname, "example.net");
});

test("ALLOW_PRIVATE_SUFFIXES gates private public-suffix hosts", () => {
  const previous = env.ALLOW_PRIVATE_SUFFIXES;

  try {
    env.ALLOW_PRIVATE_SUFFIXES = false;

    assert.throws(
      () => validateUrl("https://foo.eu.org/"),
      /internet address/
    );

    env.ALLOW_PRIVATE_SUFFIXES = true;

    assert.equal(
      validateUrl("https://foo.eu.org/").hostname,
      "foo.eu.org"
    );
  } finally {
    env.ALLOW_PRIVATE_SUFFIXES = previous;
  }
});

test("rejections increment the matching category counter", () => {
  const before = getRejectionCounts();

  expectReject("http://127.0.0.1/", MESSAGES.privateNetwork);
  expectReject("http://user:pass@example.net/", MESSAGES.credentials);
  expectReject("http://x\u0000y.example/", null);

  const after = getRejectionCounts();

  assert.equal(
    after.private_network,
    before.private_network + 1
  );
  assert.equal(after.credentials, before.credentials + 1);
  assert.equal(
    after.control_characters,
    before.control_characters + 1
  );
});
