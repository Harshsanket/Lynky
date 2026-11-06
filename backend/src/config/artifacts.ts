import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACT_SCHEMA_VERSION, ENGINE_VERSION } from "./engine-version.js";
import type {
  AllowlistArtifact,
  ArtifactManifest,
  LoadedArtifacts,
  PolicyArtifact,
  ProvidersArtifact,
  TrackersArtifact,
} from "./artifact-types.js";

/**
 * Runtime artifact loader for the compiled config engine.
 *
 * Trackers/providers/allowlist/policy fail closed on any structural problem.
 * The blocklist binary is loaded by BlocklistEngine so its failures can be
 * handled fail-open (or fail-closed via BLOCKLIST_FAILURE_MODE).
 */

const ARTIFACT_FILES = [
  "trackers.json",
  "providers.json",
  "allowlist.json",
  "policy.json",
  "blocklists.bin",
] as const;

const JSON_ARTIFACT_FILES = [
  "trackers.json",
  "providers.json",
  "allowlist.json",
  "policy.json",
] as const;

export class ArtifactError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ArtifactError";
    this.code = code;
  }
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const uniqueExisting = (candidates: string[]): string | undefined => {
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);

    if (seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);

    try {
      if (
        fs.statSync(resolved).isDirectory() &&
        fs.existsSync(path.join(resolved, "manifest.json"))
      ) {
        return resolved;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
};

export const resolveCompiledDir = (dir?: string): string | undefined => {
  if (dir) {
    return uniqueExisting([dir]);
  }

  return uniqueExisting([
    path.join(moduleDir, "..", "..", "config", "compiled"),
    path.join(moduleDir, "..", "..", "dist", "config", "compiled"),
    path.join(process.cwd(), "config", "compiled"),
    path.join(process.cwd(), "dist", "config", "compiled"),
    path.join(process.cwd(), "backend", "dist", "config", "compiled"),
  ]);
};

const readJson = <T>(dir: string, file: string): T => {
  const filePath = path.join(dir, file);

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (error) {
    throw new ArtifactError(
      "artifact_read_error",
      `cannot read ${file}: ${(error as Error).message}`
    );
  }
};

const sha256 = (content: Buffer): string =>
  crypto.createHash("sha256").update(content).digest("hex");

const hashFileInto = (
  hash: crypto.Hash,
  filePath: string
): void => {
  const fd = fs.openSync(filePath, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);

  try {
    let position = 0;

    while (true) {
      const bytesRead = fs.readSync(
        fd,
        chunk,
        0,
        chunk.byteLength,
        position
      );

      if (bytesRead === 0) {
        break;
      }

      hash.update(chunk.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    fs.closeSync(fd);
  }
};

export const computeCombinedArtifactHash = (dir: string): string => {
  const hash = crypto.createHash("sha256");

  for (const file of ARTIFACT_FILES) {
    hash.update(`${file}\0`, "utf-8");
    hashFileInto(hash, path.join(dir, file));
  }

  return hash.digest("hex");
};

const compareVersions = (left: string, right: string): number => {
  const leftParts = left.split(/[.-]/);
  const rightParts = right.split(/[.-]/);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index++) {
    const leftValue = Number(leftParts[index] ?? 0);
    const rightValue = Number(rightParts[index] ?? 0);

    if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
      continue;
    }

    const comparison = String(leftParts[index] ?? "").localeCompare(
      String(rightParts[index] ?? "")
    );

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
};

const assertStringArray = (
  value: unknown,
  label: string
): string[] => {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new ArtifactError(
      "artifact_shape_error",
      `${label} must be an array of strings`
    );
  }

  return value;
};

const assertTrackers = (value: TrackersArtifact): TrackersArtifact => {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    !value.groups
  ) {
    throw new ArtifactError(
      "artifact_shape_error",
      "trackers.json has an unsupported shape"
    );
  }

  for (const group of ["lynky", "clearurlsGlobal"] as const) {
    const candidate = value.groups[group];

    if (!candidate) {
      throw new ArtifactError(
        "artifact_shape_error",
        `trackers.json is missing ${group}`
      );
    }

    assertStringArray(candidate.exact, `trackers.${group}.exact`);
    assertStringArray(candidate.prefixes, `trackers.${group}.prefixes`);
    assertStringArray(candidate.patterns, `trackers.${group}.patterns`);
    assertStringArray(
      candidate.exceptions,
      `trackers.${group}.exceptions`
    );
  }

  return value;
};

