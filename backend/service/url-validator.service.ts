import { env } from "../src/config/env.js";
import { PublicError } from "./public-error.service.js";
import {
  MESSAGES,
  assertHostAllowed,
} from "./url-host-validator.service.js";
import { screenBlocklist } from "./blocklist-screening.service.js";
import { logWarn, redactUrlToOrigin } from "./logger.js";

export interface ValidateUrlOptions {
  /**
   * Enforce `MAX_URL_LENGTH` for user input. Disable this when validating an
   * already-stored, cleaned URL: percent-encoding can make that value longer
   * than the original input, so applying the input limit would turn a valid
   * short link into a permanent 500.
   */
  enforceMaxLength?: boolean;

  /**
   * Run blocklist screening. Only disabled for the *redirect* path so a
   * blocklist update can never turn an already-stored link into a dead end —
   * screening happens when links are created, not every time they are hit.
   */
  checkBlocklists?: boolean;
}

/**
 * Rejection categories used by the counters and the structured log line.
 *
 * Categories intentionally stay coarse: they are for ops visibility
 * ("why are creates failing?"), not for building a fingerprint of the
 * destination. The URL itself is logged only through `redactUrl`.
 */
export type UrlRejectionCategory =
  | "empty"
  | "too_long"
  | "control_characters"
  | "invalid_structure"
  | "credentials"
  | "protocol"
  | "private_network"
  | "internal_hostname"
  | "internationalized_domain"
  | "blocklist";

const ALL_REJECTION_CATEGORIES: readonly UrlRejectionCategory[] = [
  "empty",
  "too_long",
  "control_characters",
  "invalid_structure",
  "credentials",
  "protocol",
  "private_network",
  "internal_hostname",
  "internationalized_domain",
  "blocklist",
];

/** Per-process reject counts, exported so ops/tests can inspect them. */
const rejectionCounts = new Map<UrlRejectionCategory, number>();

/** A `PublicError` that also knows which pipeline stage rejected the URL. */
class UrlValidationError extends PublicError {
  readonly category: UrlRejectionCategory;

  constructor(message: string, category: UrlRejectionCategory) {
    super(message);
    this.category = category;
  }
}

const categoryForError = (error: unknown): UrlRejectionCategory => {
  if (error instanceof UrlValidationError) {
    return error.category;
  }

  if (!(error instanceof PublicError)) {
    return "invalid_structure";
  }

  switch (error.message) {
    case MESSAGES.credentials:
      return "credentials";
    case MESSAGES.privateNetwork:
      return "private_network";
    case MESSAGES.internal:
      return "internal_hostname";
    case MESSAGES.idn:
      return "internationalized_domain";
    case MESSAGES.blocklisted:
      return "blocklist";
    case MESSAGES.invalid:
    default:
      return "invalid_structure";
  }
};

/**
 * Record a rejected validation attempt.
 *
 * The query string and fragment never reach the log: they routinely carry
 * tokens and personal data (see `redactUrl`). Errors are logged at `warn`
 * level because a hostile client can trigger them at will; they are not
 * server faults.
 */
const recordRejection = (inputUrl: unknown, error: unknown): void => {
  const category = categoryForError(error);
  const categoryCount =
    (rejectionCounts.get(category) ?? 0) + 1;

  rejectionCounts.set(category, categoryCount);

  // Tests intentionally reject the whole matrix; logging every fixture would
  // bury the actual test output. Runtime modes always log.
  if (env.NODE_ENV === "test") {
    return;
  }

  logWarn("request_rejected", {
    component: "url_validation",
    category,
    count: categoryCount,
    origin: redactUrlToOrigin(inputUrl),
    errorCode: "request_error",
  });
};

/** Snapshot of rejection counts, with every category present. */
export const getRejectionCounts = (): Record<
  UrlRejectionCategory,
  number
