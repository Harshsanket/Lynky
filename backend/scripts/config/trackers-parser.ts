import crypto from "node:crypto";
import type { Provider } from "../../src/config/schemas/providers.js";
import { isValidHostHint } from "../../src/config/hostname.js";

/**
 * Build-time parser for the AdGuard `$removeparam`-style tracker sources.
 *
 * Only navigation-cleaning semantics are accepted: main-document removals,
 * key exceptions, and host-scoped variants. Resource-type-restricted rules and
 * modifiers that imply runtime fetch behaviour are rejected and counted in the
 * report instead of being guessed.
 */

export interface TrackerSourceInput {
  file: string;
  text: string;
}

export interface ParsedGenericRules {
  exact: string[];
  prefixes: string[];
  patterns: string[];
  pairPatterns: string[];
  exceptions: string[];
  excludeHosts: string[];
}

export interface TrackerConflict {
  host: string;
  key: string;
  removal: string;
  exception: string;
  resolution: "preserve";
}

export interface TrackerRejection {
  file: string;
  line: number;
  reason: string;
  rule: string;
}

export interface TrackerConversion {
  file: string;
  line: number;
  rule: string;
  host: string;
  key: string;
  source: string;
  note?: string;
}

export interface ParsedTrackerSources {
  generic: ParsedGenericRules;
  providers: Provider[];
  allowlistExceptions: Record<string, string[]>;
  report: {
    files: Record<
      string,
      {
        considered: number;
        accepted: number;
        rejected: number;
      }
    >;
    counts: {
      genericExact: number;
      genericPrefixes: number;
      genericPatterns: number;
      genericPairPatterns: number;
      genericExceptions: number;
      excludeHosts: number;
      providers: number;
      providerRules: number;
      providerPairPatterns: number;
      allowlistExceptions: number;
      exceptionConversions: number;
    };
    rejections: Record<string, number>;
    rejectedExamples: TrackerRejection[];
    conversions: TrackerConversion[];
    conflicts: TrackerConflict[];
  };
}

interface ProviderDraft {
  id: string;
  urlPattern: string;
  hostHints: string[];
  completeProvider: boolean;
  rules: Set<string>;
  pairPatterns: Set<string>;
  exceptions: Set<string>;
  redirections: Set<string>;
  rawRules: Set<string>;
}

const MAX_REJECTED_EXAMPLES = 200;
const MAX_RULES_PER_SOURCE = 20_000;

const CAPABILITIES: Record<string, boolean> = {
  adguard: false,
  adguard_app_android: false,
  adguard_app_windows: false,
  adguard_app_mac: false,
  adguard_app_cli: false,
  adguard_ext_chromium: false,
  adguard_ext_firefox: false,
  adguard_ext_opera: false,
  adguard_ext_chromium_mv3: false,
  ext_ublock: false,
  ext_ubol: false,
  env_chromium: false,
  env_firefox: false,
  env_mobile: false,
};

const conditionTokens = (expression: string): string[] =>
  expression.match(/[A-Za-z_][A-Za-z0-9_]*|&&|\|\||!|\(|\)/g) ?? [];

const evaluateCondition = (expression: string): boolean | null => {
  const tokens = conditionTokens(expression);
  let index = 0;

  const parsePrimary = (): boolean | null => {
    const token = tokens[index++];

    if (token === "!") {
      const value = parsePrimary();
      return value === null ? null : !value;
    }

    if (token === "(") {
      const value = parseOr();

      if (tokens[index++] !== ")") {
        return null;
      }

      return value;
    }

    if (!token || !/^[A-Za-z_]/.test(token)) {
      return null;
    }

    return Object.prototype.hasOwnProperty.call(CAPABILITIES, token)
      ? CAPABILITIES[token]!
      : null;
  };

  const parseAnd = (): boolean | null => {
    let value = parsePrimary();

    while (tokens[index] === "&&") {
      index++;
      const right = parsePrimary();

      if (value === null || right === null) {
        value = null;
      } else {
        value = value && right;
      }
    }

    return value;
  };

  const parseOr = (): boolean | null => {
    let value = parseAnd();

    while (tokens[index] === "||") {
      index++;
      const right = parseAnd();

      if (value === null || right === null) {
        value = null;
      } else {
        value = value || right;
      }
    }

    return value;
  };

  const result = parseOr();

  return index === tokens.length ? result : null;
};

