import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "../src/config/config-validation.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(testDir, "fixtures", "config");

const copyFixture = (caseName?: string): string => {
  const target = fs.mkdtempSync(
    path.join(os.tmpdir(), "lynky-config-")
  );

  fs.cpSync(path.join(fixturesDir, "base"), target, {
    recursive: true,
  });

  if (caseName) {
    fs.cpSync(
      path.join(fixturesDir, "invalid", caseName),
      target,
      { recursive: true }
    );
  }

  return target;
};

const validateCase = (caseName: string) => {
  const root = copyFixture(caseName);
  const result = validateConfig(root);

  fs.rmSync(root, { recursive: true, force: true });

  return result;
};

test("the base fixture is valid", () => {
  const result = validateCase("");

  assert.equal(
    result.ok,
    true,
    result.errors
      .map((error) => `${error.file}:${error.field}:${error.message}`)
      .join("\n")
  );
});

const cases: Array<{
  name: string;
  code: string;
  field?: string;
}> = [
  {
    name: "missing-url-pattern",
    code: "invalid_type",
    field: "providers.0.urlPattern",
  },
  {
    name: "quoted-boolean",
    code: "invalid_type",
    field: "genericRedirectUnwrap",
  },
  {
    name: "string-allowlist",
    code: "invalid_type",
    field: "global",
  },
  {
    name: "oversized-max-depth",
    code: "too_big",
    field: "maxDepth",
  },
  {
    name: "empty-trackers",
    code: "empty_trackers",
    field: "exact",
  },
  {
    name: "invalid-regex",
    code: "invalid_regex",
    field: "providers.broken.urlPattern",
  },
  {
    name: "redirection-without-capture",
    code: "missing_capture_group",
    field: "providers.broken.redirections",
  },
  {
    name: "invalid-hostname",
    code: "invalid_key",
    field: "domains.Bad_Domain.com",
  },
  {
    name: "missing-required-blocklist",
    code: "blocklist_missing",
    field: "file",
  },
  {
    name: "empty-blocklist",
    code: "blocklist_too_small",
    field: "minEntries",
  },
  {
    name: "truncated-blocklist",
    code: "blocklist_too_small",
    field: "minEntries",
  },
  {
    name: "invalid-utf8-blocklist",
    code: "blocklist_unreadable",
    field: "file",
  },
  {
    name: "tld-only-blocklist",
    code: "blocklist_tld_only",
    field: "file",
  },
];

for (const fixture of cases) {
  test(`rejects the ${fixture.name} fixture with ${fixture.code}`, () => {
    const result = validateCase(fixture.name);

    assert.equal(result.ok, false);

    const matches = result.errors.filter(
      (error) => error.code === fixture.code
    );

    assert.ok(
      matches.length > 0,
      `expected ${fixture.code}; got ${result.errors
        .map((error) => `${error.field}:${error.code}`)
        .join(", ")}`
    );

    if (fixture.field) {
      assert.ok(
        matches.some((error) => error.field === fixture.field),
        `expected field ${fixture.field}; got ${matches
          .map((error) => error.field)
          .join(", ")}`
      );
    }
  });
}
