import { env } from "../src/config/env.js";

/**
 * Expiration date for a new link, based on the configured lifetime in days.
 */
export const getExpirationDate = (): Date => {
  const expirationDays = env.EXPIRATION_DAYS;

  return new Date(
    Date.now() +
      expirationDays *
        24 *
        60 *
        60 *
        1000
  );
};