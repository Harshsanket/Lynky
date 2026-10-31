/**
 * Public configuration exposed to the API documentation page.
 *
 * The backend owns the real monthly limit; this value only controls the
 * label shown in the UI. Keep it in sync via `VITE_API_KEY_MONTHLY_LIMIT`.
 */

const configuredLimit = Number(import.meta.env.VITE_API_KEY_MONTHLY_LIMIT);

export const MONTHLY_LIMIT_LABEL =
  Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit.toLocaleString()
    : '10,000';
