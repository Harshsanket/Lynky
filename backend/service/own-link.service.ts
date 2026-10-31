import { env } from "../src/config/env.js";
import { PublicError } from "./public-error.service.js";

/**
 * Origins owned by Lynky itself. We refuse to shorten our own links to avoid
 * creating short-code loops (`short.example/a` → `short.example/b` → ...).
 */
const getOwnOrigins = (): string[] =>
  [env.PUBLIC_URL, env.FRONTEND_URL]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => {
      try {
        const parsed = new URL(origin);

        return `${parsed.origin}${parsed.pathname}`.replace(
          /\/$/,
          ""
        );
      } catch {
        return origin.replace(/\/$/, "");
      }
    });

/**
 * Throw when a parsed URL points back at a Lynky-owned origin.
 *
 * Callers must run this against the *final* URL (after redirect unwrapping),
 * not only the raw input.
 */
export const assertNotOwnLink = (parsedUrl: URL): void => {
  const ownOrigins = getOwnOrigins();

  if (ownOrigins.length === 0) {
    return;
  }

  const normalized = `${parsedUrl.origin}${parsedUrl.pathname}`.replace(
    /\/$/,
    ""
  );

  for (const ownOrigin of ownOrigins) {
    if (
      normalized === ownOrigin ||
      normalized.startsWith(`${ownOrigin}/`)
    ) {
      throw new PublicError(
        "Cannot give a short code for Lynky's own link."
      );
    }
  }
};