const splitModifiers = (value: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let inRegex = false;
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }

    if (character === "/") {
      inRegex = !inRegex;
      current += character;
      continue;
    }

    if (character === "," && !inRegex) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
};

const escapeLiteral = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hostHintFor = (hostExpression: string): string[] => {
  let host = hostExpression.trim().toLowerCase();

  if (!host || host === "*") {
    return [];
  }

  if (host.startsWith("*.")) {
    host = host.slice(2);
  }

  const wildcard = host.indexOf("*");

  if (wildcard !== -1) {
    host = host.slice(0, wildcard);
  }

  host = host.replace(/\.$/, "");

  return isValidHostHint(host) ? [host] : [];
};

const hostExpressionFor = (pattern: string): string => {
  let body = pattern.replace(/^\|\|/, "");
  const stop = body.search(/[/^]/);

  if (stop !== -1) {
    body = body.slice(0, stop);
  }

  return body.trim();
};

const adguardPatternToRegex = (pattern: string): string | null => {
  let source = pattern.trim();

  if (!source) {
    return null;
  }

  let prefix = "^";
  let suffix = "";

  if (source.startsWith("||")) {
    prefix = "^https?:\\/\\/(?:[a-z0-9-]+\\.)*?";
    source = source.slice(2);
  } else if (source.startsWith("|")) {
    source = source.slice(1);
  }

  if (source.endsWith("|")) {
    suffix = "$";
    source = source.slice(0, -1);
  }

  let result = "";

  for (const character of source) {
    if (character === "*") {
      result += ".*";
    } else if (character === "^") {
      result += "(?:[\\/?#]|$)";
    } else {
      result += escapeLiteral(character);
    }
  }

  return `${prefix}${result}${suffix}`;
};

const pairRegexFromPattern = (
  pattern: string,
  key?: string
): string | null => {
  let source = pattern
    .trim()
    .replace(/^[?&]/, "")
    .replace(/^\^/, "")
    .replace(/\^$/, "")
    .replace(/\$$/, "");

  const separator = source.indexOf("=");

  if (separator <= 0) {
    return null;
  }

  if (source.slice(0, separator).includes("/")) {
    return null;
  }

  const left = source.slice(0, separator);

  if (key && left.toLowerCase() !== key.toLowerCase()) {
    return null;
  }

  let result = "";

  for (const character of source) {
    if (character === "*") {
      result += ".*";
    } else if (character === "^") {
      result += "(?:[\\/?#]|$)";
    } else {
      result += escapeLiteral(character);
    }
  }

  return `^${result}$`;
};

const regexSource = (value: string): { source: string; flags: string } | null => {
  if (!value.startsWith("/")) {
    return null;
  }

  let escaped = false;

  for (let index = value.length - 1; index > 0; index--) {
    const character = value[index];

    if (character === "/" && !escaped) {
      const source = value.slice(1, index);
      const flags = value.slice(index + 1);

      if (!/^[a-z]*$/.test(flags) || flags.includes("g")) {
        return null;
      }

      try {
        new RegExp(source, flags.replace(/y/g, ""));
      } catch {
        return null;
      }

      return { source, flags };
    }

    escaped = character === "\\" && !escaped;
  }

  return null;
};

const keyRegexSource = (source: string): string => {
  if (source.startsWith("^")) {
    return source;
  }

  return `^.*(?:${source}).*$`;
};

const simplePrefix = (source: string): string | null => {
  const match = source.match(
    /^\^([A-Za-z0-9_%.-]+)(?:\.\*)?\$?$/
  );

  return match?.[1]?.toLowerCase() ?? null;
};

const providerId = (host: string, urlPattern: string): string => {
  const hash = crypto
    .createHash("sha1")
    .update(urlPattern)
    .digest("hex")
    .slice(0, 8);
  const label = host.replace(/[^a-z0-9.-]/gi, "-").slice(0, 150);

  return `adguard:${label}:${hash}`;
};

