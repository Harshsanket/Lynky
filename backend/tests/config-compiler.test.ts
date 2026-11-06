import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.BLOCKLIST_FAILURE_MODE = "open";

const { compileConfig } = await import(
  "../scripts/config/compiler.js"
);
const { loadCompiledArtifacts, ArtifactError } = await import(
  "../src/config/artifacts.js"
);
const { loadBlocklistEngine } = await import(
  "../service/engines/blocklist.engine.js"
);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(
  testDir,
  "fixtures",
  "config",
  "base"
);

const temporaryDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "lynky-compiled-"));

const compileFixture = (outDir: string) =>
  compileConfig({
    root: fixtureRoot,
    outDir,
    builtAt: "2026-01-01T00:00:00.000Z",
  });

test("compiles deterministic artifacts", () => {
  const first = temporaryDir();
  const second = temporaryDir();

  const left = compileFixture(first);
  const right = compileFixture(second);

  assert.deepEqual(left.manifest, right.manifest);

  for (const file of [
    "trackers.json",
    "providers.json",
    "allowlist.json",
    "policy.json",
    "blocklists.bin",
    "manifest.json",
  ]) {
    assert.deepEqual(
      fs.readFileSync(path.join(first, file)),
      fs.readFileSync(path.join(second, file)),
      `${file} must be byte-identical`
    );
  }

  fs.rmSync(first, { recursive: true, force: true });
  fs.rmSync(second, { recursive: true, force: true });
});

test("loads artifacts and matches blocklist hosts", () => {
  const outDir = temporaryDir();
  const result = compileFixture(outDir);
  const artifacts = loadCompiledArtifacts(outDir);
  const blocklist = loadBlocklistEngine(
    outDir,
    result.manifest
  );

  assert.equal(artifacts.manifest.artifactVersion, result.manifest.artifactVersion);
  assert.equal(artifacts.artifactHashValid, true);
  assert.equal(artifacts.manifest.counts.providers, 1);

  assert.equal(
    blocklist.check(new URL("https://blocked.example/path")).blocked,
    true
  );
  assert.equal(
    blocklist.check(new URL("https://sub.blocked.example/path")).blocked,
    true
  );
  assert.equal(
    blocklist.check(new URL("https://example.com/path")).blocked,
    false
  );

  fs.rmSync(outDir, { recursive: true, force: true });
});

test("loads the sorted-hash fallback index", () => {
  const outDir = temporaryDir();
  const result = compileConfig({
    root: fixtureRoot,
    outDir,
    indexKind: "sorted",
    builtAt: "2026-01-01T00:00:00.000Z",
  });
  const blocklist = loadBlocklistEngine(outDir, result.manifest);

  assert.equal(
    blocklist.check(new URL("https://sub.blocked.example/path")).blocked,
    true
  );
  assert.equal(
    blocklist.check(new URL("https://example.com/path")).blocked,
    false
  );

  fs.rmSync(outDir, { recursive: true, force: true });
});

test("rejects a tampered JSON artifact", () => {
  const outDir = temporaryDir();

  compileFixture(outDir);

  const trackersPath = path.join(outDir, "trackers.json");
  const trackers = JSON.parse(
    fs.readFileSync(trackersPath, "utf-8")
  );
  trackers.groups.lynky.exact.push("tampered");
  fs.writeFileSync(trackersPath, JSON.stringify(trackers));

  assert.throws(
    () => loadCompiledArtifacts(outDir),
    (error: unknown) =>
      error instanceof ArtifactError &&
      error.code === "artifact_hash_mismatch"
  );

  fs.rmSync(outDir, { recursive: true, force: true });
});
