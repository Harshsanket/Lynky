import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  parseBlocklists,
  type ParsedBlocklists,
} from "./blocklist-parser.js";
import {
  hasCaptureGroup,
  isSafeRegex,
  isStartAnchored,
  unknownKeys,
  KNOWN_ALLOWLIST_KEYS,
  KNOWN_BLOCKLIST_SOURCES_KEYS,
  KNOWN_OVERRIDE_KEYS,
  KNOWN_OVERRIDES_KEYS,
  KNOWN_POLICY_KEYS,
  KNOWN_PROVIDER_KEYS,
  KNOWN_PROVIDERS_KEYS,
  KNOWN_TRACKER_KEYS,
} from "./schemas/common.js";
import {
  allowlistSchema,
  type AllowlistConfig,
} from "./schemas/allowlist.js";
import {
  blocklistSourcesSchema,
  type BlocklistSource,
} from "./schemas/blocklist-sources.js";
import { cleanerPolicySchema, type CleanerPolicy } from "./schemas/policy.js";
import {
  overridesDatasetSchema,
  providersDatasetSchema,
  type Override,
  type Provider,
} from "./schemas/providers.js";
import {
  trackerDatasetSchema,
  type TrackerDataset,
} from "./schemas/trackers.js";
import { applyProviderOverrides } from "./provider-overrides.js";

export const CONFIG_VALIDATOR_VERSION = "1";

export interface ConfigIssue {
  file: string;
  field: string;
  index: number | string | null;
  code: string;
  message: string;
}

export interface ConfigPaths {
  root: string;
  lynkyTrackers: string;
  clearurlsGlobalTrackers: string;
  clearurlsProviders: string;
  providerOverrides: string;
  upstreamData: string;
  upstreamVersion: string;
  allowlist: string;
  cleanerPolicy: string;
  blocklistSources: string;
  blocklistsDir: string;
}

export interface ValidatedConfig {
  paths: ConfigPaths;
  lynky: TrackerDataset;
  clearurlsGlobal: TrackerDataset;
  providers: Provider[];
  allowlist: AllowlistConfig;
  policy: CleanerPolicy;
  blocklistSources: BlocklistSource[];
  blocklists: ParsedBlocklists;
  upstreamVersion: {
    version: string;
    sha256: string;
    fetchedAt: string;
    sourceUrl: string;
  };
}

export interface ConfigValidationResult {
  ok: boolean;
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
  data: ValidatedConfig | null;
}

const defaultConfigRoot = (): string =>
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config"
  );

export const resolveConfigPaths = (root?: string): ConfigPaths => {
  const resolved = root ? path.resolve(root) : defaultConfigRoot();

  return {
    root: resolved,
    lynkyTrackers: path.join(
      resolved,
      "trackers",
      "generic",
      "lynky.json"
    ),
    clearurlsGlobalTrackers: path.join(
      resolved,
      "trackers",
      "generic",
      "clearurls-global.json"
    ),
    clearurlsProviders: path.join(
      resolved,
      "trackers",
      "providers",
      "clearurls.json"
    ),
    providerOverrides: path.join(
      resolved,
      "trackers",
      "providers",
      "overrides.json"
    ),
    upstreamData: path.join(
      resolved,
      "trackers",
      "providers",
      "upstream",
      "data.min.json"
    ),
    upstreamVersion: path.join(
      resolved,
      "trackers",
      "providers",
      "upstream",
      "version.json"
    ),
    allowlist: path.join(resolved, "policies", "allowlist.json"),
    cleanerPolicy: path.join(resolved, "policies", "cleaner.json"),
    blocklistSources: path.join(resolved, "blocklists", "sources.json"),
    blocklistsDir: path.join(resolved, "blocklists"),
  };
};

interface ReadJsonResult {
  ok: boolean;
  value?: unknown;
  text?: string;
  sha256?: string;
  bytes?: number;
  error?: string;
}

