import crypto from "node:crypto";

/**
 * Deterministic sha256 of a cleaned URL, used as the dedupe key in `Link`.
 */
export const hashUrl = (
  url: string
): string => {
  return crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");
};