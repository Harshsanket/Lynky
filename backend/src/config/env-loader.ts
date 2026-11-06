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
export type ClickStorageMode = "hybrid" | "exact" | "dynamic";

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
  ALLOW_PRIVATE_SUFFIXES: boolean;
  BLOCKLIST_FAILURE_MODE: "open" | "closed";
  CONFIG_FULL_RUNTIME_VALIDATION: boolean;
  UPSTASH_REDIS_REST_URL: string | undefined;
  UPSTASH_REDIS_REST_TOKEN: string | undefined;
  GLOBAL_RATE_LIMIT_PER_HOUR: number;
  LINK_RATE_LIMIT_PER_15_MIN: number;
  SERVER_STAGE_TIMINGS: boolean;
  HOT_VISIT_THRESHOLD: number;
  HOT_WINDOW_SECONDS: number;
  HOT_CACHE_TTL_SECONDS: number;
  CLICK_STORAGE_MODE: ClickStorageMode;
  CLICK_EXACT_BELOW_PER_HOUR: number;
  CLICK_FLUSH_EVERY_N: number;
  CLICK_FLUSH_INTERVAL_MS: number;
  CLICK_PENDING_TTL_SECONDS: number;
  SYSADMIN_ENABLED: boolean;
  SYSADMIN_USERNAME: string | undefined;
  SYSADMIN_PASSWORD_HASH: string | undefined;
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
   * (Vercel, for example), so normalise before comparing. Unknown names are
   * rejected instead of silently behaving like development.
   */
  const NODE_ENV = normalizeNodeEnv(source.NODE_ENV);

  if (
    !["development", "test", "production"].includes(NODE_ENV)
  ) {
    throw new Error(
      "NODE_ENV must be one of: development, test, production"
    );
  }

  const isProduction = isProductionNodeEnv(NODE_ENV);

  /*
   * FRONTEND_URL is an origin, not a page URL: CORS compares exact origins,
   * so a path or query would silently never match. Normalise through `URL`
   * and keep only the origin.
   */
  let FRONTEND_URL: string | undefined;

  if (source.FRONTEND_URL?.trim()) {
    try {
      const parsed = new URL(source.FRONTEND_URL.trim());

      if (
        (parsed.protocol !== "http:" &&
          parsed.protocol !== "https:") ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error("not an origin");
      }

      FRONTEND_URL = parsed.origin;
    } catch {
      throw new Error(
        "FRONTEND_URL must be a valid http(s) origin without a path, query, or credentials"
      );
    }
  }

  if (isProduction && !FRONTEND_URL) {
    throw new Error(
      "FRONTEND_URL is not configured. It is required in production so the API can allow the site origin."
    );
  }

  /* CORS: production allows only the configured frontend; development also
   * accepts an explicitly configured FRONTEND_URL (staging/custom ports). */
  const ALLOWED_ORIGINS = isProduction
    ? [FRONTEND_URL as string]
    : Array.from(
        new Set(
          ["http://localhost:5173", FRONTEND_URL].filter(
            (origin): origin is string => Boolean(origin)
          )
        )
      );

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
    !Number.isInteger(MIN_CODE_LENGTH) ||
    !Number.isInteger(MAX_CODE_LENGTH) ||
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
    !Number.isInteger(MAX_CODE_ATTEMPTS) ||
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
    !Number.isInteger(API_KEY_LENGTH) ||
    API_KEY_LENGTH < 16 ||
    API_KEY_LENGTH > 512
  ) {
    throw new Error(
      "API_KEY_LENGTH must be an integer between 16 and 512"
    );
  }

  /* Maximum accepted input URL length (characters). */
  const MAX_URL_LENGTH =
    source.MAX_URL_LENGTH === undefined
      ? 640
      : Number(source.MAX_URL_LENGTH);

  if (
    !Number.isInteger(MAX_URL_LENGTH) ||
    MAX_URL_LENGTH <= 0
  ) {
    throw new Error("MAX_URL_LENGTH is not configured correctly");
  }

  /*
   * Public base URL used to build short links. Allow a subpath deployment
   * (`https://example.com/lynky`) but reject query strings, fragments and
   * credentials, which would produce malformed short links.
   */
  let PUBLIC_URL: string;

  try {
    const parsed = new URL(source.PUBLIC_URL?.trim() ?? "");

    if (
      (parsed.protocol !== "http:" &&
        parsed.protocol !== "https:") ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("invalid public URL");
    }

    PUBLIC_URL = `${parsed.origin}${parsed.pathname}`.replace(
      /\/$/,
      ""
    );
  } catch {
    throw new Error(
      "PUBLIC_URL must be a valid http(s) URL without a query, fragment, or credentials"
    );
  }

  /* Encryption key for URL storage (AES-256-GCM + HMAC-SHA-256). */
  const ENCRYPTION_KEY = source.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }

  if (ENCRYPTION_KEY.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY must be at least 32 characters; generate one with `openssl rand -base64 32`"
    );
  }

  /*
   * Whether hosts resolving under private public-suffix entries (*.eu.org,
   * *.pp.ua, *.github.io-style free-suffix spaces) count as valid registrable
   * domains. Off by default: those spaces are abuse-ridden and hosts on them
   * are indistinguishable from a suffix-only URL.
   */
  const ALLOW_PRIVATE_SUFFIXES = ["1", "true"].includes(
    (source.ALLOW_PRIVATE_SUFFIXES ?? "").trim().toLowerCase()
  );

  const BLOCKLIST_FAILURE_MODE = (
    source.BLOCKLIST_FAILURE_MODE ?? "open"
  )
    .trim()
    .toLowerCase();

  if (
    BLOCKLIST_FAILURE_MODE !== "open" &&
    BLOCKLIST_FAILURE_MODE !== "closed"
  ) {
    throw new Error(
      "BLOCKLIST_FAILURE_MODE must be one of: open, closed"
    );
  }

  const CONFIG_FULL_RUNTIME_VALIDATION = ["1", "true"].includes(
    (source.CONFIG_FULL_RUNTIME_VALIDATION ?? "").trim().toLowerCase()
  );

  /* ------------------------------------------------------------------------ */
  /*  Upstash Redis / click accounting / global limit                         */
  /* ------------------------------------------------------------------------ */

  let UPSTASH_REDIS_REST_URL: string | undefined;
  let UPSTASH_REDIS_REST_TOKEN: string | undefined;

  if (source.UPSTASH_REDIS_REST_URL?.trim()) {
    try {
      const parsed = new URL(source.UPSTASH_REDIS_REST_URL.trim());

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("not an http(s) URL");
      }

      if (
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error("not an origin");
      }

      UPSTASH_REDIS_REST_URL = parsed.origin;
    } catch {
      throw new Error(
        "UPSTASH_REDIS_REST_URL must be a valid http(s) URL without credentials, query, or fragment"
      );
    }
  }

  if (source.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    UPSTASH_REDIS_REST_TOKEN = source.UPSTASH_REDIS_REST_TOKEN.trim();
  }

  if (
    Boolean(UPSTASH_REDIS_REST_URL) !==
    Boolean(UPSTASH_REDIS_REST_TOKEN)
  ) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together"
    );
  }

  if (isProduction && !UPSTASH_REDIS_REST_URL) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production"
    );
  }

  const integerSetting = (
    name: string,
    fallback: number,
    options: { min?: number; max?: number } = {}
  ): number => {
    const raw = source[name];
    const value = raw === undefined ? fallback : Number(raw);
    const min = options.min ?? 0;
    const max = options.max ?? Number.MAX_SAFE_INTEGER;

    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(
        `${name} must be an integer between ${min} and ${max}`
      );
    }

    return value;
  };

  const GLOBAL_RATE_LIMIT_PER_HOUR = integerSetting(
    "GLOBAL_RATE_LIMIT_PER_HOUR",
    5000,
    { min: 1, max: 100_000_000 }
  );
  const LINK_RATE_LIMIT_PER_15_MIN = integerSetting(
    "LINK_RATE_LIMIT_PER_15_MIN",
    100,
    { min: 1, max: 100_000_000 }
  );
  const SERVER_STAGE_TIMINGS = ["1", "true"].includes(
    (source.SERVER_STAGE_TIMINGS ?? "").trim().toLowerCase()
  );

  if (SERVER_STAGE_TIMINGS && isProduction) {
    throw new Error(
      "SERVER_STAGE_TIMINGS is development-only and cannot be enabled in production"
    );
  }
  const HOT_VISIT_THRESHOLD = integerSetting(
    "HOT_VISIT_THRESHOLD",
    4,
    { min: 1, max: 1000 }
  );
  const HOT_WINDOW_SECONDS = integerSetting(
    "HOT_WINDOW_SECONDS",
    300,
    { min: 1, max: 86_400 }
  );
  const HOT_CACHE_TTL_SECONDS = integerSetting(
    "HOT_CACHE_TTL_SECONDS",
    900,
    { min: 1, max: 86_400 }
  );
  const CLICK_EXACT_BELOW_PER_HOUR = integerSetting(
    "CLICK_EXACT_BELOW_PER_HOUR",
    2000,
    { min: 0, max: 1_000_000 }
  );
  const CLICK_FLUSH_EVERY_N = integerSetting(
    "CLICK_FLUSH_EVERY_N",
    10,
    { min: 1, max: 1_000_000 }
  );
  const CLICK_FLUSH_INTERVAL_MS = integerSetting(
    "CLICK_FLUSH_INTERVAL_MS",
    60_000,
    { min: 1, max: 86_400_000 }
  );
  const CLICK_PENDING_TTL_SECONDS = integerSetting(
    "CLICK_PENDING_TTL_SECONDS",
    86_400,
    { min: 1, max: 31_536_000 }
  );

  const CLICK_STORAGE_MODE = (
    source.CLICK_STORAGE_MODE ?? "hybrid"
  )
    .trim()
    .toLowerCase();

  if (
    CLICK_STORAGE_MODE !== "hybrid" &&
    CLICK_STORAGE_MODE !== "exact" &&
    CLICK_STORAGE_MODE !== "dynamic"
  ) {
    throw new Error(
      "CLICK_STORAGE_MODE must be one of: hybrid, exact, dynamic"
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  Sysadmin                                                                */
  /* ------------------------------------------------------------------------ */

  const SYSADMIN_ENABLED = ["1", "true"].includes(
    (source.SYSADMIN_ENABLED ?? "").trim().toLowerCase()
  );

  const SYSADMIN_USERNAME = source.SYSADMIN_USERNAME?.trim() || undefined;
  const SYSADMIN_PASSWORD_HASH =
    source.SYSADMIN_PASSWORD_HASH?.trim() || undefined;

  if (
    SYSADMIN_USERNAME !== undefined &&
    !/^[a-z.]{1,15}$/.test(SYSADMIN_USERNAME)
  ) {
    throw new Error(
      "SYSADMIN_USERNAME must be 1-15 lowercase letters or dots"
    );
  }

  const ADMIN_PASSWORD_HASH_PATTERN =
    /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i;

  if (
    SYSADMIN_PASSWORD_HASH !== undefined &&
    !ADMIN_PASSWORD_HASH_PATTERN.test(SYSADMIN_PASSWORD_HASH)
  ) {
    throw new Error(
      "SYSADMIN_PASSWORD_HASH must use the scrypt:<salt>:<hash> format; generate it with `npm run admin:hash-password`"
    );
  }

  if (SYSADMIN_ENABLED && !SYSADMIN_USERNAME) {
    throw new Error(
      "SYSADMIN_USERNAME is required when SYSADMIN_ENABLED=true"
    );
  }

  if (SYSADMIN_ENABLED && !SYSADMIN_PASSWORD_HASH) {
    throw new Error(
      "SYSADMIN_PASSWORD_HASH is required when SYSADMIN_ENABLED=true"
    );
  }

  return {
    ALLOW_PRIVATE_SUFFIXES,
    BLOCKLIST_FAILURE_MODE: BLOCKLIST_FAILURE_MODE as "open" | "closed",
    CONFIG_FULL_RUNTIME_VALIDATION,
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    GLOBAL_RATE_LIMIT_PER_HOUR,
    LINK_RATE_LIMIT_PER_15_MIN,
    SERVER_STAGE_TIMINGS,
    HOT_VISIT_THRESHOLD,
    HOT_WINDOW_SECONDS,
    HOT_CACHE_TTL_SECONDS,
    CLICK_STORAGE_MODE: CLICK_STORAGE_MODE as ClickStorageMode,
    CLICK_EXACT_BELOW_PER_HOUR,
    CLICK_FLUSH_EVERY_N,
    CLICK_FLUSH_INTERVAL_MS,
    CLICK_PENDING_TTL_SECONDS,
    SYSADMIN_ENABLED,
    SYSADMIN_USERNAME,
    SYSADMIN_PASSWORD_HASH,
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
