import { z } from "zod";
import {
  isValidHostHint,
  isValidHostname,
  normalizeHostname,
} from "../hostname.js";

/**
 * Shared primitives for the config schemas. These run at build/validate time
 * only; the runtime uses small hand-written artifact assertions instead.
 */

export const CONFIG_SCHEMA_VERSION = 1;

export { isValidHostHint, isValidHostname, normalizeHostname };

export const hostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .refine(isValidHostname, "must be a valid lowercase hostname");

export const hostHintSchema = z
  .string()
  .min(1)
  .max(253)
  .refine(isValidHostHint, "must be a valid host hint");

/**
 * Classic catastrophic-backtracking shape: a single-token group (`(a+)`,
 * `(.*)`, `([a-z]+)`) repeated by a greedy quantifier. Upstream ClearURLs
 * uses many lazy host-prefix groups such as `(?:[a-z0-9-]+\.)*?`, which are
 * bounded by the hostname length and must remain valid.
 */
const SIMPLE_GROUP_REPEAT =
  /\((?:\?:)?(?:\.|\\[wdsWDS]|\[[^\]]+\]|[a-zA-Z0-9])[+*]\)[+*{](?!\?)/;

const BACKREFERENCE = /\\[1-9]/;

/**
 * Cheap regex-safety screen. It rejects the classic catastrophic-backtracking
 * shapes and backreferences; it is intentionally conservative rather than a
 * complete ReDoS proof.
 */
export const isSafeRegex = (pattern: string): boolean => {
  if (pattern.length > 4096) {
    return false;
  }

  if (SIMPLE_GROUP_REPEAT.test(pattern)) {
    return false;
  }

  if (BACKREFERENCE.test(pattern)) {
    return false;
  }

  return true;
};

/** Whether a pattern is anchored at the start. */
export const isStartAnchored = (pattern: string): boolean =>
  pattern.startsWith("^");

/** Whether a pattern has a capture group (used by redirections). */
export const hasCaptureGroup = (pattern: string): boolean =>
  /\((?!\?)/.test(pattern);

export const nonEmptyString = z.string().min(1);

/** Keys present in an object that a schema does not know about. */
export const unknownKeys = (
  value: Record<string, unknown>,
  known: readonly string[]
): string[] =>
  Object.keys(value).filter((key) => !known.includes(key));

export const KNOWN_TRACKER_KEYS = [
  "schemaVersion",
  "caseInsensitive",
  "exact",
  "prefixes",
  "patterns",
  "exceptions",
  "source",
  "upstreamVersion",
] as const;

export const KNOWN_PROVIDERS_KEYS = [
  "schemaVersion",
  "providers",
] as const;

export const KNOWN_OVERRIDES_KEYS = [
  "schemaVersion",
  "overrides",
] as const;

export const KNOWN_OVERRIDE_KEYS = [
  "provider",
  "action",
  "reason",
  "reviewBy",
  "providerDefinition",
  "addRules",
  "removeRules",
  "addExceptions",
  "removeExceptions",
  "addRedirections",
  "removeRedirections",
  "addHostHints",
  "removeHostHints",
  "setCompleteProvider",
] as const;

export const KNOWN_ALLOWLIST_KEYS = [
  "schemaVersion",
  "global",
  "domains",
] as const;

export const KNOWN_POLICY_KEYS = [
  "schemaVersion",
  "maxDepth",
  "genericRedirectUnwrap",
  "genericUnwrapParameters",
  "removeJunkFragments",
  "allowDangerousGenericUnwrapParameters",
] as const;

export const KNOWN_BLOCKLIST_SOURCES_KEYS = [
  "schemaVersion",
  "sources",
] as const;