const readJson = (filePath: string): ReadJsonResult => {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "file is missing" };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString("utf-8");

    return {
      ok: true,
      value: JSON.parse(text) as unknown,
      text,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      bytes: buffer.byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message,
    };
  }
};

const issueList = () => {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];

  const add = (
    target: ConfigIssue[],
    file: string,
    field: string,
    index: number | string | null,
    code: string,
    message: string
  ) => {
    target.push({ file, field, index, code, message });
  };

  return {
    errors,
    warnings,
    error: (
      file: string,
      field: string,
      index: number | string | null,
      code: string,
      message: string
    ) => add(errors, file, field, index, code, message),
    warning: (
      file: string,
      field: string,
      index: number | string | null,
      code: string,
      message: string
    ) => add(warnings, file, field, index, code, message),
  };
};

const relativeFile = (root: string, filePath: string): string =>
  path.relative(root, filePath);

const parseWithSchema = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  file: string,
  issues: ReturnType<typeof issueList>
): T | null => {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  for (const issue of result.error.issues) {
    const pathParts = issue.path;
    const last = pathParts[pathParts.length - 1];

    issues.error(
      file,
      pathParts.length > 0 ? pathParts.join(".") : "$",
      typeof last === "number" ? last : null,
      issue.code,
      issue.message
    );
  }

  return null;
};

const warnUnknownKeys = (
  value: unknown,
  known: readonly string[],
  file: string,
  issues: ReturnType<typeof issueList>
): void => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return;
  }

  for (const key of unknownKeys(
    value as Record<string, unknown>,
    known
  )) {
    issues.warning(
      file,
      key,
      null,
      "unknown_field",
      "unknown field is ignored (strict production mode rejects it)"
    );
  }
};

const duplicateValues = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
};

const validateTrackers = (
  dataset: TrackerDataset,
  file: string,
  issues: ReturnType<typeof issueList>,
  options: { requireSource?: boolean; label: string }
): void => {
  if (dataset.exact.length + dataset.prefixes.length + dataset.patterns.length === 0) {
    issues.error(file, "exact", null, "empty_trackers", `${options.label} has no rules`);
  }

  for (const [field, values] of [
    ["exact", dataset.exact],
    ["prefixes", dataset.prefixes],
    ["patterns", dataset.patterns],
    ["exceptions", dataset.exceptions],
  ] as const) {
    if (values.length > 10000) {
      issues.error(
        file,
        field,
        null,
        "too_many_values",
        `${field} must contain at most 10000 values`
      );
    }

    for (const duplicate of duplicateValues(values)) {
      issues.error(
        file,
        field,
        values.indexOf(duplicate),
        "duplicate_value",
        `duplicate value ${JSON.stringify(duplicate)}`
      );
    }
  }

  for (const value of [...dataset.exact, ...dataset.prefixes]) {
    if (value !== value.toLowerCase()) {
      issues.error(
        file,
        dataset.exact.includes(value) ? "exact" : "prefixes",
        null,
        "not_lowercase",
        `${JSON.stringify(value)} must be lowercase`
      );
    }
  }

  const exactSet = new Set(dataset.exact);

  for (const prefix of dataset.prefixes) {
    if (exactSet.has(prefix)) {
      issues.error(
        file,
        "prefixes",
        dataset.prefixes.indexOf(prefix),
        "overlapping_rule",
        `prefix ${JSON.stringify(prefix)} duplicates an exact rule`
      );
    }
  }

  dataset.patterns.forEach((pattern, index) => {
    if (!isStartAnchored(pattern)) {
      issues.error(
        file,
        "patterns",
        index,
        "unanchored_pattern",
        `pattern ${JSON.stringify(pattern)} must start with ^`
      );
    }

    if (!isSafeRegex(pattern)) {
      issues.error(
        file,
        "patterns",
        index,
        "unsafe_regex",
        `pattern ${JSON.stringify(pattern)} failed the regex safety check`
      );
      return;
    }

    try {
      new RegExp(pattern, "i");
    } catch (error) {
      issues.error(
        file,
        "patterns",
        index,
        "invalid_regex",
        (error as Error).message
      );
    }
  });

  dataset.exceptions.forEach((pattern, index) => {
    if (!isStartAnchored(pattern)) {
      issues.error(
        file,
        "exceptions",
        index,
        "unanchored_pattern",
        `exception ${JSON.stringify(pattern)} must start with ^`
      );
    }

    if (!isSafeRegex(pattern)) {
      issues.error(
        file,
        "exceptions",
        index,
        "unsafe_regex",
        `exception ${JSON.stringify(pattern)} failed the regex safety check`
      );
      return;
    }

    try {
      new RegExp(pattern, "i");
    } catch (error) {
      issues.error(
        file,
        "exceptions",
        index,
        "invalid_regex",
        (error as Error).message
      );
    }
  });

  if (options.requireSource) {
    if (!dataset.source) {
      issues.error(file, "source", null, "missing_source", "source is required");
    }

    if (!dataset.upstreamVersion) {
      issues.error(
        file,
        "upstreamVersion",
        null,
        "missing_upstream_version",
        "upstreamVersion is required"
      );
    }
  }
};

