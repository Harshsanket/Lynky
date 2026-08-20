import { CLEARURLS_PROVIDERS } from "./tracking-rules.loader.service.js";
import { isTrackingParameter } from "./tracking-checker.service.js";
import {
  MAX_CLEANING_DEPTH,
  ENABLE_GENERIC_REDIRECT_UNWRAP,
  GENERIC_UNWRAP_PARAMETERS,
  REMOVE_JUNK_FRAGMENTS,
  GLOBAL_ALLOWLISTED_PARAMETERS,
  DOMAIN_ALLOWLISTED_PARAMETERS,
} from "./url-cleaner.loader.service.js";
import { PublicError } from "./public-error.service.js";

export interface CleanUrlOptions {
  depth?: number;
  maxDepth?: number;
}

/**
 * Decode a percent-encoded string, returning it untouched when it is not
 * valid percent-encoding.
 */
const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Whether a value looks like an absolute HTTP(S) URL with a host.
 */
const isHttpUrl = (value: string): boolean => {
  const trimmed = value.trim();

  if (!/^https?:\/\/[^/\s]/i.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
};

/**
 * Progressive percent-decoding variants of a value, used to spot tracking
 * parameters hidden behind single or double encoding (e.g. `%75tm_source`
 * or `%2575tm_source`).
 */
const decodeVariants = (value: string): string[] => {
  const variants: string[] = [];
  let current = value;

  for (let i = 0; i < 3; i++) {
    let decoded: string;

    try {
      decoded = decodeURIComponent(current);
    } catch {
      break;
    }

    if (decoded === current) {
      break;
    }

    variants.push(decoded);
    current = decoded;
  }

  return variants;
};

/**
 * Whether a query parameter key is a tracking parameter, including keys that
 * only reveal themselves after one or more decoding passes.
 */
const isTrackingKey = (key: string): boolean => {
  if (isTrackingParameter(key)) {
    return true;
  }

  return decodeVariants(key).some(
    (variant) =>
      variant !== key && isTrackingParameter(variant)
  );
};

/**
 * Collect the allowlisted parameter names for a host: the global allowlist
 * plus any allowlist attached to the hostname or one of its domains.
 */
const buildAllowlist = (hostname: string): Set<string> => {
  const list = new Set<string>(GLOBAL_ALLOWLISTED_PARAMETERS);
  const host = hostname.toLowerCase();

  for (const [domain, parameters] of Object.entries(
    DOMAIN_ALLOWLISTED_PARAMETERS
  )) {
    const key = domain.toLowerCase();

    if (host === key || host.endsWith(`.${key}`)) {
      for (const parameter of parameters) {
        list.add(parameter);
      }
    }
  }

  return list;
};

/**
 * Detect a redirect-wrapper and return the URL it hides.
 *
 * Provider-specific ClearURLs redirection rules are tried first because they
 * are precise. The generic parameter check runs afterwards on known
 * redirect-carrier parameter names.
 */
const extractWrappedUrl = (
  urlString: string,
  url: URL
): string | null => {
  for (const provider of CLEARURLS_PROVIDERS) {
    if (!provider.urlPattern.test(urlString)) {
      continue;
    }

    for (const redirection of provider.redirections) {
      const match = urlString.match(redirection);
      const captured = match?.[1];

      if (!captured) {
        continue;
      }

      const decoded = decodeSafe(captured);

      if (isHttpUrl(decoded)) {
        return decoded;
      }
    }
  }

  if (!ENABLE_GENERIC_REDIRECT_UNWRAP) {
    return null;
  }

  for (const key of url.searchParams.keys()) {
    if (!GENERIC_UNWRAP_PARAMETERS.has(key.toLowerCase())) {
      continue;
    }

    const value = url.searchParams.get(key);

    if (value && isHttpUrl(value)) {
      return value;
    }
  }

  return null;
};

/**
 * Remove duplicate query parameters, keeping the first occurrence.
 */
const dedupeParams = (url: URL): void => {
  const seen = new Set<string>();
  const entries: Array<[string, string]> = [];

  for (const [key, value] of url.searchParams) {
    if (!seen.has(key)) {
      seen.add(key);
      entries.push([key, value]);
    }
  }

  url.search = "";

  for (const [key, value] of entries) {
    url.searchParams.append(key, value);
  }
};

/**
 * Remove the port when it is redundant for the protocol.
 */
const normalizePorts = (url: URL): void => {
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }
};

/**
 * Whether a fragment is empty or contains only tracking junk.
 */
const isJunkFragment = (fragment: string): boolean => {
  if (fragment === "") {
    return true;
  }

  const decoded = decodeSafe(fragment);

  if (
    decoded === "" ||
    decoded === "#" ||
    decoded === "!" ||
    decoded === "/"
  ) {
    return true;
  }

  const tokens = decoded
    .split("&")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => {
    const key = token.split("=")[0] ?? token;
    return key === "" || isTrackingKey(key);
  });
};

