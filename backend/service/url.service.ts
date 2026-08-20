import { env } from "../src/config/env.js";
import { Link } from "../models/link.models.js";
import { generateCode, getCodeLength } from "./shortcode-generater.service.js";
import { hashUrl } from "./url-hasher.service.js";
import { getPublicUrl } from "./url-public-generator.service.js";
import { cleanUrl } from "./url-cleaner.service.js";
import { validateUrl } from "./url-validator.service.js";
import { findExistingUrl } from "./url-existance-checker.service.js";
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
 *  5. Otherwise generate a short code (retrying on collision) and store the
 *     encrypted destination with a TTL.
 *
 * The original (cleaned) URL is returned for logging/preview purposes; only
 * the encrypted copy is stored.
 */
export const createShortUrl = async (inputUrl: string) => {
  try {
    const parsedUrl = validateUrl(inputUrl);

    assertNotOwnLink(parsedUrl);

    const cleanedUrl = cleanUrl(inputUrl);

    const urlHash = hashUrl(cleanedUrl);

    const existingUrl = await findExistingUrl(urlHash);

    if (existingUrl) {
      const expiresAt = getExpirationDate();

      const link = await Link.findByIdAndUpdate(
        existingUrl._id,
        { $set: { expiresAt } },
        { returnDocument: "after" }
      ).lean();

      const refreshedExpiresAt = link?.expiresAt ?? expiresAt;

      return {
        code: existingUrl.code,
        originalUrl: cleanedUrl,
        shortUrl: getPublicUrl(existingUrl.code),
        expiresAt: refreshedExpiresAt,
      };
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
        // Duplicate short-code collision → try the next attempt.
        if (error?.code === 11000) {
          logError("SHORT CODE COLLISION", error, {
            operation: "createShortUrl",
            code,
            attempt,
            cleanedUrl,
          });

          continue;
        }

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