const validateProviders = (
  providers: readonly Provider[],
  file: string,
  issues: ReturnType<typeof issueList>
): number => {
  const ids = new Set<string>();
  let ruleCount = 0;

  if (providers.length > 5000) {
    issues.error(
      file,
      "providers",
      null,
      "too_many_providers",
      "at most 5000 providers are supported"
    );
  }

  providers.forEach((provider, index) => {
    const field = `providers.${provider.id}`;

    if (ids.has(provider.id)) {
      issues.error(
        file,
        field,
        index,
        "duplicate_provider",
        `provider id ${JSON.stringify(provider.id)} is duplicated`
      );
    }

    ids.add(provider.id);

    if (provider.id === "globalRules") {
      issues.error(
        file,
        field,
        index,
        "global_rules_in_providers",
        "globalRules belongs in trackers/generic/clearurls-global.json"
      );
    }

    if (
      provider.urlPattern === ".*" ||
      provider.urlPattern === "^.*$" ||
      provider.urlPattern.length < 2
    ) {
      issues.error(
        file,
        `${field}.urlPattern`,
        index,
        "broad_pattern",
        "urlPattern is too broad to be safe"
      );
    }

    if (!isStartAnchored(provider.urlPattern)) {
      issues.error(
        file,
        `${field}.urlPattern`,
        index,
        "unanchored_pattern",
        "urlPattern must start with ^"
      );
    }

    if (!isSafeRegex(provider.urlPattern)) {
      issues.error(
        file,
        `${field}.urlPattern`,
        index,
        "unsafe_regex",
        "urlPattern failed the regex safety check"
      );
    } else {
      try {
        new RegExp(provider.urlPattern, "i");
      } catch (error) {
        issues.error(
          file,
          `${field}.urlPattern`,
          index,
          "invalid_regex",
          (error as Error).message
        );
      }
    }

    for (const [name, rules] of [
      ["rules", provider.rules],
      ["referralMarketing", provider.referralMarketing],
      ["exceptions", provider.exceptions],
      ["redirections", provider.redirections],
      ["rawRules", provider.rawRules],
    ] as const) {
      for (const duplicate of duplicateValues(rules)) {
        issues.error(
          file,
          `${field}.${name}`,
          rules.indexOf(duplicate),
          "duplicate_rule",
          `duplicate rule ${JSON.stringify(duplicate)}`
        );
      }

      rules.forEach((rule, ruleIndex) => {
        ruleCount++;

        if (!isSafeRegex(rule)) {
          issues.error(
            file,
            `${field}.${name}`,
            ruleIndex,
            "unsafe_regex",
            `rule ${JSON.stringify(rule)} failed the regex safety check`
          );
          return;
        }

        const flags = name === "rawRules" ? "gi" : "i";
        const source =
          name === "rawRules" ? rule : `^(?:${rule})$`;

        try {
          new RegExp(source, flags);
        } catch (error) {
          issues.error(
            file,
            `${field}.${name}`,
            ruleIndex,
            "invalid_regex",
            (error as Error).message
          );
        }
      });
    }

    provider.redirections.forEach((redirection, ruleIndex) => {
      if (!hasCaptureGroup(redirection)) {
        issues.error(
          file,
          `${field}.redirections`,
          ruleIndex,
          "missing_capture_group",
          "redirection regex must contain a capture group"
        );
      }
    });

    for (const duplicate of duplicateValues(provider.hostHints)) {
      issues.error(
        file,
        `${field}.hostHints`,
        provider.hostHints.indexOf(duplicate),
        "duplicate_host_hint",
        `duplicate host hint ${JSON.stringify(duplicate)}`
      );
    }

    provider.hostHints.forEach((hint, hintIndex) => {
      if (hint !== hint.toLowerCase()) {
        issues.error(
          file,
          `${field}.hostHints`,
          hintIndex,
          "not_lowercase",
          `host hint ${JSON.stringify(hint)} must be lowercase`
        );
      }
    });

    if (provider.completeProvider && provider.rules.length > 0) {
      issues.warning(
        file,
        `${field}.rules`,
        index,
        "unused_complete_provider_rules",
        "completeProvider makes the rules list unused"
      );
    }
  });

  return ruleCount;
};