const cleanDomain = (value: string): string | null => {
  let domain = value.trim().toLowerCase();

  if (!domain || domain === "*") {
    return null;
  }

  if (domain.startsWith("~")) {
    domain = domain.slice(1);
  }

  if (domain.startsWith("*.")) {
    domain = domain.slice(2);
  }

  const wildcard = domain.indexOf("*");

  if (wildcard !== -1) {
    domain = domain.slice(0, wildcard);
  }

  domain = domain.replace(/\.$/, "");

  return isValidHostHint(domain) ? domain : null;
};

const addRejection = (
  report: ParsedTrackerSources["report"],
  file: string,
  line: number,
  rule: string,
  reason: string
): void => {
  report.files[file]!.rejected++;
  report.rejections[reason] = (report.rejections[reason] ?? 0) + 1;

  if (report.rejectedExamples.length < MAX_REJECTED_EXAMPLES) {
    report.rejectedExamples.push({ file, line, reason, rule });
  }
};

const emptyReport = (): ParsedTrackerSources["report"] => ({
  files: {},
  counts: {
    genericExact: 0,
    genericPrefixes: 0,
    genericPatterns: 0,
    genericPairPatterns: 0,
    genericExceptions: 0,
    excludeHosts: 0,
    providers: 0,
    providerRules: 0,
    providerPairPatterns: 0,
    allowlistExceptions: 0,
    exceptionConversions: 0,
  },
  rejections: {},
  rejectedExamples: [],
  conversions: [],
  conflicts: [],
});

const createGeneric = () => ({
  exact: new Set<string>(),
  prefixes: new Set<string>(),
  patterns: new Set<string>(),
  pairPatterns: new Set<string>(),
  exceptions: new Set<string>(),
  excludeHosts: new Set<string>(),
});

