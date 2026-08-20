import {
  TRACKING_PARAMETERS,
  TRACKING_PREFIXES,
  TRACKING_PATTERNS,
} from "./tracking-rules.loader.service.js";

/**
 * Whether a query parameter key should be stripped as tracking noise.
 * Checks exact names, shared prefixes, and regex patterns from the rules
 * loaded at startup.
 */
export const isTrackingParameter = (
  key: string
): boolean => {
  const normalizedKey = key.toLowerCase();

  if (TRACKING_PARAMETERS.has(normalizedKey)) {
    return true;
  }

  if (
    TRACKING_PREFIXES.some((prefix) =>
      normalizedKey.startsWith(prefix)
    )
  ) {
    return true;
  }

  return TRACKING_PATTERNS.some((pattern) =>
    pattern.test(normalizedKey)
  );
};