const validateAllowlist = (
  allowlist: AllowlistConfig,
  file: string,
  issues: ReturnType<typeof issueList>
): void => {
  for (const duplicate of duplicateValues(allowlist.global)) {
    issues.error(
      file,
      "global",
      allowlist.global.indexOf(duplicate),
      "duplicate_value",
      `duplicate global allowlist parameter ${JSON.stringify(duplicate)}`
    );
  }

  for (const [domain, parameters] of Object.entries(allowlist.domains)) {
    if (domain !== domain.toLowerCase()) {
      issues.error(
        file,
        `domains.${domain}`,
        domain,
        "not_lowercase",
        "domain keys must be lowercase"
      );
    }

    for (const duplicate of duplicateValues(parameters)) {
      issues.error(
        file,
        `domains.${domain}`,
        parameters.indexOf(duplicate),
        "duplicate_value",
        `duplicate allowlist parameter ${JSON.stringify(duplicate)}`
      );
    }
  }
};

const DANGEROUS_GENERIC_UNWRAP = new Set([
  "next",
  "continue",
  "u",
  "link",
  "uri",
  "href",
  "go",
  "out",
  "loc",
  "ref_url",
  "_url",
]);

const validatePolicy = (
  policy: CleanerPolicy,
  file: string,
  issues: ReturnType<typeof issueList>
): void => {
  for (const duplicate of duplicateValues(policy.genericUnwrapParameters)) {
    issues.error(
      file,
      "genericUnwrapParameters",
      policy.genericUnwrapParameters.indexOf(duplicate),
      "duplicate_value",
      `duplicate unwrap parameter ${JSON.stringify(duplicate)}`
    );
  }

  const allowedDangerous = new Set(
    policy.allowDangerousGenericUnwrapParameters
  );

  for (const [index, parameter] of policy.genericUnwrapParameters.entries()) {
    const normalized = parameter.toLowerCase();

    if (
      policy.genericRedirectUnwrap &&
      DANGEROUS_GENERIC_UNWRAP.has(normalized) &&
      !allowedDangerous.has(parameter)
    ) {
      issues.error(
        file,
        "genericUnwrapParameters",
        index,
        "dangerous_unwrap_parameter",
        `generic unwrap parameter ${JSON.stringify(parameter)} is dangerous; add it to allowDangerousGenericUnwrapParameters only after review`
      );
    }
  }

  if (
    !policy.genericRedirectUnwrap &&
    policy.genericUnwrapParameters.length > 0
  ) {
    issues.warning(
      file,
      "genericUnwrapParameters",
      null,
      "unused_unwrap_parameters",
      "genericRedirectUnwrap is false, so genericUnwrapParameters is unused"
    );
  }
};

