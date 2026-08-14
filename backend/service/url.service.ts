import 'dotenv/config';
import { Link } from '../models/link.models.js';
import { generateCode } from './shortcode-generater.service.js';
import { hashUrl } from './url-hasher.service.js';
import { getPublicUrl } from './url-public-generator.service.js';
import { cleanUrl } from './url-cleaner.service.js';
import { validateUrl } from './url-validator.service.js';
import { findExistingUrl } from './url-existance-checker.service.js';
import { getExpirationDate } from './url-expiration.service.js';
import { logError } from './logger.js';

export const createShortUrl = async (inputUrl: string) => {
  try {
    validateUrl(inputUrl);

    const cleanedUrl = cleanUrl(inputUrl);

    const existingUrl = await findExistingUrl(cleanedUrl);

    if (existingUrl) {
      return {
        code: existingUrl.code,
        originalUrl: existingUrl.originalUrl,
        shortUrl: getPublicUrl(existingUrl.code),
        expiresAt: existingUrl.expiresAt,
      };
    }

    const urlHash = hashUrl(cleanedUrl);

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
          originalUrl: cleanedUrl,
          expiresAt,
        });

        const shortUrl = getPublicUrl(link.code);

        return {
          code: link.code,
          originalUrl: link.originalUrl,
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
