import { getRequestContext } from "./request-context.service.js";

/**
 * Structured JSON logger.
 *
 * One object per line on stdout/stderr. The logger never throws: a logging
 * failure must never fail a request. Context values are recursively redacted:
 * URL-like strings collapse to their origin (query strings and paths never
 * reach logs), and sensitive keys are replaced with `<redacted>`.
 */

const SENSITIVE_KEY =
  /^(url|originalurl|original_url|query|querystring|search|body|headers?|authorization|api[-_]?key|secret|token|password|ciphertext|encryptedurl)$/i;

const URL_PATTERN =
  /\b(?:https?|wss?|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi;

const sanitizeString = (value: string): string =>
  value.replace(URL_PATTERN, (match) => {
    try {
      const parsed = new URL(match);

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }

      return "<redacted-url>";
    } catch {
      return "<redacted-url>";
    }
  });

const sanitizeError = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return {
      name: typeof error,
      message: sanitizeString(String(error)),
    };
  }

  const candidate = error as Error & Record<string, unknown>;

  return {
    name: candidate.name,
    message: sanitizeString(candidate.message),
    ...(candidate.code !== undefined
      ? { code: candidate.code }
      : {}),
    ...(candidate.codeName !== undefined
      ? { codeName: candidate.codeName }
      : {}),
    ...(candidate.errno !== undefined
      ? { errno: candidate.errno }
      : {}),
    ...(candidate.syscall !== undefined
      ? { syscall: candidate.syscall }
      : {}),
    ...(candidate.reason !== undefined
      ? { reason: sanitizeValue(candidate.reason, 0, new WeakSet()) }
      : {}),
  };
};

const sanitizeValue = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown => {
  if (depth > 6) {
    return "<max-depth>";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "<circular>";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value
        .slice(0, 50)
        .map((entry) => sanitizeValue(entry, depth + 1, seen));
    }

    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = SENSITIVE_KEY.test(key)
        ? "<redacted>"
        : sanitizeValue(entry, depth + 1, seen);
    }

    return result;
  }

  return sanitizeString(String(value));
};

export const sanitizeLogContext = (
  context: Record<string, unknown> | undefined
): Record<string, unknown> =>
  (sanitizeValue(context ?? {}, 0, new WeakSet()) as Record<
    string,
    unknown
  >);

let artifactVersion = "unknown";
let configVersion = "unknown";

export const setLogVersions = (
  nextArtifactVersion: string,
  nextConfigVersion: string
): void => {
  artifactVersion = nextArtifactVersion;
  configVersion = nextConfigVersion;
};

type Level = "info" | "warn" | "error";

const normalizeEvent = (event: string): string => {
  if (/^[a-z0-9_]+$/.test(event)) {
    return event;
  }

  return event
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const write = (
  level: Level,
  event: string,
  fields: Record<string, unknown> = {}
): void => {
  try {
    const context = getRequestContext();
    const sanitizedFields = sanitizeLogContext(fields);

    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      event: normalizeEvent(event),
      requestId: sanitizedFields.requestId ?? context?.requestId ?? null,
      route: sanitizedFields.route ?? context?.route ?? null,
      status: sanitizedFields.status ?? null,
      durationMs: sanitizedFields.durationMs ?? null,
      artifactVersion,
      configVersion,
      errorCode: sanitizedFields.errorCode ?? null,
      ...sanitizedFields,
    };

    const line = JSON.stringify(record);

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  } catch {
    try {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level,
          event: normalizeEvent(event),
          errorCode: "logger_failure",
        })
      );
    } catch {
      // Never throw from logging.
    }
  }
};

export const logInfo = (
  event: string,
  fields?: Record<string, unknown>
): void => write("info", event, fields);

export const logWarn = (
  event: string,
  fields?: Record<string, unknown>
): void => write("warn", event, fields);

export const logError = (
  event: string,
  error: unknown,
  fields?: Record<string, unknown>
): void => {
  write("error", event, {
    ...(fields ?? {}),
    error: sanitizeError(error),
  });
};

/**
 * Reduce a URL to its origin and path for explicit (non-logger) callers.
 * Prefer passing raw values to the structured logger, which drops paths too.
 */
export const redactUrl = (value: unknown): string => {
  if (typeof value !== "string") {
    return "<redacted>";
  }

  try {
    const url = new URL(value);

    return `${url.origin}${url.pathname}`;
  } catch {
    return "<invalid-url>";
  }
};

/** Reduce a URL to just its origin. */
export const redactUrlToOrigin = (value: unknown): string => {
  if (typeof value !== "string") {
    return "<redacted>";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "<invalid-url>";
  }
};