const assertRuleBuckets = (
  value: unknown,
  label: string
): void => {
  if (!value || typeof value !== "object") {
    throw new ArtifactError(
      "artifact_shape_error",
      `${label} must be an object`
    );
  }

  const candidate = value as Record<string, unknown>;
  assertStringArray(candidate.exact, `${label}.exact`);
  assertStringArray(candidate.prefixes, `${label}.prefixes`);
  assertStringArray(candidate.regex, `${label}.regex`);
};

const assertProviders = (value: ProvidersArtifact): ProvidersArtifact => {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    !Array.isArray(value.providers)
  ) {
    throw new ArtifactError(
      "artifact_shape_error",
      "providers.json has an unsupported shape"
    );
  }

  value.providers.forEach((provider, index) => {
    if (
      !provider ||
      typeof provider.id !== "string" ||
      typeof provider.urlPattern !== "string" ||
      typeof provider.completeProvider !== "boolean"
    ) {
      throw new ArtifactError(
        "artifact_shape_error",
        `providers[${index}] has an unsupported shape`
      );
    }

    assertStringArray(provider.hostHints, `providers[${index}].hostHints`);
    assertRuleBuckets(provider.rules, `providers[${index}].rules`);
    assertRuleBuckets(
      provider.referralMarketing,
      `providers[${index}].referralMarketing`
    );
    assertStringArray(provider.exceptions, `providers[${index}].exceptions`);
    assertStringArray(
      provider.redirections,
      `providers[${index}].redirections`
    );
    assertStringArray(provider.rawRules, `providers[${index}].rawRules`);
  });

  return value;
};

const assertAllowlist = (value: AllowlistArtifact): AllowlistArtifact => {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    !value.domains ||
    typeof value.domains !== "object"
  ) {
    throw new ArtifactError(
      "artifact_shape_error",
      "allowlist.json has an unsupported shape"
    );
  }

  assertStringArray(value.global, "allowlist.global");

  for (const [domain, parameters] of Object.entries(value.domains)) {
    assertStringArray(parameters, `allowlist.domains.${domain}`);
  }

  return value;
};

const assertPolicy = (value: PolicyArtifact): PolicyArtifact => {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    !Number.isInteger(value.maxDepth) ||
    value.maxDepth < 1 ||
    value.maxDepth > 5 ||
    typeof value.genericRedirectUnwrap !== "boolean" ||
    typeof value.removeJunkFragments !== "boolean"
  ) {
    throw new ArtifactError(
      "artifact_shape_error",
      "policy.json has an unsupported shape"
    );
  }

  assertStringArray(
    value.genericUnwrapParameters,
    "policy.genericUnwrapParameters"
  );

  return value;
};

const verifyJsonHashes = (
  dir: string,
  manifest: ArtifactManifest
): void => {
  if (!manifest.artifactFiles) {
    return;
  }

  for (const file of JSON_ARTIFACT_FILES) {
    const expected = manifest.artifactFiles[file];

    if (!expected) {
      throw new ArtifactError(
        "artifact_hash_mismatch",
        `manifest has no hash for ${file}`
      );
    }

    const content = fs.readFileSync(path.join(dir, file));

    if (content.byteLength !== expected.bytes) {
      throw new ArtifactError(
        "artifact_hash_mismatch",
        `${file} size mismatch`
      );
    }

    if (sha256(content) !== expected.sha256) {
      throw new ArtifactError(
        "artifact_hash_mismatch",
        `${file} hash mismatch`
      );
    }
  }
};

