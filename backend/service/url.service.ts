import { env } from "../src/config/env.js";
import { Link } from "../models/link.models.js";
import { hashCode, generateCodeSalt, deriveCodeFromSalt, isValidCodeSalt } from "./code-hash.service.js";
import { hashUrl } from "./url-hasher.service.js";
import { getPublicUrl } from "./url-public-generator.service.js";
import { cleanUrl } from "./url-cleaner.service.js";
import { validateUrl } from "./url-validator.service.js";
import { findExistingUrl, findLinkByUrlHash } from "./url-existance-checker.service.js";
import { getExpirationDate } from "./url-expiration.service.js";
import { encryptUrl } from "./encryption.service.js";
import { assertNotOwnLink } from "./own-link.service.js";
import { invalidateLinkCache } from "./link-cache.service.js";
import { clearNegative } from "./negative-cache.service.js";
import { isValidCode } from "./shortcode-validator.service.js";
import { logError, logWarn, redactUrl } from "./logger.js";
import { runInBackground } from "../src/utils/background.js";
import {
  addStageTime,
  measureStage,
  measureStageSync,
  type StageTimings,
} from "./stage-timing.service.js";

/** Raised when every allowed short-code attempt collides. */
export class ShortCodeExhaustedError extends Error {
  readonly statusCode = 503;

  constructor() {
    super(
      `Unable to generate a unique short code after ${env.MAX_CODE_ATTEMPTS} attempts`
    );
    this.name = "ShortCodeExhaustedError";
  }
}

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
 * Re-derive or reuse the plaintext code for an existing `urlHash` row.
 *
 * Salted rows are stable across Redis loss. Legacy rows without a salt keep
 * the creation-response Redis mapping fallback until they expire.
 */
type ExistingLink = {
  _id: unknown;
  code?: string | null;
  codeHash?: string;
  codeSalt?: string | null;
};

/**
 * Refresh an existing link's expiry and build the response for it.
 *
 * A salted row re-derives the same code from `urlHash + codeSalt`. A legacy
 * row can reuse its stored plaintext `code`; when neither is available, it
 * rotates and stores a fresh salt.
 */
const adoptExistingLink = async (
  existing: ExistingLink,
  cleanedUrl: string,
  urlHash: string,
  timings: StageTimings | null
) => {
  const expiresAt = getExpirationDate();
  const salt = isValidCodeSalt(existing.codeSalt)
    ? existing.codeSalt
    : null;

  let knownCode: string | null = null;

  if (salt) {
    knownCode = deriveCodeFromSalt(urlHash, salt);
  } else if (
    typeof existing.code === "string" &&
    isValidCode(existing.code)
  ) {
    knownCode = existing.code;
  }

  if (knownCode) {
    const codeHash = hashCode(knownCode);
    const update: Record<string, unknown> = {
      $set: {
        expiresAt,
        ...(existing.codeHash === codeHash ? {} : { codeHash }),
      },
    };

    if (existing.code) {
      update.$unset = { code: "" };
    }

    const link = await measureStage(
      timings,
      "insertMs",
      () =>
        Link.findByIdAndUpdate(existing._id, update, {
          returnDocument: "after",
        }).lean()
    );

    if (!link) {
      return null;
    }

    clearNegative(knownCode);

    // Stable code: no rotation and no legacy Redis mapping. Refresh the edge
    // cache in the background; the old short URL already points at the same
    // destination.
    runInBackground(
      () => invalidateLinkCache(knownCode, { throwOnError: true }),
      {
        event: "cache_invalidation_failed",
        errorCode: "cache_invalidation_failed",
        context: { operation: "adoptExistingLink" },
      }
    );

    return {
      code: knownCode,
      originalUrl: cleanedUrl,
      shortUrl: getPublicUrl(knownCode),
      expiresAt: link.expiresAt,
      created: false,
    };
  }

  /*
   * No recoverable plaintext code: rotate. The new row gets a salt so future
   * adoption is stable even if Redis is unavailable. The old codeHash stops
   * matching immediately; invalidate its new code synchronously.
   */
  for (let attempt = 0; attempt < env.MAX_CODE_ATTEMPTS; attempt++) {
    const codegenStartedAt = timings ? performance.now() : 0;
    const codeSalt = generateCodeSalt();
    const code = deriveCodeFromSalt(urlHash, codeSalt);
    const codeHash = hashCode(code);

    addStageTime(timings, "codegenMs", codegenStartedAt);

    if (timings) {
      timings.codegenAttempts += 1;
    }

    try {
      const update: Record<string, unknown> = {
        $set: { expiresAt, codeHash, codeSalt },
      };

      if (existing.code) {
        update.$unset = { code: "" };
      }

      const link = await measureStage(
        timings,
        "insertMs",
        () =>
          Link.findByIdAndUpdate(existing._id, update, {
            returnDocument: "after",
          }).lean()
      );

      if (!link) {
        return null;
      }

      clearNegative(code);
      await invalidateLinkCache(code);

      return {
        code,
        originalUrl: cleanedUrl,
        shortUrl: getPublicUrl(code),
        expiresAt: link.expiresAt,
        created: false,
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        continue;
      }

      throw error;
    }
  }

  throw new ShortCodeExhaustedError();
};

type UrlHashAdoption =
  | {
      status: "adopted";
      result: NonNullable<Awaited<ReturnType<typeof adoptExistingLink>>>;
    }
  | { status: "missing" | "retry" };

/**
 * Adopt the row that won a concurrent insert for the same destination.
 * Returns `missing` when no row exists and `retry` when the winner expired or
 * disappeared before it could be updated.
 */