> => {
  const counts = {} as Record<UrlRejectionCategory, number>;

  for (const category of ALL_REJECTION_CATEGORIES) {
    counts[category] = rejectionCounts.get(category) ?? 0;
  }

  return counts;
};

/**
 * Control characters (C0, DEL, C1) plus the bidi/RTL override and EMOJI-
 * MODIFIER-adjacent marks that can visually reorder or conceal content.
 *
 * The WHATWG parser silently strips tabs/LF/CR during parsing, so these have
 * to be checked on the *raw* input — a tab inside a hostname would otherwise
 * smuggle a different authority past the structural checks.
 */
const FORBIDDEN_CHARS =
  /[\u0000-\u001F\u007F\u0080-\u009F\u202A-\u202E\u2066-\u2069]/;

/**
 * Raw `@` inside the authority (`[scheme://]<anything with no /?#>@`).
 *
 * The parser-derived `username` check catches populated credentials; this
 * pattern also catches the empty-obfuscation form (`http://@evil.example`)
 * before parsing can make the `@` disappear.
 */
const RAW_CREDENTIALS_PATTERN =
  /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*@/;

/**
 * Validate that the input is a non-empty HTTP(S) URL pointing at a public
 * internet destination.
 *
 * Pipeline (fail-fast, cheap → expensive):
 *  1. String-level checks: length, control characters, backslashes, raw `@`.
 *  2. Parse with the built-in WHATWG URL parser; enforce HTTP(S) + hostname.
 *  3. Hostname-level checks (shape, credentials, internal names, IP ranges,
 *     public suffix / IDN policy) via `assertHostAllowed`.
 *  4. Blocklist screening (unless disabled by the caller).
 *
 * Throws a human-readable error when invalid; returns the parsed URL on
 * success so callers can inspect its parts. Every rejection is counted and
 * logged (category + redacted URL) before it is re-thrown.
 */
export const validateUrl = (
  inputUrl: string,
  options: ValidateUrlOptions = {}
): URL => {
  try {
    return validateUrlOrThrow(inputUrl, options);
  } catch (error) {
    recordRejection(inputUrl, error);
    throw error;
  }
};

const validateUrlOrThrow = (
  inputUrl: string,
  options: ValidateUrlOptions
): URL => {
  if (
    !inputUrl ||
    typeof inputUrl !== "string" ||
    !inputUrl.trim()
  ) {
    throw new UrlValidationError("URL is required", "empty");
  }

  const trimmed = inputUrl.trim();

  if (
    options.enforceMaxLength !== false &&
    trimmed.length > env.MAX_URL_LENGTH
  ) {
    throw new UrlValidationError(
      `URL exceeds maximum length of ${env.MAX_URL_LENGTH} characters`,
      "too_long"
    );
  }

  if (FORBIDDEN_CHARS.test(trimmed)) {
    throw new UrlValidationError(
      MESSAGES.invalid,
      "control_characters"
    );
  }

  // Backslashes are treated as forward slashes by the WHATWG parser and can
  // be used to smuggle a different host into the parsed authority.
  if (trimmed.includes("\\")) {
    throw new UrlValidationError(MESSAGES.invalid, "invalid_structure");
  }

  if (RAW_CREDENTIALS_PATTERN.test(trimmed)) {
    throw new UrlValidationError(
      MESSAGES.credentials,
      "credentials"
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new UrlValidationError(
      MESSAGES.invalid,
      "invalid_structure"
    );
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new UrlValidationError(
      "Only HTTP and HTTPS URLs are allowed",
      "protocol"
    );
  }

  if (!parsedUrl.hostname) {
    throw new UrlValidationError(
      MESSAGES.invalid,
      "invalid_structure"
    );
  }

  assertHostAllowed(parsedUrl);

  if (options.checkBlocklists !== false) {
    const screening = screenBlocklist(parsedUrl);

    if (screening.blocked) {
      throw new UrlValidationError(
        MESSAGES.blocklisted,
        "blocklist"
      );
    }
  }

  return parsedUrl;
};
