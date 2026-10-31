import { loadEnv } from "./env-loader.js";

/**
 * Centralised environment configuration.
 *
 * Every `process.env` read in the codebase should go through this module so
 * that configuration is validated once, at startup, instead of silently
 * producing `undefined`/`NaN` mid-request.
 *
 * Fail-fast: values that are required for the app to function (database URI,
 * encryption key, public URL, and the production frontend origin) throw at
 * import time when missing.
 */
export const env = loadEnv(process.env);
