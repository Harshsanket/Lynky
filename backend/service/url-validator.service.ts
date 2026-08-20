import { env } from "../src/config/env.js";
import { PublicError } from "./public-error.service.js";

/**
 * Validate that the input is a non-empty HTTP(S) URL within the configured
 * maximum length.
 *
 * Throws a human-readable error when invalid; returns the parsed URL on
 * success so callers can inspect its parts.
 */
export const validateUrl = (inputUrl: string): URL => {
  if (
    !inputUrl ||
    typeof inputUrl !== "string" ||
    !inputUrl.trim()
  ) {
    throw new PublicError("URL is required");
  }

  const trimmed = inputUrl.trim();

  if (trimmed.length > env.MAX_URL_LENGTH) {
    throw new PublicError(
      `URL exceeds maximum length of ${env.MAX_URL_LENGTH} characters`
    );
  }

  // Backslashes are treated as forward slashes by the WHATWG parser and can
  // be used to smuggle a different host into the parsed authority.
  if (trimmed.includes("\\")) {
    throw new PublicError("Invalid URL");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new PublicError("Invalid URL");
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new PublicError(
      "Only HTTP and HTTPS URLs are allowed"
    );
  }

  return parsedUrl;
};