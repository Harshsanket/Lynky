/**
 * Centralised environment configuration.
 *
 * Every `process.env` read in the codebase should go through this module so
 * that configuration is validated once, at startup, instead of silently
 * producing `undefined`/`NaN` mid-request.
 *
 * Fail-fast: values that are required for the app to function (database URI,
 * encryption key, public URL) throw at import time when missing.
 */

/* -------------------------------------------------------------------------- */
/*  Required values                                                            */
/* -------------------------------------------------------------------------- */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is not defined. Set it in your environment before starting the server."
  );
}

if (
  !MONGODB_URI.startsWith("mongodb://") &&
  !MONGODB_URI.startsWith("mongodb+srv://")
) {
  throw new Error(
    `MONGODB_URI is invalid. Expected a 'mongodb://' or 'mongodb+srv://' URI but received a value starting with '${MONGODB_URI.slice(0, 12)}'.`
  );
}

/* -------------------------------------------------------------------------- */
/*  Optional values with safe defaults                                         */
/* -------------------------------------------------------------------------- */

const PORT = Number(process.env.PORT) || 5001;

const NODE_ENV = process.env.NODE_ENV ?? "DEVELOPMENT";

const isProduction = NODE_ENV === "PRODUCTION";

/* CORS: production allows only the configured frontend, dev allows localhost. */
const FRONTEND_URL = process.env.FRONTEND_URL;

const ALLOWED_ORIGINS = isProduction
  ? [FRONTEND_URL].filter((origin): origin is string => Boolean(origin))
  : ["http://localhost:5173"];

/* Short code generation. */
const MIN_CODE_LENGTH = Number(process.env.MIN_CODE_LENGTH) || 4;
const MAX_CODE_LENGTH = Number(process.env.MAX_CODE_LENGTH) || 6;
const MAX_CODE_ATTEMPTS = Number(process.env.MAX_CODE_ATTEMPTS) || 10;

if (
  !Number.isFinite(MIN_CODE_LENGTH) ||
  !Number.isFinite(MAX_CODE_LENGTH) ||
  MIN_CODE_LENGTH < 1 ||
  MAX_CODE_LENGTH < MIN_CODE_LENGTH
) {
  throw new Error(
    "MIN_CODE_LENGTH / MAX_CODE_LENGTH are not configured correctly"
  );
}

/* Link lifetime (days). */
const EXPIRATION_DAYS = Number(process.env.EXPIRATION_DAYS);

if (!Number.isFinite(EXPIRATION_DAYS) || EXPIRATION_DAYS <= 0) {
  throw new Error("EXPIRATION_DAYS is not configured correctly");
}

/* API key quota. */
const API_KEY_MONTHLY_LIMIT =
  Number(process.env.API_KEY_MONTHLY_LIMIT) || 10000;

/* API key secret length (characters). */
const API_KEY_LENGTH = Number(process.env.API_KEY_LENGTH) || 45;

if (
  !Number.isFinite(API_KEY_LENGTH) ||
  API_KEY_LENGTH < 16
) {
  throw new Error("API_KEY_LENGTH is not configured correctly");
}

/* Maximum accepted input URL length (characters). */
const MAX_URL_LENGTH = Number(process.env.MAX_URL_LENGTH) || 640;

if (
  !Number.isFinite(MAX_URL_LENGTH) ||
  MAX_URL_LENGTH <= 0
) {
  throw new Error("MAX_URL_LENGTH is not configured correctly");
}

/* Public base URL used to build short links. */
const PUBLIC_URL = process.env.PUBLIC_URL;

if (!PUBLIC_URL) {
  throw new Error("PUBLIC_URL is not configured");
}

/* Encryption key for URL storage (AES-256-GCM + HMAC-SHA-256). */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is not configured");
}

/* -------------------------------------------------------------------------- */
/*  Exports                                                                    */
/* -------------------------------------------------------------------------- */

export const env = {
  PORT,
  NODE_ENV,
  isProduction,
  MONGODB_URI,
  FRONTEND_URL,
  ALLOWED_ORIGINS,
  PUBLIC_URL,
  MIN_CODE_LENGTH,
  MAX_CODE_LENGTH,
  MAX_CODE_ATTEMPTS,
  EXPIRATION_DAYS,
  API_KEY_MONTHLY_LIMIT,
  API_KEY_LENGTH,
  MAX_URL_LENGTH,
  ENCRYPTION_KEY,
} as const;