const providerMatchesDomain = (
  providers: readonly Provider[],
  domain: string
): boolean => {
  for (const provider of providers) {
    if (
      provider.hostHints.some(
        (hint) =>
          domain === hint ||
          domain.endsWith(`.${hint}`) ||
          hint.endsWith(`.${domain}`)
      )
    ) {
      return true;
    }

    try {
      if (new RegExp(provider.urlPattern, "i").test(`https://${domain}/`)) {
        return true;
      }
    } catch {
      // Validated separately; a broken pattern cannot rescue a domain.
    }
  }

  return false;
};

const validateBlocklists = (
  paths: ConfigPaths,
  sources: readonly BlocklistSource[],
  parsed: ParsedBlocklists,
  issues: ReturnType<typeof issueList>
): void => {
  const listed = new Set(sources.map((source) => source.file));

  try {
    for (const file of fs.readdirSync(paths.blocklistsDir)) {
      if (
        file.toLowerCase().endsWith(".txt") &&
        !listed.has(file)
      ) {
        issues.warning(
          relativeFile(paths.root, path.join(paths.blocklistsDir, file)),
          "file",
          null,
          "unknown_blocklist",
          "unlisted .txt file is ignored by the compiler"
        );
      }
    }
  } catch {
    // The directory may not exist at all; required-source checks below report
    // the actionable error.
  }

  let ownHost: string | null = null;

  try {
    ownHost = process.env.PUBLIC_URL
      ? new URL(process.env.PUBLIC_URL).hostname.toLowerCase()
      : null;
  } catch {
    ownHost = null;
  }

  for (const source of parsed.sources) {
    const file = relativeFile(
      paths.root,
      path.join(paths.blocklistsDir, source.config.file)
    );

    if (!source.present) {
      if (source.config.required) {
        issues.error(
          file,
          "file",
          null,
          "blocklist_missing",
          "required blocklist file is missing"
        );
      } else {
        issues.warning(
          file,
          "file",
          null,
          "blocklist_optional_missing",
          "optional blocklist file is missing; screening continues without it"
        );
      }

      continue;
    }

    if (source.error) {
      issues.error(
        file,
        "file",
        null,
        "blocklist_unreadable",
        source.error
      );
      continue;
    }

    if (source.config.sha256 && source.sha256 !== source.config.sha256) {
      issues.error(
        file,
        "sha256",
        null,
        "blocklist_hash_mismatch",
        `expected ${source.config.sha256}, got ${source.sha256 ?? "<none>"}`
      );
    }

    if (source.parsedLines < source.config.minEntries) {
      issues.error(
        file,
        "minEntries",
        null,
        "blocklist_too_small",
        `parsed ${source.parsedLines} entries, expected at least ${source.config.minEntries}`
      );
    }

    if (source.consideredLines > 0) {
      const rejectRatio = source.rejectedLines / source.consideredLines;

      if (rejectRatio > 0.2) {
        issues.error(
          file,
          "format",
          null,
          "blocklist_reject_ratio",
          `${(rejectRatio * 100).toFixed(1)}% of lines were rejected; check the declared format`
        );
      }
    }

    const tldOnly = source.hosts.filter((host) => !host.includes("."));

    if (tldOnly.length > 0) {
      issues.error(
        file,
        "file",
        null,
        "blocklist_tld_only",
        `TLD-only entries are not allowed: ${tldOnly.slice(0, 5).join(", ")}`
      );
    }

    if (ownHost) {
      const ownEntries = source.hosts.filter(
        (host) => host === ownHost || host.endsWith(`.${ownHost}`)
      );

      if (ownEntries.length > 0) {
        issues.error(
          file,
          "file",
          null,
          "blocklist_own_host",
          `blocklist contains the deployment host: ${ownEntries.slice(0, 5).join(", ")}`
        );
      }
    }

    if (source.rejectedExamples.length > 0) {
      issues.warning(
        file,
        "file",
        source.rejectedExamples[0]!.line,
        "blocklist_parse_warning",
        source.rejectedExamples
          .map((example) => `line ${example.line}: ${example.reason}`)
          .join("; ")
      );
    }
  }
};

