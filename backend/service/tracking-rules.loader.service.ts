import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads and compiles the tracking-removal rules from `config/` JSON files at
 * startup:
 *
 *  - `tracking-rules.json`   → global parameters / prefixes / patterns.
 *  - `clearurls-data.json`   → provider-specific ClearURLs rules.
 *
 * Rules are compiled to `RegExp`/`Set` once so request-time cleaning is fast
 * and never touches the filesystem.
 */

interface ClearURLsRule {
  urlPattern: string;
  completeProvider?: boolean;
  rules?: string[];
  rawRules?: string[];
  referralMarketing?: string[];
  exceptions?: string[];
  redirections?: string[];
  forceRedirection?: boolean;
}

interface ClearURLsData {
  providers: Record<string, ClearURLsRule>;
}

export interface CompiledProvider {
  name: string;
  urlPattern: RegExp;
  completeProvider: boolean;

  rules: RegExp[];
  rawRules: RegExp[];

  referralMarketing: RegExp[];
  exceptions: RegExp[];
  redirections: RegExp[];

  forceRedirection: boolean;
}

const readConfigFile = (
  filename: string
): string => {
  const moduleDir = path.dirname(
    fileURLToPath(import.meta.url)
  );

  const candidates = [
    path.join(
      moduleDir,
      "..",
      "config",
      filename
    ),

    path.join(
      process.cwd(),
      "config",
      filename
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(
        candidate,
        "utf-8"
      );
    }
  }

  throw new Error(
    `Tracking config file not found: ${filename}`
  );
};

const globalRules = JSON.parse(
  readConfigFile("tracking-rules.json")
) as {
  parameters: string[];
  prefixes: string[];
  patterns: string[];
};

const clearURLsData = JSON.parse(
  readConfigFile("clearurls-data.json")
) as ClearURLsData;

export const TRACKING_PARAMETERS =
  new Set<string>(
    globalRules.parameters.map((parameter) =>
      parameter.toLowerCase()
    )
  );

export const TRACKING_PREFIXES: string[] =
  globalRules.prefixes.map((prefix) =>
    prefix.toLowerCase()
  );

export const TRACKING_PATTERNS: RegExp[] =
  globalRules.patterns.map(
    (pattern) => new RegExp(pattern, "i")
  );

export const CLEARURLS_PROVIDERS: CompiledProvider[] =
  Object.entries(
    clearURLsData.providers
  ).map(([name, provider]) => {
    return {
      name,

      urlPattern: new RegExp(
        provider.urlPattern,
        "i"
      ),

      completeProvider:
        provider.completeProvider === true,

      /**
       * Query parameter rules.
       *
       * Anchoring prevents partial matches.
       *
       * "qid" matches "qid"
       * but not "myqidvalue".
       */
      rules: (provider.rules ?? []).map(
        (rule) =>
          new RegExp(
            `^(?:${rule})$`,
            "i"
          )
      ),

      /**
       * Raw URL rules.
       *
       * These operate against the actual URL,
       * not URLSearchParams.
       *
       * Amazon example:
       * /ref=sr_1_3
       */
      rawRules: (
        provider.rawRules ?? []
      ).map(
        (rule) =>
          new RegExp(rule, "gi")
      ),

      /**
       * Referral / affiliate parameters.
       */
      referralMarketing: (
        provider.referralMarketing ?? []
      ).map(
        (rule) =>
          new RegExp(
            `^(?:${rule})$`,
            "i"
          )
      ),

      /**
       * URLs that should not be cleaned
       * by this provider.
       */
      exceptions: (
        provider.exceptions ?? []
      ).map(
        (rule) =>
          new RegExp(rule, "i")
      ),

      /**
       * Redirect extraction rules.
       *
       * You can implement the actual
       * redirection behavior later.
       */
      redirections: (
        provider.redirections ?? []
      ).map(
        (rule) =>
          new RegExp(rule, "i")
      ),

      forceRedirection:
        provider.forceRedirection === true,
    };
  });