/**
 * Clean a URL of tracking and other unnecessary baggage.
 *
 * Pipeline:
 *  1. Validate and parse; reject non-HTTP(S) schemes (`javascript:`,
 *     `data:`, ...), malformed URLs, and backslash tricks.
 *  2. Unwrap known redirect wrappers and recursively clean what they hide,
 *     bounded by a depth limit.
 *  3. Apply provider-specific (ClearURLs) cleaning rules.
 *  4. Remove global tracking parameters, including encoded lookalikes.
 *  5. Deduplicate parameters and drop empty/junk fragments.
 *  6. Normalize the host, ports, and empty query/fragment suffixes.
 *
 * Allowlisted parameters (global and per-domain) always survive cleaning.
 */
export const cleanUrl = (
  inputUrl: string,
  options: CleanUrlOptions = {}
): string => {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? MAX_CLEANING_DEPTH;

  if (depth > maxDepth) {
    throw new PublicError(
      `Maximum URL cleaning depth of ${maxDepth} exceeded`
    );
  }

  if (typeof inputUrl !== "string") {
    throw new PublicError("URL is required");
  }

  const originalUrlString = inputUrl.trim();

  if (!originalUrlString) {
    throw new PublicError("URL is required");
  }

  if (originalUrlString.includes("\\")) {
    throw new PublicError("Invalid URL");
  }

  let url: URL;

  try {
    url = new URL(originalUrlString);
  } catch {
    throw new PublicError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicError("Only HTTP and HTTPS URLs are allowed");
  }

  if (!url.hostname) {
    throw new PublicError("Invalid URL");
  }

  // Strip a trailing root-domain dot.
  if (url.hostname.endsWith(".")) {
    url.hostname = url.hostname.slice(0, -1);
  }

  // IDN hosts were already converted to their ASCII (punycode) form by the
  // WHATWG parser, so provider matching below works against the canonical
  // hostname.
  const normalizedUrlString = url.toString();

  // 1. Redirect-wrapper detection.
  const wrappedUrl = extractWrappedUrl(
    normalizedUrlString,
    url
  );

  if (wrappedUrl) {
    if (depth < maxDepth) {
      return cleanUrl(wrappedUrl, {
        depth: depth + 1,
        maxDepth,
      });
    }

    throw new PublicError(
      `Maximum URL cleaning depth of ${maxDepth} exceeded`
    );
  }

  const allowlist = buildAllowlist(url.hostname);

  // 2. Provider-specific (ClearURLs) cleaning.
  //
  // Every matching provider is applied. The `globalRules` provider matches
  // every URL, and domain-specific providers add their rules on top of it.
  for (const provider of CLEARURLS_PROVIDERS) {
    if (!provider.urlPattern.test(normalizedUrlString)) {
      continue;
    }

    const isException = provider.exceptions.some(
      (exception) => exception.test(normalizedUrlString)
    );

    if (isException) {
      continue;
    }

    if (provider.completeProvider) {
      for (const key of [...url.searchParams.keys()]) {
        if (!allowlist.has(key)) {
          url.searchParams.delete(key);
        }
      }
    } else {
      for (const key of [...url.searchParams.keys()]) {
        if (allowlist.has(key)) {
          continue;
        }

        for (const rule of provider.rules) {
          if (rule.test(key)) {
            url.searchParams.delete(key);
            break;
          }
        }
      }
    }

    // Raw URL rules operate against the serialized URL, not just the query.
    if (provider.rawRules.length > 0) {
      let cleanedUrlString = url.toString();

      for (const rawRule of provider.rawRules) {
        cleanedUrlString = cleanedUrlString.replace(
          rawRule,
          ""
        );
      }

      url = new URL(cleanedUrlString);
    }
  }

  // 3. Global tracking removal, including encoded lookalikes.
  for (const key of [...url.searchParams.keys()]) {
    if (allowlist.has(key)) {
      continue;
    }

    if (isTrackingKey(key)) {
      url.searchParams.delete(key);
    }
  }

  // 4. Duplicate parameter handling.
  dedupeParams(url);

  // 5. Drop parameters with an empty key.
  for (const key of [...url.searchParams.keys()]) {
    if (key === "") {
      url.searchParams.delete(key);
    }
  }

  // 6. Empty / junk fragment removal.
  if (
    REMOVE_JUNK_FRAGMENTS &&
    url.hash !== "" &&
    isJunkFragment(url.hash.slice(1))
  ) {
    url.hash = "";
  }

  // 7. Final normalization.
  normalizePorts(url);

  let result = url.toString();

  // The WHATWG serializer keeps an explicit trailing `?` / `#` even when the
  // search/hash are empty, so strip those leftover separators explicitly.
  if (result.endsWith("#")) {
    result = result.slice(0, -1);
  }

  if (result.endsWith("?")) {
    result = result.slice(0, -1);
  }

  return result;
};