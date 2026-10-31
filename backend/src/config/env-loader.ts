import {
  isProductionNodeEnv,
  normalizeNodeEnv,
} from "./environment.js";

/**
 * Pure configuration loader.
 *
 * Kept separate from `env.ts` so tests can exercise validation without
 * requiring real secrets or triggering the module-level singleton.
 *
 * Fail-fast: values that are required for the app to function (database URI,
 * encryption key, public URL, and the production frontend origin) throw.
 */
export interface AppEnv {
  PORT: number;
  NODE_ENV: string;
  isProduction: boolean;
  MONGODB_URI: string;
  FRONTEND_URL: string | undefined;
  ALLOWED_ORIGINS: string[];
  PUBLIC_URL: string;
  MIN_CODE_LENGTH: number;
  MAX_CODE_LENGTH: number;
  MAX_CODE_ATTEMPTS: number;
  EXPIRATION_DAYS: number;
  API_KEY_MONTHLY_LIMIT: number;
  API_KEY_LENGTH: number;
  MAX_URL_LENGTH: number;
  ENCRYPTION_KEY: string;
}

/** Parse and validate configuration from an environment-like object. */
export const loadEnv = (
  source: Record<string, string | undefined> = process.env
): AppEnv => {
  /* ------------------------------------------------------------------------ */
  /*  Required values                                                          */
  /* ------------------------------------------------------------------------ */

  const MONGODB_URI = source.MONGODB_URI;

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
      "MONGODB_URI is invalid. Expected a 'mongodb://' or 'mongodb+srv://' URI."
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  Optional values with safe defaults                                       */
  /* ------------------------------------------------------------------------ */

  const PORT =
    source.PORT === undefined
      ? 5001
      : Number(source.PORT);

  if (
    !Number.isInteger(PORT) ||
    PORT < 1 ||
    PORT > 65535
  ) {
    throw new Error("PORT is not configured correctly");
  }

  /*
   * Node deployments conventionally use the lowercase value `production`
   * (Vercel, for example), so normalise before comparing.
   */
  const NODE_ENV = normalizeNodeEnv(source.NODE_ENV);

  const isProduction = isProductionNodeEnv(source.NODE_ENV);

  /* CORS: production allows only the configured frontend, dev allows localhost. */
  const FRONTEND_URL = source.FRONTEND_URL?.replace(/\/$/, "");

  if (isProduction && !FRONTEND_URL) {
    throw new Error(
      "FRONTEND_URL is not configured. It is required in production so the API can allow the site origin."
    );
  }

  const ALLOWED_ORIGINS = isProduction
    ? [FRONTEND_URL as string]
    : ["http://localhost:5173"];

  /* Short code generation. */
  const MIN_CODE_LENGTH =
    source.MIN_CODE_LENGTH === undefined
      ? 4
      : Number(source.MIN_CODE_LENGTH);

  const MAX_CODE_LENGTH =
    source.MAX_CODE_LENGTH === undefined
      ? 6
      : Number(source.MAX_CODE_LENGTH);

  const MAX_CODE_ATTEMPTS =
    source.MAX_CODE_ATTEMPTS === undefined
      ? 10
      : Number(source.MAX_CODE_ATTEMPTS);

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

  if (
    MAX_CODE_LENGTH > 8
  ) {
    throw new Error(
      "MAX_CODE_LENGTH must be <= 8; the generator uses 48 bits of entropy"
    );
  }

  if (
    !Number.isFinite(MAX_CODE_ATTEMPTS) ||
    MAX_CODE_ATTEMPTS < 1
  ) {
    throw new Error(
      "MAX_CODE_ATTEMPTS is not configured correctly"
    );
  }

  /* Link lifetime (days). */
  const EXPIRATION_DAYS = Number(source.EXPIRATION_DAYS);

  if (!Number.isFinite(EXPIRATION_DAYS) || EXPIRATION_DAYS <= 0) {
    throw new Error("EXPIRATION_DAYS is not configured correctly");
  }

  /* API key quota. */
  const parsedMonthlyLimit = Number(
    source.API_KEY_MONTHLY_LIMIT
  );

  const API_KEY_MONTHLY_LIMIT =
    Number.isFinite(parsedMonthlyLimit) &&
    parsedMonthlyLimit > 0
      ? Math.floor(parsedMonthlyLimit)
      : 10000;

  /* API key secret length (characters). */
  const API_KEY_LENGTH =
    source.API_KEY_LENGTH === undefined
      ? 45
      : Number(source.API_KEY_LENGTH);

  if (
    !Number.isFinite(API_KEY_LENGTH) ||
    API_KEY_LENGTH < 16 ||
    API_KEY_LENGTH > 512
  ) {
    throw new Error(
      "API_KEY_LENGTH must be between 16 and 512"
    );
  }

  /* Maximum accepted input URL length (characters). */
  const MAX_URL_LENGTH =
    source.MAX_URL_LENGTH === undefined
      ? 640
      : Number(source.MAX_URL_LENGTH);

  if (!Number.isFinite(MAX_URL_LENGTH) || MAX_URL_LENGTH <= 0) {
    throw new Error("MAX_URL_LENGTH is not configured correctly");
  }

  /* Public base URL used to build short links. */
  const PUBLIC_URL = source.PUBLIC_URL;

  if (!PUBLIC_URL) {
    throw new Error("PUBLIC_URL is not configured");
  }

  /* Encryption key for URL storage (AES-256-GCM + HMAC-SHA-256). */
  const ENCRYPTION_KEY = source.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }

  return {
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
  };
};
