import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ParsedBlocklists } from "../../src/config/blocklist-parser.js";
import {
  validateConfig,
  CONFIG_VALIDATOR_VERSION,
  type ConfigIssue,
  type ValidatedConfig,
} from "../../src/config/config-validation.js";
import {
  ARTIFACT_SCHEMA_VERSION,
  ARTIFACT_VERSION_PREFIX,
  ENGINE_VERSION,
} from "../../src/config/engine-version.js";
import { isValidHostHint } from "../../src/config/hostname.js";
import type { Manifest } from "../../src/config/schemas/manifest.js";
import type { Provider } from "../../src/config/schemas/providers.js";
import { buildMphf, buildSortedHashes } from "./mphf.js";

export interface CompileOptions {
  root?: string;
  outDir?: string;
  indexKind?: "mphf" | "sorted";
  builtAt?: string;
}

export interface CompileResult {
  manifest: Manifest;
  outDir: string;
  warnings: ConfigIssue[];
}

export class ConfigCompileError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(
      `Config validation failed with ${issues.length} error(s): ${issues
        .map((issue) => `${issue.file}:${issue.field}:${issue.code}`)
        .join(", ")}`
    );
    this.name = "ConfigCompileError";
    this.issues = issues;
  }
}

const JSON_INDENT = 2;

const stableJson = (value: unknown): string =>
  `${JSON.stringify(value, null, JSON_INDENT)}\n`;

const sortStrings = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

export interface RuleBuckets {
  exact: string[];
  prefixes: string[];
  regex: string[];
}

const LITERAL_RULE = /^[A-Za-z0-9_%.-]+$/;
const PREFIX_RULE = /^([A-Za-z0-9_%.-]+)\*$/;

export const classifyRules = (rules: readonly string[]): RuleBuckets => {
  const buckets: RuleBuckets = {
    exact: [],
    prefixes: [],
    regex: [],
  };

  for (const rule of rules) {
    if (LITERAL_RULE.test(rule)) {
      buckets.exact.push(rule.toLowerCase());
      continue;
    }

    const prefix = rule.match(PREFIX_RULE);

    if (prefix) {
      buckets.prefixes.push(prefix[1]!.toLowerCase());
      continue;
    }

    buckets.regex.push(`^(?:${rule})$`);
  }

  buckets.exact = sortStrings(buckets.exact);
  buckets.prefixes = sortStrings(buckets.prefixes);
  buckets.regex = sortStrings(buckets.regex);

  return buckets;
};

const leadingSubdomainGroups = [
  /^\(\?:\[[^\]]+\]\+\\\.\)\*\?/,
  /^\(\?:\[[^\]]+\]\+\\\.\)\*/,
  /^\(\[[^\]]+\]\*?\\\.\)/,
  /^\(\?:[^)]+\\\.\)\?/,
];

/**
 * Derive a conservative host prefilter from a provider `urlPattern`.
 *
 * This never authorizes a provider on its own: the runtime still runs the
 * original regex. Providers whose pattern cannot yield a trustworthy hint go
 * into the fallback bucket and are always considered.
 */
export const extractHostHints = (urlPattern: string): string[] => {
  let pattern = urlPattern.replace(/^\^/, "");

  for (const scheme of [
    "https?:\\/\\/",
    "https?://",
    "wss?:\\/\\/",
    "wss?://",
  ]) {
    if (pattern.startsWith(scheme)) {
      pattern = pattern.slice(scheme.length);
      break;
    }
  }

  for (const group of leadingSubdomainGroups) {
    pattern = pattern.replace(group, "");
  }

  // `(youtube\.com|youtu\.be)` — keep the first alternative for the hint.
  if (pattern.startsWith("(")) {
    const close = pattern.indexOf(")");

    if (close !== -1) {
      const firstAlternative = pattern
        .slice(1, close)
        .split("|")[0];
      pattern = `${firstAlternative ?? ""}${pattern.slice(close + 1)}`;
    }
  }

  pattern = pattern.replace(/\\\./g, ".").replace(/\\-/g, "-");

  const literal = pattern.match(/^[a-z0-9.-]+/i)?.[0]?.toLowerCase();

  if (!literal) {
    return [];
  }

  const trimmed = literal.replace(/\.+$/, "");

  if (!isValidHostHint(trimmed)) {
    return [];
  }

  const hints = new Set<string>([trimmed]);
  const labels = trimmed.split(".");

  // A two-label literal such as `nikkei.co` may be followed by an alternation
  // (`(?:m|.jp)`), so keep the first label as a stem candidate too. The regex
  // still verifies the full provider match.
  if (labels.length === 2) {
    hints.add(labels[0]!);
  }

  return [...hints].sort();
};