const upstreamVersionSchema = z.object({
  version: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  fetchedAt: z.string().min(1),
  sourceUrl: z.string().url(),
  upstreamCommit: z.string().min(1).optional(),
});

export const validateConfig = (
  root?: string
): ConfigValidationResult => {
  const paths = resolveConfigPaths(root);
  const issues = issueList();

  /* ---------------------------------------------------------------------- */
  /*  Trackers                                                              */
  /* ---------------------------------------------------------------------- */

  const lynkyRead = readJson(paths.lynkyTrackers);
  const globalRead = readJson(paths.clearurlsGlobalTrackers);

  let lynky: TrackerDataset | null = null;
  let clearurlsGlobal: TrackerDataset | null = null;

  if (!lynkyRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.lynkyTrackers),
      "$",
      null,
      "read_error",
      lynkyRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.lynkyTrackers);
    warnUnknownKeys(lynkyRead.value, KNOWN_TRACKER_KEYS, file, issues);
    lynky = parseWithSchema(trackerDatasetSchema, lynkyRead.value, file, issues);

    if (lynky) {
      validateTrackers(lynky, file, issues, {
        label: "lynky tracker dataset",
      });
    }
  }

  if (!globalRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.clearurlsGlobalTrackers),
      "$",
      null,
      "read_error",
      globalRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.clearurlsGlobalTrackers);
    warnUnknownKeys(globalRead.value, KNOWN_TRACKER_KEYS, file, issues);
    clearurlsGlobal = parseWithSchema(
      trackerDatasetSchema,
      globalRead.value,
      file,
      issues
    );

    if (clearurlsGlobal) {
      validateTrackers(clearurlsGlobal, file, issues, {
        requireSource: true,
        label: "ClearURLs global tracker dataset",
      });
    }
  }

  if (lynky && clearurlsGlobal) {
    const file = relativeFile(paths.root, paths.root);
    const lynkyExact = new Set(lynky.exact);
    const exactOverlap = clearurlsGlobal.exact.filter((value) =>
      lynkyExact.has(value)
    );
    const prefixOverlap: string[] = [];

    for (const left of lynky.prefixes) {
      for (const right of clearurlsGlobal.prefixes) {
        if (left.startsWith(right) || right.startsWith(left)) {
          prefixOverlap.push(`${left} / ${right}`);
        }
      }
    }

    if (exactOverlap.length > 0 || prefixOverlap.length > 0) {
      issues.warning(
        file,
        "trackers",
        null,
        "tracker_overlap",
        `overlap between tracker groups: ${exactOverlap.length} exact, ${prefixOverlap.length} prefix`
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Providers and overrides                                               */
  /* ---------------------------------------------------------------------- */

  const providersRead = readJson(paths.clearurlsProviders);
  const overridesRead = readJson(paths.providerOverrides);

  let baseProviders: Provider[] | null = null;
  let overrides: Override[] | null = null;
  let providers: Provider[] | null = null;

  if (!providersRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.clearurlsProviders),
      "$",
      null,
      "read_error",
      providersRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.clearurlsProviders);
    warnUnknownKeys(providersRead.value, KNOWN_PROVIDERS_KEYS, file, issues);
    const dataset = parseWithSchema(
      providersDatasetSchema,
      providersRead.value,
      file,
      issues
    );
    baseProviders = dataset?.providers ?? null;
  }

  if (!overridesRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.providerOverrides),
      "$",
      null,
      "read_error",
      overridesRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.providerOverrides);
    warnUnknownKeys(overridesRead.value, KNOWN_OVERRIDES_KEYS, file, issues);
    const dataset = parseWithSchema(
      overridesDatasetSchema,
      overridesRead.value,
      file,
      issues
    );
    overrides = dataset?.overrides ?? null;

    if (
      overrides &&
      typeof overridesRead.value === "object" &&
      overridesRead.value !== null
    ) {
      const rawOverrides = (overridesRead.value as { overrides?: unknown })
        .overrides;

      if (Array.isArray(rawOverrides)) {
        rawOverrides.forEach((raw, index) => {
          if (typeof raw === "object" && raw !== null) {
            warnUnknownKeys(
              raw,
              KNOWN_OVERRIDE_KEYS,
              file,
              issues
            );
          }

          if (
            typeof raw === "object" &&
            raw !== null &&
            "action" in raw &&
            (raw as { action?: unknown }).action === "add" &&
            !("providerDefinition" in raw)
          ) {
            issues.error(
              file,
              `overrides.${index}.providerDefinition`,
              index,
              "missing_definition",
              "add overrides require providerDefinition"
            );
          }
        });
      }
    }
  }

  if (baseProviders && overrides) {
    const file = relativeFile(paths.root, paths.providerOverrides);
    const applied = applyProviderOverrides(baseProviders, overrides);

    for (const issue of applied.issues) {
      issues.error(
        file,
        `overrides.${issue.overrideIndex}.${issue.provider}`,
        issue.overrideIndex,
        issue.code,
        issue.message
      );
    }

    providers = applied.providers;
    validateProviders(
      providers,
      relativeFile(paths.root, paths.clearurlsProviders),
      issues
    );
  } else if (baseProviders) {
    providers = baseProviders;
    validateProviders(
      providers,
      relativeFile(paths.root, paths.clearurlsProviders),
      issues
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Upstream pin                                                          */
  /* ---------------------------------------------------------------------- */

  let upstreamVersion: ValidatedConfig["upstreamVersion"] | null = null;
  const upstreamRead = readJson(paths.upstreamVersion);
  const upstreamData = readJson(paths.upstreamData);

  if (!upstreamRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.upstreamVersion),
      "$",
      null,
      "read_error",
      upstreamRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.upstreamVersion);
    const parsed = parseWithSchema(
      upstreamVersionSchema,
      upstreamRead.value,
      file,
      issues
    );

    if (parsed) {
      upstreamVersion = parsed;

      if (!upstreamData.ok) {
        issues.error(
          relativeFile(paths.root, paths.upstreamData),
          "$",
          null,
          "read_error",
          upstreamData.error ?? "unable to read upstream data"
        );
      } else if (upstreamData.sha256 !== parsed.sha256) {
        issues.error(
          file,
          "sha256",
          null,
          "upstream_hash_mismatch",
          `expected ${parsed.sha256}, got ${upstreamData.sha256}`
        );
      }

      if (
        baseProviders &&
        upstreamData.ok &&
        typeof upstreamData.value === "object" &&
        upstreamData.value !== null &&
        "providers" in upstreamData.value
      ) {
        const upstreamProviders = (
          upstreamData.value as { providers?: Record<string, unknown> }
        ).providers;

        if (upstreamProviders) {
          const expectedIds = Object.keys(upstreamProviders)
            .filter((id) => id !== "globalRules")
            .sort();
          const actualIds = baseProviders
            .map((provider) => provider.id)
            .sort();

          if (
            expectedIds.length !== actualIds.length ||
            expectedIds.some((id, index) => id !== actualIds[index])
          ) {
            issues.warning(
              relativeFile(paths.root, paths.clearurlsProviders),
              "providers",
              null,
              "upstream_provider_drift",
              "clearurls.json provider ids differ from the pinned upstream file; regenerate providers"
            );
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Policies                                                              */
  /* ---------------------------------------------------------------------- */

  const allowlistRead = readJson(paths.allowlist);
  const policyRead = readJson(paths.cleanerPolicy);

  let allowlist: AllowlistConfig | null = null;
  let policy: CleanerPolicy | null = null;

  if (!allowlistRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.allowlist),
      "$",
      null,
      "read_error",
      allowlistRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.allowlist);
    warnUnknownKeys(allowlistRead.value, KNOWN_ALLOWLIST_KEYS, file, issues);
    allowlist = parseWithSchema(allowlistSchema, allowlistRead.value, file, issues);

    if (allowlist) {
      validateAllowlist(allowlist, file, issues);
    }
  }

  if (!policyRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.cleanerPolicy),
      "$",
      null,
      "read_error",
      policyRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.cleanerPolicy);
    warnUnknownKeys(policyRead.value, KNOWN_POLICY_KEYS, file, issues);
    policy = parseWithSchema(cleanerPolicySchema, policyRead.value, file, issues);

    if (policy) {
      validatePolicy(policy, file, issues);
    }
  }

  if (allowlist && providers) {
    const file = relativeFile(paths.root, paths.allowlist);

    for (const domain of Object.keys(allowlist.domains)) {
      if (!providerMatchesDomain(providers, domain)) {
        issues.warning(
          file,
          `domains.${domain}`,
          domain,
          "dead_allowlist_domain",
          "no provider pattern or host hint matches this domain"
        );
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Blocklists                                                            */
  /* ---------------------------------------------------------------------- */

  const sourcesRead = readJson(paths.blocklistSources);
  let blocklistSources: BlocklistSource[] | null = null;
  let blocklists: ParsedBlocklists | null = null;

  if (!sourcesRead.ok) {
    issues.error(
      relativeFile(paths.root, paths.blocklistSources),
      "$",
      null,
      "read_error",
      sourcesRead.error ?? "unable to read file"
    );
  } else {
    const file = relativeFile(paths.root, paths.blocklistSources);
    warnUnknownKeys(
      sourcesRead.value,
      KNOWN_BLOCKLIST_SOURCES_KEYS,
      file,
      issues
    );
    const dataset = parseWithSchema(
      blocklistSourcesSchema,
      sourcesRead.value,
      file,
      issues
    );
    blocklistSources = dataset?.sources ?? null;

    if (blocklistSources) {
      const files = blocklistSources.map((source) => source.file);

      for (const duplicate of duplicateValues(files)) {
        issues.error(
          file,
          "sources.file",
          files.indexOf(duplicate),
          "duplicate_value",
          `duplicate blocklist source ${JSON.stringify(duplicate)}`
        );
      }

      blocklists = parseBlocklists(paths.root, blocklistSources);
      validateBlocklists(paths, blocklistSources, blocklists, issues);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Result                                                                */
  /* ---------------------------------------------------------------------- */

  if (
    ["1", "true"].includes(
      (process.env.CONFIG_STRICT ?? "").trim().toLowerCase()
    )
  ) {
    const unknownFields = issues.warnings.filter(
      (warning) => warning.code === "unknown_field"
    );

    for (const warning of unknownFields) {
      issues.errors.push({
        ...warning,
        code: "unknown_field",
        message: `${warning.message} (CONFIG_STRICT=true)`,
      });
    }

    issues.warnings = issues.warnings.filter(
      (warning) => warning.code !== "unknown_field"
    );
  }

  const ok = issues.errors.length === 0;

  if (
    !ok ||
    !lynky ||
    !clearurlsGlobal ||
    !providers ||
    !allowlist ||
    !policy ||
    !blocklistSources ||
    !blocklists ||
    !upstreamVersion
  ) {
    return {
      ok: false,
      errors: issues.errors,
      warnings: issues.warnings,
      data: null,
    };
  }

  return {
    ok,
    errors: issues.errors,
    warnings: issues.warnings,
    data: {
      paths,
      lynky,
      clearurlsGlobal,
      providers,
      allowlist,
      policy,
      blocklistSources,
      blocklists,
      upstreamVersion,
    },
  };
};