export const parseTrackerSources = (
  sources: readonly TrackerSourceInput[]
): ParsedTrackerSources => {
  const report = emptyReport();
  const generic = createGeneric();
  const providers = new Map<string, ProviderDraft>();
  const allowlistExceptions = new Map<string, Set<string>>();
  const removalsByHost = new Map<string, Set<string>>();
  const exceptionsByHost = new Map<string, Set<string>>();

  const ensureProvider = (
    host: string,
    pattern: string
  ): ProviderDraft | null => {
    const urlPattern = adguardPatternToRegex(pattern);

    if (!urlPattern) {
      return null;
    }

    const key = urlPattern;
    const existing = providers.get(key);

    if (existing) {
      return existing;
    }

    const draft: ProviderDraft = {
      id: providerId(host, urlPattern),
      urlPattern,
      hostHints: hostHintFor(host),
      completeProvider: false,
      rules: new Set(),
      pairPatterns: new Set(),
      exceptions: new Set(),
      redirections: new Set(),
      rawRules: new Set(),
    };

    providers.set(key, draft);

    return draft;
  };

  const addRemoval = (
    host: string,
    pattern: string,
    key: string,
    regex: { source: string; flags: string } | null
  ): boolean => {
    const provider = host ? ensureProvider(host, pattern) : null;

    if (host && !provider) {
      return false;
    }

    if (regex) {
      if (regex.source.includes("=")) {
        if (provider) {
          provider.pairPatterns.add(regex.source);
        } else {
          generic.pairPatterns.add(regex.source);
        }

        return true;
      }

      const prefix = simplePrefix(regex.source);

      if (prefix) {
        if (provider) {
          provider.rules.add(prefix);
        } else {
          generic.prefixes.add(prefix);
        }

        return true;
      }

      if (provider) {
        provider.rules.add(regex.source);
      } else {
        generic.patterns.add(keyRegexSource(regex.source));
      }

      return true;
    }

    if (provider) {
      provider.rules.add(key.toLowerCase());
    } else {
      generic.exact.add(key.toLowerCase());
    }

    return true;
  };

  for (const source of sources) {
    const file = source.file;
    const lines = source.text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const conditionalStack: Array<boolean | null> = [];

    report.files[file] = {
      considered: 0,
      accepted: 0,
      rejected: 0,
    };

    for (let index = 0; index < lines.length; index++) {
      const raw = lines[index]!.trim();
      const lineNumber = index + 1;

      if (!raw) {
        continue;
      }

      if (raw.startsWith("!#")) {
        if (raw.startsWith("!#if")) {
          conditionalStack.push(evaluateCondition(raw.slice(4).trim()));
        } else if (raw.startsWith("!#else")) {
          if (conditionalStack.length > 0) {
            const last = conditionalStack.length - 1;
            conditionalStack[last] =
              conditionalStack[last] === null
                ? null
                : !conditionalStack[last];
          }
        } else if (raw.startsWith("!#endif")) {
          conditionalStack.pop();
        }

        continue;
      }

      if (raw.startsWith("!")) {
        continue;
      }

      if (conditionalStack.some((value) => value !== true)) {
        continue;
      }

      report.files[file]!.considered++;

      if (report.files[file]!.considered > MAX_RULES_PER_SOURCE) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "source_too_large"
        );
        continue;
      }

      if (
        raw.includes("##") ||
        raw.includes("#@#") ||
        raw.includes("#$#") ||
        raw.includes("#%#") ||
        raw.includes("#?#")
      ) {
        addRejection(report, file, lineNumber, raw.slice(0, 240), "cosmetic_filter");
        continue;
      }

      if (!raw.includes("$")) {
        addRejection(report, file, lineNumber, raw.slice(0, 240), "no_modifiers");
        continue;
      }

      const separator = raw.indexOf("$");
      let pattern = raw.slice(0, separator).trim();
      const modifiers = splitModifiers(raw.slice(separator + 1));
      const exception = pattern.startsWith("@@");

      if (exception) {
        pattern = pattern.slice(2);
      }

      const modifierNames = modifiers.map((part) =>
        part.split("=", 1)[0]!.toLowerCase()
      );
      const allowed = new Set([
        "removeparam",
        "domain",
        "doc",
        "document",
        "~doc",
        "~third-party",
        "~xmlhttprequest",
        "~image",
        "~subdocument",
        "~script",
        "~stylesheet",
        "~media",
        "~font",
        "~ping",
        "~xhr",
        "image",
        "subdocument",
        "xmlhttprequest",
        "script",
        "stylesheet",
        "media",
        "font",
        "ping",
        "xhr",
      ]);
      const unsupported = modifierNames.filter((name) => !allowed.has(name));
      const positiveResource = modifierNames.filter((name) =>
        [
          "image",
          "subdocument",
          "xmlhttprequest",
          "script",
          "stylesheet",
          "media",
          "font",
          "ping",
          "xhr",
        ].includes(name)
      );

      if (unsupported.length > 0) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          `unsupported_modifier:${unsupported[0]}`
        );
        continue;
      }

      if (positiveResource.length > 0) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "resource_restricted"
        );
        continue;
      }

      if (modifierNames.includes("~doc")) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "document_excluded"
        );
        continue;
      }

      if (modifierNames.includes("~third-party")) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "third_party_restricted"
        );
        continue;
      }

      const removeparam = modifiers.find((part) =>
        part.toLowerCase().startsWith("removeparam")
      );

      if (!removeparam) {
        addRejection(report, file, lineNumber, raw.slice(0, 240), "no_removeparam");
        continue;
      }

      const removeparamValue = removeparam.includes("=")
        ? removeparam.slice(removeparam.indexOf("=") + 1)
        : "";
      const domainModifier = modifiers.find((part) =>
        part.toLowerCase().startsWith("domain=")
      );
      const domainValues = domainModifier
        ? domainModifier.slice(domainModifier.indexOf("=") + 1).split("|")
        : [];
      const positiveDomains = domainValues
        .filter((value) => !value.startsWith("~"))
        .map(cleanDomain)
        .filter((value): value is string => value !== null);
      const negativeDomains = domainValues
        .filter((value) => value.startsWith("~"))
        .map(cleanDomain)
        .filter((value): value is string => value !== null);

      if (exception) {
        const host = hostExpressionFor(pattern);
        const isHostPattern = pattern.startsWith("||") && Boolean(host);
        const key =
          removeparamValue === "" || removeparamValue === "*"
            ? "*"
            : removeparamValue.toLowerCase();
        const hasNegativeDomain = negativeDomains.length > 0;
        const hasPositiveDomain = positiveDomains.length > 0;

        if (hasNegativeDomain) {
          addRejection(
            report,
            file,
            lineNumber,
            raw.slice(0, 240),
            "negative_domain_exception"
          );
          continue;
        }

        const addAllowlist = (domain: string, source: string): void => {
          const keys =
            allowlistExceptions.get(domain) ?? new Set<string>();

          keys.add(key);
          allowlistExceptions.set(domain, keys);

          const hostKeys =
            exceptionsByHost.get(domain) ?? new Set<string>();
          hostKeys.add(key);
          exceptionsByHost.set(domain, hostKeys);

          report.conversions.push({
            file,
            line: lineNumber,
            rule: raw.slice(0, 240),
            host: domain,
            key,
            source,
          });
        };

        if (isHostPattern) {
          const domain = cleanDomain(host);

          if (!domain) {
            addRejection(
              report,
              file,
              lineNumber,
              raw.slice(0, 240),
              "invalid_exception_host"
            );
            continue;
          }

          addAllowlist(
            domain,
            pattern.replace(/^\|\|/, "").replace(/\^$/, "") === host
              ? "host_exception"
              : "path_scoped_exception"
          );
          report.files[file]!.accepted++;
          continue;
        }

        if (!pattern) {
          if (hasPositiveDomain) {
            for (const domain of positiveDomains) {
              addAllowlist(domain, "domain_scoped_exception");
            }
            report.files[file]!.accepted++;
            continue;
          }

          addRejection(
            report,
            file,
            lineNumber,
            raw.slice(0, 240),
            "empty_exception_pattern"
          );
          continue;
        }

        if (hasPositiveDomain) {
          for (const domain of positiveDomains) {
            addAllowlist(domain, "domain_scoped_exception");
          }
          report.files[file]!.accepted++;
          continue;
        }

        const source = pattern.startsWith("^")
          ? pattern.slice(1)
          : pattern;
        const escaped = escapeLiteral(source.replace(/\^$/, ""));
        const prefix = pattern.startsWith("^") ? "^.*\\?" : "^.*";
        generic.exceptions.add(`${prefix}${escaped}.*$`);

        report.files[file]!.accepted++;
        continue;
      }

      if (removeparamValue === "" || removeparamValue === "*") {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "bare_removeparam"
        );
        continue;
      }

      const regex = regexSource(removeparamValue);
      const literal = regex
        ? null
        : removeparamValue
            .replace(/^\?/, "")
            .replace(/^%3F/i, "");

      if (
        !regex &&
        (!literal || !/^[A-Za-z0-9_%.-]+$/.test(literal))
      ) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "invalid_removeparam"
        );
        continue;
      }

      if (pattern.startsWith("||")) {
        const host = hostExpressionFor(pattern);

        if (!host || host === "*") {
          addRejection(
            report,
            file,
            lineNumber,
            raw.slice(0, 240),
            "invalid_host_pattern"
          );
          continue;
        }

        if (negativeDomains.length > 0) {
          addRejection(
            report,
            file,
            lineNumber,
            raw.slice(0, 240),
            "negative_domain_on_host_rule"
          );
          continue;
        }

        const hosts =
          positiveDomains.length > 0 ? positiveDomains : [host];

        for (const candidate of hosts) {
          if (
            !addRemoval(
              candidate,
              positiveDomains.length > 0
                ? `||${candidate}^`
                : pattern,
              literal ?? "",
              regex
            )
          ) {
            addRejection(
              report,
              file,
              lineNumber,
              raw.slice(0, 240),
              "invalid_provider_pattern"
            );
            continue;
          }

          const key = regex
            ? regex.source
            : (literal ?? "").toLowerCase();
          const removalKeys = removalsByHost.get(candidate) ?? new Set<string>();
          removalKeys.add(key);
          removalsByHost.set(candidate, removalKeys);
        }

        report.files[file]!.accepted++;
        continue;
      }

      if (negativeDomains.length > 0) {
        for (const domain of negativeDomains) {
          generic.excludeHosts.add(domain);
        }
      }

      if (positiveDomains.length > 0) {
        for (const domain of positiveDomains) {
          if (
            !addRemoval(
              domain,
              `||${domain}^`,
              literal ?? "",
              regex
            )
          ) {
            addRejection(
              report,
              file,
              lineNumber,
              raw.slice(0, 240),
              "invalid_domain_provider"
            );
            continue;
          }

          const key = regex
            ? regex.source
            : (literal ?? "").toLowerCase();
          const removalKeys = removalsByHost.get(domain) ?? new Set<string>();
          removalKeys.add(key);
          removalsByHost.set(domain, removalKeys);
        }

        report.files[file]!.accepted++;
        continue;
      }

      if (pattern && pattern !== "*") {
        const pair = pairRegexFromPattern(
          pattern,
          literal ?? undefined
        );

        if (pair) {
          generic.pairPatterns.add(pair);
          report.files[file]!.accepted++;
          continue;
        }

        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "url_pattern_removal"
        );
        continue;
      }

      if (!addRemoval("", "", literal ?? "", regex)) {
        addRejection(
          report,
          file,
          lineNumber,
          raw.slice(0, 240),
          "invalid_global_rule"
        );
        continue;
      }

      report.files[file]!.accepted++;
    }
  }

  for (const [host, keys] of allowlistExceptions) {
    const removalKeys = removalsByHost.get(host);

    if (!removalKeys) {
      continue;
    }

    for (const key of keys) {
      if (key === "*") {
        for (const removal of removalKeys) {
          report.conflicts.push({
            host,
            key: "*",
            removal,
            exception: "*",
            resolution: "preserve",
          });
        }
        continue;
      }

      if (removalKeys.has(key)) {
        report.conflicts.push({
          host,
          key,
          removal: key,
          exception: key,
          resolution: "preserve",
        });
      }
    }
  }

  const providerList: Provider[] = [...providers.values()]
    .map((draft) => ({
      id: draft.id,
      urlPattern: draft.urlPattern,
      hostHints: draft.hostHints,
      completeProvider: draft.completeProvider,
      rules: [...draft.rules].sort(),
      pairPatterns: [...draft.pairPatterns].sort(),
      referralMarketing: [],
      exceptions: [...draft.exceptions].sort(),
      redirections: [...draft.redirections].sort(),
      rawRules: [...draft.rawRules].sort(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const genericResult: ParsedGenericRules = {
    exact: [...generic.exact].sort(),
    prefixes: [...generic.prefixes].sort(),
    patterns: [...generic.patterns].sort(),
    pairPatterns: [...generic.pairPatterns].sort(),
    exceptions: [...generic.exceptions].sort(),
    excludeHosts: [...generic.excludeHosts].sort(),
  };

  report.counts = {
    genericExact: genericResult.exact.length,
    genericPrefixes: genericResult.prefixes.length,
    genericPatterns: genericResult.patterns.length,
    genericPairPatterns: genericResult.pairPatterns.length,
    genericExceptions: genericResult.exceptions.length,
    excludeHosts: genericResult.excludeHosts.length,
    providers: providerList.length,
    providerRules: providerList.reduce(
      (sum, provider) => sum + provider.rules.length,
      0
    ),
    providerPairPatterns: providerList.reduce(
      (sum, provider) => sum + provider.pairPatterns.length,
      0
    ),
    allowlistExceptions: [...allowlistExceptions.values()].reduce(
      (sum, keys) => sum + keys.size,
      0
    ),
    exceptionConversions: report.conversions.length,
  };

  return {
    generic: genericResult,
    providers: providerList,
    allowlistExceptions: Object.fromEntries(
      [...allowlistExceptions.entries()].map(([domain, keys]) => [
        domain,
        [...keys].sort(),
      ])
    ),
    report,
  };
};
