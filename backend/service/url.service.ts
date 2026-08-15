import 'dotenv/config';
import { Link } from '../models/link.models.js';
import { generateCode } from './shortcode-generater.service.js';
import { hashUrl } from './url-hasher.service.js';
import { getPublicUrl } from './url-public-generator.service.js';
import { cleanUrl } from './url-cleaner.service.js';
import { validateUrl } from './url-validator.service.js';
import { findExistingUrl } from './url-existance-checker.service.js';
import { getExpirationDate } from './url-expiration.service.js';
import { encryptUrl } from './encryption.service.js';
import { logError } from './logger.js';

const getOwnOrigins = (): string[] => {
  return [process.env.PUBLIC_URL, process.env.FRONTEND_URL]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => origin.replace(/\/$/, ''));
};

const assertNotOwnLink = (parsedUrl: URL): void => {
  const ownOrigins = getOwnOrigins();

  if (ownOrigins.length === 0) {
    return;
  }

  const normalized = `${parsedUrl.origin}${parsedUrl.pathname}`.replace(
    /\/$/,
    ''
  );

  for (const ownOrigin of ownOrigins) {
    if (
      normalized === ownOrigin ||
      normalized.startsWith(`${ownOrigin}/`)
    ) {
      throw new Error(
        "Cannot give a short code for Lynky's own link."
      );
    }
  }
};

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
        { returnDocument: 'after' }
      ).lean();

      const refreshedExpiresAt = link?.expiresAt ?? expiresAt;

      return {
        code: existingUrl.code,
        originalUrl: cleanedUrl,
        shortUrl: getPublicUrl(existingUrl.code),
        expiresAt: refreshedExpiresAt,
      };
    }

    /* ---------------------------------------------------------------------- */
    /* Calculate expiration                                                   */
    /* ---------------------------------------------------------------------- */

    const expiresAt = getExpirationDate();

    /* ---------------------------------------------------------------------- */
    /* Generate short code                                                    */
    /* ---------------------------------------------------------------------- */

    for (
      let attempt = 0;
      attempt < Number(process.env.MAX_CODE_ATTEMPTS);
      attempt++
    ) {
      const code = generateCode(
        urlHash,
        attempt,
        Number(process.env.CODE_LENGTH),
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
        /* ------------------------------------------------------------------ */
        /* Duplicate short-code collision                                     */
        /* ------------------------------------------------------------------ */

        if (error?.code === 11000) {
          console.warn(
            '\n============================================================',
          );

          console.warn('⚠️ SHORT CODE COLLISION');

          console.warn(
            '============================================================',
          );

          console.warn({
            timestamp: new Date().toISOString(),
            code,
            attempt,
            cleanedUrl,
          });

          console.warn('Generating another code...');

          console.warn(
            '============================================================\n',
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Other database errors                                              */
        /* ------------------------------------------------------------------ */

        logError('DATABASE CREATE ERROR', error, {
          operation: 'createShortUrl',
          model: 'Link',
          code,
          attempt,
          cleanedUrl,
          expiresAt: expiresAt.toISOString(),
        });

        throw error;
      }
    }

    throw new Error(
      `Unable to generate a unique short code after ${process.env.MAX_CODE_ATTEMPTS} attempts`,
    );
  } catch (error: any) {
    /* ---------------------------------------------------------------------- */
    /* Final catch                                                            */
    /* ---------------------------------------------------------------------- */

    logError('CREATE SHORT URL FAILED', error, {
      inputUrl,
    });

    // Keep exact original error for your controller/error middleware
    throw error;
  }
};