const adoptByUrlHash = async (
  urlHash: string,
  cleanedUrl: string,
  timings: StageTimings | null
): Promise<UrlHashAdoption> => {
  const winner = await measureStage(
    timings,
    "dedupeMs",
    () => findLinkByUrlHash(urlHash)
  );

  if (!winner) {
    return { status: "missing" };
  }

  if (new Date(winner.expiresAt).getTime() <= Date.now()) {
    await measureStage(
      timings,
      "insertMs",
      () =>
        Link.deleteOne({
          _id: (winner as any)._id,
          expiresAt: { $lte: new Date() },
        })
    );

    return { status: "retry" };
  }

  const adopted = await adoptExistingLink(
    winner,
    cleanedUrl,
    urlHash,
    timings
  );

  return adopted
    ? { status: "adopted", result: adopted }
    : { status: "retry" };
};

export interface PreparedUrl {
  cleanedUrl: string;
  urlHash: string;
}

/**
 * Validate and clean an input URL without touching the database.
 *
 * Controllers call this before reserving API-key quota, so invalid or
 * impossible-to-clean URLs never consume a key's monthly allowance.
 */
export const prepareUrl = (
  inputUrl: string,
  timings: StageTimings | null = null
): PreparedUrl =>
  measureStageSync(timings, "algorithmsMs", () => {
    const parsedUrl = validateUrl(inputUrl);

    assertNotOwnLink(parsedUrl);

    const cleanedUrl = cleanUrl(inputUrl);

    /*
     * Cleaning may unwrap a redirect chain and change the destination host, so
     * the own-link guard runs against the final URL *before* full validation:
     * the own-link rejection is the message users of wrapped own links see,
     * while the re-validation then applies every host-level check (shape, IP
     * ranges, public suffix, blocklists) to the unwrapped destination too.
     */
    const cleanedParsedUrl = new URL(cleanedUrl);

    assertNotOwnLink(cleanedParsedUrl);

    validateUrl(cleanedUrl, { enforceMaxLength: false });

    return {
      cleanedUrl,
      urlHash: hashUrl(cleanedUrl),
    };
  });

/**
 * Create (or refresh) a short link for a URL that has already been validated
 * and cleaned by `prepareUrl`.
 */
export const createShortUrlFromPrepared = async (
  { cleanedUrl, urlHash }: PreparedUrl,
  timings: StageTimings | null = null
) => {
  const existingUrl = await measureStage(
    timings,
    "dedupeMs",
    () => findExistingUrl(urlHash)
  );

  if (existingUrl) {
    const adopted = await adoptExistingLink(
      existingUrl,
      cleanedUrl,
      urlHash,
      timings
    );

    if (adopted) {
      return adopted;
    }
  }

  const expiresAt = getExpirationDate();

  for (
    let attempt = 0;
    attempt < env.MAX_CODE_ATTEMPTS;
    attempt++
  ) {
    const codegenStartedAt = timings ? performance.now() : 0;
    const codeSalt = generateCodeSalt();
    const code = deriveCodeFromSalt(urlHash, codeSalt);
    const codeHash = hashCode(code);

    addStageTime(timings, "codegenMs", codegenStartedAt);

    if (timings) {
      timings.codegenAttempts += 1;
    }

    try {
      const link = await measureStage(
        timings,
        "insertMs",
        () =>
          Link.create({
            codeHash,
            codeSalt,
            originalUrl: encryptUrl(cleanedUrl),
            urlHash,
            expiresAt,
          })
      );

      clearNegative(code);
      // New codes are stable: cache invalidation is a best-effort side effect
      // and does not block the create response.
      runInBackground(
        () => invalidateLinkCache(code, { throwOnError: true }),
        {
          event: "cache_invalidation_failed",
          errorCode: "cache_invalidation_failed",
          context: { operation: "createShortUrl", stable: true },
        }
      );

      const shortUrl = getPublicUrl(code);

      return {
        code,
        originalUrl: cleanedUrl,
        shortUrl,
        expiresAt: link.expiresAt,
        created: true,
      };
    } catch (error: any) {
      if (error?.code !== 11000) {
        // Any other database error is not recoverable here.
        logError("DATABASE CREATE ERROR", error, {
          operation: "createShortUrl",
          model: "Link",
          attempt,
          cleanedUrl: redactUrl(cleanedUrl),
          expiresAt: expiresAt.toISOString(),
        });

        throw error;
      }

      const collidingIndex = getCollidingIndex(error);
      const urlHashCollision =
        collidingIndex === "urlHash" ||
        collidingIndex?.includes("urlHash");

      /*
       * A missing index is ambiguous: the driver may omit keyPattern even
       * though the rejected insert lost the urlHash race. Try adoption before
       * treating it as a code collision.
       */
      if (urlHashCollision || collidingIndex === null) {
        const outcome = await adoptByUrlHash(
          urlHash,
          cleanedUrl,
          timings
        );

        if (outcome.status === "adopted") {
          return outcome.result;
        }

        if (collidingIndex === null && outcome.status === "missing") {
          logWarn("SHORT CODE COLLISION", {
            operation: "createShortUrl",
            attempt,
            collidingIndex,
            resolution: "unknown_index_missing_url_hash",
            errorCode: "short_code_collision",
            cleanedUrl: redactUrl(cleanedUrl),
          });
        }

        continue;
      }

      // Duplicate codeHash collision: generate a fresh salt and retry. This
      // is expected under load and self-heals within MAX_CODE_ATTEMPTS.
      logWarn("SHORT CODE COLLISION", {
        operation: "createShortUrl",
        attempt,
        collidingIndex,
        resolution: "code_hash",
        errorCode: "short_code_collision",
        cleanedUrl: redactUrl(cleanedUrl),
      });

      continue;
    }
  }

  throw new ShortCodeExhaustedError();
};
