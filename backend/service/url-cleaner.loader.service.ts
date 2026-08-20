import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads the URL-cleaning behaviour knobs from `config/url-cleaner.json` once
 * at startup so request-time cleaning never touches the filesystem.
 *
 * Falls back to safe defaults for any key that is missing or malformed.
 */

interface UrlCleanerConfig {
  maxDepth?: number;
  enableGenericRedirectUnwrap?: boolean;
  genericUnwrapParameters?: string[];
  removeJunkFragments?: boolean;
  allowlistedParameters?: {
    global?: string[];
    domains?: Record<string, string[]>;
  };
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
    `URL cleaner config file not found: ${filename}`
  );
};

const config = JSON.parse(
  readConfigFile("url-cleaner.json")
) as UrlCleanerConfig;

/**
 * Maximum nesting depth for redirect-wrapper unwrapping.
 *
 * A chain deeper than this is rejected rather than resolved, because a
 * deeply nested wrapper is more likely to be hiding the real destination.
 */
const configuredMaxDepth = Number(config.maxDepth);

export const MAX_CLEANING_DEPTH =
  Number.isFinite(configuredMaxDepth) &&
  configuredMaxDepth > 0
    ? configuredMaxDepth
    : 3;

/**
 * Whether to also unwrap redirect parameters on providers that have no
 * explicit ClearURLs redirection rules.
 */
export const ENABLE_GENERIC_REDIRECT_UNWRAP =
  config.enableGenericRedirectUnwrap !== false;

/**
 * Query parameter names that are treated as redirect carriers when their
 * value is an absolute HTTP(S) URL.
 */
export const GENERIC_UNWRAP_PARAMETERS = new Set<string>(
  (config.genericUnwrapParameters ?? []).map(
    (parameter) => parameter.toLowerCase()
  )
);

/**
 * Whether empty / tracking-only URL fragments should be dropped.
 */
export const REMOVE_JUNK_FRAGMENTS =
  config.removeJunkFragments !== false;

/**
 * Query parameter names that must always survive cleaning, regardless of
 * what the global or provider-specific rules would remove.
 *
 * Matched case-sensitively on the decoded parameter name: `v` is protected
 * while `V` is not, because allowlists protect exact functional parameters.
 */
export const GLOBAL_ALLOWLISTED_PARAMETERS = new Set<string>(
  config.allowlistedParameters?.global ?? []
);

/**
 * Same as above but scoped to a hostname (or any subdomain of it).
 */
export const DOMAIN_ALLOWLISTED_PARAMETERS: Record<
  string,
  string[]
> =
  config.allowlistedParameters?.domains ?? {};