const compileProvider = (provider: Provider): CompiledProvider => {
  const hostHints =
    provider.hostHints.length > 0
      ? sortStrings(provider.hostHints)
      : extractHostHints(provider.urlPattern);

  return {
    id: provider.id,
    urlPattern: provider.urlPattern,
    hostHints,
    completeProvider: provider.completeProvider,
    rules: classifyRules(provider.rules),
    referralMarketing: classifyRules(provider.referralMarketing),
    exceptions: sortStrings(provider.exceptions),
    redirections: sortStrings(provider.redirections),
    rawRules: sortStrings(provider.rawRules),
  };
};

interface CompiledProvider {
  id: string;
  urlPattern: string;
  hostHints: string[];
  completeProvider: boolean;
  rules: RuleBuckets;
  referralMarketing: RuleBuckets;
  exceptions: string[];
  redirections: string[];
  rawRules: string[];
}

interface TrackerGroup {
  exact: string[];
  prefixes: string[];
  patterns: string[];
  exceptions: string[];
}

const compileTrackerGroup = (dataset: {
  exact: readonly string[];
  prefixes: readonly string[];
  patterns: readonly string[];
  exceptions: readonly string[];
}): TrackerGroup => ({
  exact: sortStrings(dataset.exact.map((value) => value.toLowerCase())),
  prefixes: sortStrings(
    dataset.prefixes.map((value) => value.toLowerCase())
  ),
  patterns: sortStrings(dataset.patterns),
  exceptions: sortStrings(dataset.exceptions),
});

const writeFile = (filePath: string, content: string | Buffer): void => {
  fs.writeFileSync(filePath, content);
};

const sha256 = (content: Buffer): string =>
  crypto.createHash("sha256").update(content).digest("hex");

const writeUInt32 = (value: number): Buffer => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
};

const typedBuffer = (
  array: Int32Array | Uint32Array
): Buffer =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength);

const buildBlocklistArtifact = (
  blocklists: ParsedBlocklists,
  indexKind: "mphf" | "sorted"
): Buffer => {
  const index =
    indexKind === "mphf"
      ? buildMphf(blocklists.hosts)
      : buildSortedHashes(blocklists.hosts);

  const header = {
    indexKind: index.indexKind,
    seed: index.seed,
    bucketCount: index.indexKind === "mphf" ? index.bucketCount : 0,
    tableSize: index.tableSize,
    hostCount: blocklists.hosts.length,
    urlCount: blocklists.urls.length,
    collisionCount: index.collisions.length,
  };
  const headerBuffer = Buffer.from(JSON.stringify(header), "utf-8");
  const collisions = Buffer.from(
    JSON.stringify(index.collisions),
    "utf-8"
  );
  const urls = Buffer.from(
    JSON.stringify(blocklists.urls),
    "utf-8"
  );

  const parts: Buffer[] = [];
  parts.push(Buffer.from("LYNKYBL1", "ascii"));
  parts.push(writeUInt32(1));
  parts.push(writeUInt32(headerBuffer.byteLength));
  parts.push(headerBuffer);

  if (index.indexKind === "mphf") {
    parts.push(typedBuffer(index.displacements));
    parts.push(typedBuffer(index.verification));
  } else {
    parts.push(typedBuffer(index.hashes));
  }

  parts.push(writeUInt32(collisions.byteLength));
  parts.push(collisions);
  parts.push(writeUInt32(urls.byteLength));
  parts.push(urls);

  return Buffer.concat(parts);
};

interface SourceFileEntry {
  file: string;
  format?: string;
  entries?: number;
  sourceUrl?: string;
  license?: string;
}

const sourceFiles = (
  config: ValidatedConfig
): SourceFileEntry[] => {
  const files: SourceFileEntry[] = [
    { file: "trackers/generic/lynky.json" },
    { file: "trackers/generic/clearurls-global.json" },
    { file: "trackers/providers/clearurls.json" },
    { file: "trackers/providers/overrides.json" },
    { file: "trackers/providers/upstream/data.min.json" },
    { file: "trackers/providers/upstream/version.json" },
    { file: "policies/allowlist.json" },
    { file: "policies/cleaner.json" },
    { file: "blocklists/sources.json" },
  ];

  for (const source of config.blocklists.sources) {
    if (source.present && !source.error) {
      files.push({
        file: `blocklists/${source.config.file}`,
        format: source.config.format,
        entries: source.parsedLines,
        ...(source.config.sourceUrl
          ? { sourceUrl: source.config.sourceUrl }
          : {}),
        ...(source.config.license
          ? { license: source.config.license }
          : {}),
      });
    }
  }

  return files;
};

const buildSourceManifest = (
  config: ValidatedConfig
): Manifest["sources"] =>
  sourceFiles(config).map((entry) => {
    const filePath = path.join(
      config.paths.root,
      ...entry.file.split("/")
    );
    const content = fs.readFileSync(filePath);

    return {
      file: entry.file,
      sha256: sha256(content),
      bytes: content.byteLength,
      fetchedAt: fs.statSync(filePath).mtime.toISOString(),
      ...(entry.format ? { format: entry.format } : {}),
      ...(entry.entries !== undefined ? { entries: entry.entries } : {}),
      ...(entry.sourceUrl ? { sourceUrl: entry.sourceUrl } : {}),
      ...(entry.license ? { license: entry.license } : {}),
    };
  });

