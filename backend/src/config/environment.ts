/**
 * Environment-name helpers kept separate from `env.ts` so they can be tested
 * without loading the full configuration (which requires secrets).
 */

/**
 * Normalise `NODE_ENV`. Node deployments conventionally use lowercase
 * (`production`), while some setups use uppercase (`PRODUCTION`); treat both
 * the same and default to `development`.
 */
export const normalizeNodeEnv = (
  value: string | undefined
): string => (value ?? "development").trim().toLowerCase();

/** Whether the normalised environment is production. */
export const isProductionNodeEnv = (
  value: string | undefined
): boolean => normalizeNodeEnv(value) === "production";
