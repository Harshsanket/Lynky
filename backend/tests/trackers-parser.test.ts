import test from "node:test";
import assert from "node:assert/strict";

import { parseTrackerSources } from "../scripts/config/trackers-parser.js";

const parse = (text: string) =>
  parseTrackerSources([{ file: "fixture.txt", text }]);

test("parses generic literals, prefixes, key regexes, and pair regexes", () => {
  const parsed = parse(`
$removeparam=utm_source
$removeparam=/^at_custom/
$removeparam=/^source=newsletter$/i
$removeparam=/^CJEVENT=.*$/
`);

  assert.deepEqual(parsed.generic.exact, ["utm_source"]);
  assert.deepEqual(parsed.generic.prefixes, ["at_custom"]);
  assert.deepEqual(parsed.generic.pairPatterns, [
    "^CJEVENT=.*$",
    "^source=newsletter$",
  ]);
});

test("creates host-scoped providers and pair buckets", () => {
  const parsed = parse(`
||flugladen.de/checkout/metalanding$removeparam=subch
||1800contacts.com^$removeparam=/^partnerid=.*$/
`);

  assert.equal(parsed.providers.length, 2);
  const flugladen = parsed.providers.find((provider) =>
    provider.hostHints.includes("flugladen.de")
  );
  const contacts = parsed.providers.find((provider) =>
    provider.hostHints.includes("1800contacts.com")
  );

  assert.ok(flugladen);
  assert.deepEqual(flugladen.rules, ["subch"]);
  assert.match(flugladen.urlPattern, /flugladen/);
  assert.ok(contacts);
  assert.deepEqual(contacts.pairPatterns, ["^partnerid=.*$"]);
});

test("maps host exceptions to allowlist domains and query exceptions to group exceptions", () => {
  const parsed = parse(`
@@||eneba.com^$removeparam=utm_source
@@||archive.*^$removeparam
@@^mkt_unsubscribe=$removeparam=mkt_tok
`);

  assert.deepEqual(parsed.allowlistExceptions["eneba.com"], [
    "utm_source",
  ]);
  assert.deepEqual(parsed.allowlistExceptions["archive"], ["*"]);
  assert.equal(parsed.generic.exceptions.length, 1);
  assert.match(parsed.generic.exceptions[0]!, /\?mkt_unsubscribe=/);
});

test("converts unrepresentable exceptions into host-wide allowlist entries", () => {
  const parsed = parse(`
@@||shopify.com/authentication/$removeparam=analytics_trace_id
@@$removeparam=utm_source,domain=hobbygames.ru|example.org
`);

  assert.deepEqual(parsed.allowlistExceptions["shopify.com"], [
    "analytics_trace_id",
  ]);
  assert.deepEqual(parsed.allowlistExceptions["hobbygames.ru"], [
    "utm_source",
  ]);
  assert.deepEqual(parsed.allowlistExceptions["example.org"], [
    "utm_source",
  ]);
  assert.equal(parsed.report.counts.exceptionConversions, 3);
  assert.equal(
    parsed.report.conversions.some(
      (entry) => entry.source === "path_scoped_exception"
    ),
    true
  );
});

test("rejects negative-domain exceptions because preserve-except cannot be safe", () => {
  const parsed = parse(`
@@$removeparam=utm_source,domain=~safe.example
`);

  assert.equal(
    parsed.report.rejections.negative_domain_exception,
    1
  );
  assert.equal(parsed.report.counts.exceptionConversions, 0);
});

test("keeps negative domains as generic excludeHosts", () => {
  const parsed = parse(`
$removeparam=utm_medium,domain=~univis.example|~other.example
`);

  assert.deepEqual(parsed.generic.exact, ["utm_medium"]);
  assert.deepEqual(parsed.generic.excludeHosts, [
    "other.example",
    "univis.example",
  ]);
});

test("rejects resource-restricted, bare, and unknown modifiers", () => {
  const parsed = parse(`
||example.com^$image,removeparam=foo
||example.com^$removeparam
||example.com^$removeheader=request:referer
`);

  assert.equal(parsed.providers.length, 0);
  assert.equal(parsed.report.rejections.resource_restricted, 1);
  assert.equal(parsed.report.rejections.bare_removeparam, 1);
  assert.equal(
    parsed.report.rejections["unsupported_modifier:removeheader"],
    1
  );
});

test("evaluates platform conditionals with the server capability set", () => {
  const parsed = parse(`
!#if ext_ubol
$removeparam=skipped_by_condition
!#endif
!#if !ext_ubol
$removeparam=included_by_condition
!#endif
`);

  assert.deepEqual(parsed.generic.exact, ["included_by_condition"]);
});

test("reports a removal/exception conflict as preserve", () => {
  const parsed = parse(`
||shop.example^$removeparam=tag
@@||shop.example^$removeparam=tag
`);

  assert.equal(parsed.report.conflicts.length, 1);
  assert.deepEqual(parsed.report.conflicts[0], {
    host: "shop.example",
    key: "tag",
    removal: "tag",
    exception: "tag",
    resolution: "preserve",
  });
});

test("normalizes malformed literals instead of emitting invalid regexes", () => {
  const parsed = parse(`
||wikihow.com^$removeparam=?utm_source
$removeparam=not a key
`);

  assert.equal(parsed.providers.length, 1);
  assert.deepEqual(parsed.providers[0]!.rules, ["utm_source"]);
  assert.equal(parsed.report.rejections.invalid_removeparam, 1);
});