const countRules = (
  config: ValidatedConfig,
  providers: readonly CompiledProvider[]
): number => {
  let count =
    config.lynky.exact.length +
    config.lynky.prefixes.length +
    config.lynky.patterns.length +
    config.clearurlsGlobal.exact.length +
    config.clearurlsGlobal.prefixes.length +
    config.clearurlsGlobal.patterns.length +
    config.clearurlsGlobal.exceptions.length;

  for (const provider of providers) {
    count +=
      provider.rules.exact.length +
      provider.rules.prefixes.length +
      provider.rules.regex.length +
      provider.referralMarketing.exact.length +
      provider.referralMarketing.prefixes.length +
      provider.referralMarketing.regex.length +
      provider.exceptions.length +
      provider.redirections.length +
      provider.rawRules.length;
  }

  return count;
};

const combinedArtifactHash = (outDir: string): string => {
  const hash = crypto.createHash("sha256");

  for (const file of [
    "trackers.json",
    "providers.json",
    "allowlist.json",
    "policy.json",
    "blocklists.bin",
  ]) {
    hash.update(`${file}\0`, "utf-8");
    hash.update(fs.readFileSync(path.join(outDir, file)));
  }

  return hash.digest("hex");
};

export const compileConfig = (
  options: CompileOptions = {}
): CompileResult => {
  const validation = validateConfig(options.root);

  if (!validation.ok || !validation.data) {
    throw new ConfigCompileError(validation.errors);
  }

  const config = validation.data;
  const outDir =
    options.outDir ??
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "dist",
      "config",
      "compiled"
    );

  fs.mkdirSync(outDir, { recursive: true });

  const providers = config.providers.map(compileProvider);
  const trackers = {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    groups: {
      lynky: compileTrackerGroup(config.lynky),
      clearurlsGlobal: compileTrackerGroup(config.clearurlsGlobal),
    },
  };
  const providersArtifact = {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    providers,
  };
  const allowlist = {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    global: sortStrings(config.allowlist.global),
    domains: Object.fromEntries(
      Object.entries(config.allowlist.domains)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([domain, values]) => [domain, sortStrings(values)])
    ),
  };
  const policy = {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    maxDepth: config.policy.maxDepth,
    genericRedirectUnwrap: config.policy.genericRedirectUnwrap,
    genericUnwrapParameters: config.policy.genericRedirectUnwrap
      ? sortStrings(config.policy.genericUnwrapParameters)
      : [],
    removeJunkFragments: config.policy.removeJunkFragments,
  };

  writeFile(path.join(outDir, "trackers.json"), stableJson(trackers));
  writeFile(path.join(outDir, "providers.json"), stableJson(providersArtifact));
  writeFile(path.join(outDir, "allowlist.json"), stableJson(allowlist));
  writeFile(path.join(outDir, "policy.json"), stableJson(policy));

  const blocklistIndexKind =
    options.indexKind ??
    (process.env.BLOCKLIST_INDEX === "sorted" ? "sorted" : "mphf");
  const blocklistArtifact = buildBlocklistArtifact(
    config.blocklists,
    blocklistIndexKind
  );

  writeFile(path.join(outDir, "blocklists.bin"), blocklistArtifact);

  const artifactSha256 = combinedArtifactHash(outDir);
  const artifactFiles = Object.fromEntries(
    [
      "trackers.json",
      "providers.json",
      "allowlist.json",
      "policy.json",
      "blocklists.bin",
    ].map((file) => {
      const content = fs.readFileSync(path.join(outDir, file));

      return [
        file,
        {
          sha256: sha256(content),
          bytes: content.byteLength,
        },
      ];
    })
  );
  const builtAt =
    options.builtAt ??
    (process.env.SOURCE_DATE_EPOCH
      ? new Date(
          Number(process.env.SOURCE_DATE_EPOCH) * 1000
        ).toISOString()
      : new Date().toISOString());

  const manifest: Manifest = {
    artifactVersion: `${ARTIFACT_VERSION_PREFIX}-${artifactSha256.slice(0, 16)}`,
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    minEngineVersion: ENGINE_VERSION,
    validatorVersion: CONFIG_VALIDATOR_VERSION,
    builtAt,
    sources: buildSourceManifest(config),
    artifactSha256,
    artifactFiles,
    counts: {
      sourceLines: config.blocklists.stats.sourceLines,
      uniqueHosts: config.blocklists.stats.uniqueHosts,
      uniqueUrls: config.blocklists.stats.uniqueUrls,
      duplicates: config.blocklists.stats.duplicates,
      rejectedLines: config.blocklists.stats.rejectedLines,
      providers: providers.length,
      rules: countRules(config, providers),
    },
  };

  writeFile(path.join(outDir, "manifest.json"), stableJson(manifest));

  return {
    manifest,
    outDir,
    warnings: validation.warnings,
  };
};
