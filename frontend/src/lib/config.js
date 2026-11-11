/**
 * Public configuration exposed to the UI.
 *
 * These are build-time Vite values. Only expose what the frontend needs to
 * construct a valid request; backend policy (quota, expiry, code lengths)
 * remains authoritative and is displayed from API responses instead.
 */

const env = import.meta.env ?? {};

const stripTrailingSlash = (value) => value.replace(/\/$/, '');

export const SITE_URL = stripTrailingSlash(
  env.VITE_SITE_URL ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173'),
);

export const SHORT_URL = stripTrailingSlash(
  env.VITE_SHORT_URL || SITE_URL,
);
