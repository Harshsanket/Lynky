import { TRACKING_PARAMETERS } from "./list-tracking-parameter.service.js";
import { TRACKING_PREFIXES } from "./list-tracking-prefix.service.js";
import { TRACKING_PATTERNS } from "./list-tracking-pattern.service.js";

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