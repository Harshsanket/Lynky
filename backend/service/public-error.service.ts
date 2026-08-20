import { env } from "../src/config/env.js";

/**
 * An error whose message is safe to show to API clients.
 *
 * Validation and policy failures (bad URL, quota exceeded, invalid key) throw
 * `PublicError` so controllers can surface the message verbatim. Anything that
 * is not a `PublicError` is considered internal: in production it is masked
 * behind a generic message, while in development the real message is passed
 * through to help debugging.
 */
export class PublicError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "PublicError";
  }
}

/**
 * Pick the message to return to the client.
 *
 * `PublicError`s always surface their message. Internal errors are only
 * exposed verbatim outside of production; in production they collapse to the
 * given fallback so no internal detail (DB, crypto, pipeline errors) leaks.
 */
export const getPublicErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  if (error instanceof PublicError) {
    return error.message;
  }

  if (error instanceof Error && !env.isProduction && error.message) {
    return error.message;
  }

  return fallback;
};