import test from "node:test";
import assert from "node:assert/strict";

import { buildApiKeyMailto } from "./api-key-mail.js";

const secret = "x7Yt2bQ9-secret-value_1234567890ABCDEFGHIJ";
const apiBaseUrl = "https://short-lynky-hs.vercel.app";
const apiGuideUrl = "https://lynky-hs.vercel.app/api";
const monthlyLimit = 10000;

const mail = buildApiKeyMailto({
  secret,
  apiBaseUrl,
  apiGuideUrl,
  monthlyLimit,
});

test("uses the fixed subject and greeting without the stored key name", () => {
  assert.equal(mail.subject, "Your Lynky API key");
  assert.ok(
    mail.body.startsWith(
      "Welcome to Lynky secret club\n\nHere is your Lynky API key — keep it safe; it\nis shown only once."
    ),
    mail.body
  );
  assert.equal(mail.body.includes("Acme campaign"), false);
});

test("contains the how-to steps, API base, guide link, and limit", () => {
  for (const line of [
    `1. Shorten a link: POST ${apiBaseUrl}/api/v1/api/urls`,
    "   Header: Authorization: Bearer <your key>",
    '   Body: {"url": "https://example.com/your-long-link"}',
    "   The response returns the short link.",
    `2. Check usage any time: GET ${apiBaseUrl}/api/v1/api/stats/usage`,
    "   Monthly limit: 10,000 links, resetting each month.",
    `Full API guide: ${apiGuideUrl}`,
    "Your API key:",
  ]) {
    assert.ok(mail.body.split("\n").includes(line), line);
  }

  assert.ok(mail.body.includes("/api"));
});

test("puts the secret last before the signature", () => {
  const lines = mail.body.split("\n");

  assert.equal(lines[lines.length - 1], "a Harsh Sanket production");
  assert.equal(lines[lines.length - 2], "");
  assert.equal(lines[lines.length - 3], secret);
  assert.equal(lines[lines.length - 4], "Your API key:");
});

test("renders the monthly limit from the parameter", () => {
  const smallLimit = buildApiKeyMailto({
    secret,
    apiBaseUrl,
    apiGuideUrl,
    monthlyLimit: 250,
  });

  assert.ok(
    smallLimit.body
      .split("\n")
      .includes("   Monthly limit: 250 links, resetting each month.")
  );
});

test("trims the base URL and encodes both mailto parameters", () => {
  const trailing = buildApiKeyMailto({
    secret,
    apiBaseUrl: `${apiBaseUrl}/`,
    apiGuideUrl,
    monthlyLimit,
  });

  assert.ok(trailing.body.includes(`POST ${apiBaseUrl}/api/v1/api/urls`));
  assert.ok(
    mail.href.startsWith("mailto:?subject="),
    "recipient must be left empty"
  );

  const query = mail.href.slice("mailto:?".length);
  const params = new URLSearchParams(query);

  assert.equal(params.get("subject"), "Your Lynky API key");
  assert.equal(params.get("body"), mail.body);
});
