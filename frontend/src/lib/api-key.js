/**
 * API-key input helpers shared by the usage page and its tests.
 *
 * `VITE_API_KEY_LENGTH` mirrors the backend's `API_KEY_LENGTH`. Vite env vars
 * are build-time values, so changing either side requires a rebuild and
 * invalidates keys issued with the previous length.
 */

const env = import.meta.env ?? {};
const configuredLength = Number(env.VITE_API_KEY_LENGTH ?? 45);

export const API_KEY_LENGTH =
  Number.isInteger(configuredLength) &&
  configuredLength >= 16 &&
  configuredLength <= 512
    ? configuredLength
    : 45;

/** Exactly the alphabet the backend generator emits (base64url, no `=`). */
export const API_KEY_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const API_KEY_CHARACTERS = new Set(API_KEY_ALPHABET);

/**
 * Keep the input usable without silently deleting invalid characters:
 * outer whitespace is trimmed and the value is capped at the configured
 * length, but internal spaces/punctuation stay visible so validation can
 * reject them.
 */
export const sanitizeApiKey = (value) =>
  String(value ?? '')
    .trim()
    .slice(0, API_KEY_LENGTH);

/** Validate against an explicit length (used by parity tests and tooling). */
export const isValidApiKeyForLength = (value, length) => {
  if (typeof value !== 'string' || value.length !== length) {
    return false;
  }

  for (const character of value) {
    if (!API_KEY_CHARACTERS.has(character)) {
      return false;
    }
  }

  return true;
};

/**
 * Whether the input can be sent to the backend: exact configured length and
 * only generator-alphabet characters. The server remains the authority on
 * whether a well-formed key exists.
 */
export const isValidApiKey = (value) =>
  isValidApiKeyForLength(value, API_KEY_LENGTH);