let compiledArtifactsSchema:
  | typeof import("./schemas/compiled.js").compiledArtifactsSchema
  | null = null;

if (
  ["1", "true"].includes(
    (process.env.CONFIG_FULL_RUNTIME_VALIDATION ?? "")
      .trim()
      .toLowerCase()
  )
) {
  const module = await import("./schemas/compiled.js");
  compiledArtifactsSchema = module.compiledArtifactsSchema;
}

const fullRuntimeValidation = (
  _dir: string,
  manifest: ArtifactManifest,
  trackers: TrackersArtifact,
  providers: ProvidersArtifact,
  allowlist: AllowlistArtifact,
  policy: PolicyArtifact
): void => {
  if (!compiledArtifactsSchema) {
    return;
  }

  const result = compiledArtifactsSchema.safeParse({
    manifest,
    trackers,
    providers,
    allowlist,
    policy,
  });

  if (!result.success) {
    throw new ArtifactError(
      "artifact_shape_error",
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
    );
  }
};

export const loadCompiledArtifacts = (
  dir?: string
): LoadedArtifacts => {
  // The loader is also the cold-start assertion: it validates versions,
  // per-file hashes, shapes, counts, and (in BlocklistEngine) typed-array
  // lengths before any create traffic is served.
  const resolved = resolveCompiledDir(dir);

  if (!resolved) {
    throw new ArtifactError(
      "artifact_missing",
      "compiled config artifacts were not found; run `npm run config:compile`"
    );
  }

  const manifest = readJson<ArtifactManifest>(resolved, "manifest.json");

  if (
    !manifest ||
    typeof manifest.artifactVersion !== "string" ||
    manifest.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    typeof manifest.artifactSha256 !== "string" ||
    !manifest.counts
  ) {
    throw new ArtifactError(
      "artifact_shape_error",
      "manifest.json has an unsupported shape"
    );
  }

  if (
    compareVersions(manifest.minEngineVersion, ENGINE_VERSION) > 0
  ) {
    throw new ArtifactError(
      "artifact_engine_version",
      `artifact requires engine ${manifest.minEngineVersion}, running ${ENGINE_VERSION}`
    );
  }

  verifyJsonHashes(resolved, manifest);

  const trackers = assertTrackers(
    readJson<TrackersArtifact>(resolved, "trackers.json")
  );
  const providers = assertProviders(
    readJson<ProvidersArtifact>(resolved, "providers.json")
  );
  const allowlist = assertAllowlist(
    readJson<AllowlistArtifact>(resolved, "allowlist.json")
  );
  const policy = assertPolicy(
    readJson<PolicyArtifact>(resolved, "policy.json")
  );

  let artifactHashValid = false;

  const allArtifactsPresent = ARTIFACT_FILES.every((file) =>
    fs.existsSync(path.join(resolved, file))
  );

  if (allArtifactsPresent) {
    try {
      artifactHashValid =
        computeCombinedArtifactHash(resolved) === manifest.artifactSha256;
    } catch {
      artifactHashValid = false;
    }
  }

  if (
    !manifest.artifactFiles &&
    !artifactHashValid
  ) {
    throw new ArtifactError(
      "artifact_hash_mismatch",
      "artifact hash mismatch and manifest has no per-file hashes"
    );
  }

  if (compiledArtifactsSchema) {
    // The dynamic import keeps zod out of the normal runtime path.
    fullRuntimeValidation(
      resolved,
      manifest,
      trackers,
      providers,
      allowlist,
      policy
    );
  }

  return {
    dir: resolved,
    manifest,
    trackers,
    providers,
    allowlist,
    policy,
    artifactHashValid,
  };
};

/** Plan name for the cold-start artifact assertion/loader. */
export const assertCompiledArtifact = (
  dir?: string
): LoadedArtifacts => loadCompiledArtifacts(dir);
