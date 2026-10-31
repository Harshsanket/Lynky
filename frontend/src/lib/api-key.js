/**
 * API-key input helpers shared by the usage page and its tests.
 *
 * The backend is the source of truth for key validity: the key length is
 * configurable (`API_KEY_LENGTH`) and keys issued before that setting existed
 * are shorter. We therefore only enforce the base64url alphabet and a hard
 * input cap so the UI stays bounded; the server returns 401/403 for keys it
 * does not recognise.
 */

export const API_KEY_MAX_INPUT_LENGTH = 512;

const API_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Keep only API-key characters (base64url alphabet), capped at the input
 * limit, so a link or any other text can't be entered into the field.
 */
export const sanitizeApiKey = (value) =>
  String(value ?? '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, API_KEY_MAX_INPUT_LENGTH);

/**
 * Whether the input can be sent to the backend. This deliberately does not
 * check an exact length: valid keys vary with configuration and deployment
 * history, and the backend is the authority on whether a key exists.
 */
export const isValidApiKey = (value) =>
  value.length > 0 &&
  value.length <= API_KEY_MAX_INPUT_LENGTH &&
  API_KEY_PATTERN.test(value);
