/**
 * Small HTTP helpers shared across controllers and middleware.
 */

import type { Request } from "express";

/**
 * Extract the raw secret from an `Authorization: Bearer <secret>` header.
 *
 * Returns `null` when the header is missing or is not a bearer token, so
 * callers can distinguish "not provided" from "invalid".
 */
export const extractBearerSecret = (
  req: Request
): string | null => {
  const header = req.headers.authorization;

  return header?.startsWith("Bearer ")
    ? header.slice(7).trim()
    : null;
};