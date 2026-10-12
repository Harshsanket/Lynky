import { env } from "../src/config/env.js";
import { Link } from "../models/link.models.js";
import { generateCode, getCodeLength } from "./shortcode-generater.service.js";
import { hashUrl } from "./url-hasher.service.js";
import { getPublicUrl } from "./url-public-generator.service.js";
import { cleanUrl } from "./url-cleaner.service.js";
import { validateUrl } from "./url-validator.service.js";
import { findExistingUrl, findLinkByUrlHash } from "./url-existance-checker.service.js";
import { getExpirationDate } from "./url-expiration.service.js";
import { encryptUrl } from "./encryption.service.js";
import { PublicError } from "./public-error.service.js";
import { logError } from "./logger.js";

/**
 * Origins owned by Lynky itself. We refuse to shorten our own links to avoid
 * creating short-code loops.
 */
const getOwnOrigins = (): string[] => {
  return [env.PUBLIC_URL, env.FRONTEND_URL]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => origin.replace(/\/$/, ""));
};

/**
 * Throw if the given URL points back at a Lynky-owned origin.
 */
const assertNotOwnLink = (parsedUrl: URL): void => {
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

/**
 * Create (or refresh) a short link for the given input URL.
 *
 * Pipeline:
 *  1. Validate the URL is HTTP(S).
 *  2. Reject Lynky's own URLs.
 *  3. Clean tracking parameters via the ClearURLs rules.
 *  4. Look up an existing, un-expired link by hash of the cleaned URL and
 *     extend its expiry if found.
 *  5. Otherwise insert a new record. The `code` and `urlHash` fields are both
 *     unique, so a duplicate-key error (E11000) is disambiguated:
 *       - `code`  collision → generate a new code and retry (bounded).
 *       - `urlHash` collision → another request won the race for this
 *         destination; adopt its row instead of inserting a duplicate.
 *
 * The original (cleaned) URL is returned for logging/preview purposes; only
 * the encrypted copy is stored.
 */

/** Which unique index rejected an insert, if any. */
const getCollidingIndex = (error: any): string | null => {
  if (error?.code !== 11000) {
    return null;
  }

  // The driver reports the offending key pattern on duplicate-key errors.
  const keyPattern = error?.keyPattern;

  if (keyPattern && typeof keyPattern === "object") {
    const keys = Object.keys(keyPattern);

    if (keys.length > 0) {
      return keys[0]!;
    }
  }

  // Fall back to parsing the driver message, e.g.
  // `E11000 duplicate key error collection: ... index: urlHash_1 ...`.
  const match = String(error?.message ?? "").match(
    /index:\s+([^\s]+)/
  );

  return match?.[1] ?? null;
};

/**
 * Refresh an existing link's expiry and build the response for it.
 */
const adoptExistingLink = async (
  existing: { code: string },
  cleanedUrl: string
) => {
  const expiresAt = getExpirationDate();

  const link = await Link.findByIdAndUpdate(
    (existing as any)._id,
    { $set: { expiresAt } },
    { returnDocument: "after" }
  ).lean();

  const refreshedExpiresAt = link?.expiresAt ?? expiresAt;

  return {
    code: existing.code,
    originalUrl: cleanedUrl,
    shortUrl: getPublicUrl(existing.code),
    expiresAt: refreshedExpiresAt,
  };
};

export const createShortUrl = async (inputUrl: string) => {
  try {
    const parsedUrl = validateUrl(inputUrl);

    assertNotOwnLink(parsedUrl);

    const cleanedUrl = cleanUrl(inputUrl);

    const urlHash = hashUrl(cleanedUrl);

    const existingUrl = await findExistingUrl(urlHash);

    if (existingUrl) {
      return await adoptExistingLink(existingUrl, cleanedUrl);
    }

    const expiresAt = getExpirationDate();

    for (
      let attempt = 0;
      attempt < env.MAX_CODE_ATTEMPTS;
      attempt++
    ) {
      const code = generateCode(
        urlHash,
        attempt,
        getCodeLength()
      );

      try {
        const link = await Link.create({
          code,
          originalUrl: encryptUrl(cleanedUrl),
          urlHash,
          expiresAt,
        });

        const shortUrl = getPublicUrl(link.code);

        return {
          code: link.code,
          originalUrl: cleanedUrl,
          shortUrl,
          expiresAt: link.expiresAt,
        };
      } catch (error: any) {
        if (error?.code !== 11000) {
          // Any other database error is not recoverable here.
          logError("DATABASE CREATE ERROR", error, {
            operation: "createShortUrl",
            model: "Link",
            code,
            attempt,
            cleanedUrl,
            expiresAt: expiresAt.toISOString(),
          });

          throw error;
        }

        const collidingIndex = getCollidingIndex(error);

        // Lost the dedupe race: another request inserted this destination
        // first. Adopt its row rather than creating a duplicate record.
        if (
          collidingIndex === "urlHash" ||
          collidingIndex?.includes("urlHash")
        ) {
          const winner = await findLinkByUrlHash(urlHash);

          // The winner may have been TTL-deleted in the gap → retry insert.
          if (winner) {
            return await adoptExistingLink(winner, cleanedUrl);
          }

          continue;
        }

        // Duplicate short-code collision → try the next attempt.
        logError("SHORT CODE COLLISION", error, {
          operation: "createShortUrl",
          code,
          attempt,
          cleanedUrl,
        });

        continue;
      }
    }

    throw new Error(
      `Unable to generate a unique short code after ${env.MAX_CODE_ATTEMPTS} attempts`
    );
  } catch (error: any) {
    logError("CREATE SHORT URL FAILED", error, {
      inputUrl,
    });

    // Re-throw so the controller can translate it into an HTTP response.
    throw error;
  }
};