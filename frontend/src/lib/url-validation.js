/**
 * Pre-flight URL validation for the browser.
 *
 * Distilled mirror of the backend validator (`url-validator.service.ts` +
 * `url-host-validator.service.ts`) using only the built-in WHATWG URL parser.
 * It is a UX filter, not a security boundary: the server re-validates
 * everything from the raw input. ipaddr.js / tldts / blocklists intentionally
 * do NOT ship to the browser.
 *
 * Keep in sync with `backend/tests/url-validator.test.ts` fixtures.
 */

// The regex deliberately matches control characters — that is the check.
/* eslint-disable-next-line no-control-regex */
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F\u0080-\u009F\u202A-\u202E\u2066-\u2069]/;

const RAW_CREDENTIALS_PATTERN =
  /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*@/;

const HOSTNAME_LABEL_PATTERN = /^[a-z0-9-]+$/;

const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

const configuredMaxUrlLength = Number(
  import.meta.env?.VITE_MAX_URL_LENGTH ?? 640
);

/**
 * Mirror of the backend `MAX_URL_LENGTH` (characters). Vite env vars are
 * build-time values; keep `VITE_MAX_URL_LENGTH` in sync with the backend.
 */
export const MAX_URL_LENGTH =
  Number.isInteger(configuredMaxUrlLength) &&
  configuredMaxUrlLength > 0
    ? configuredMaxUrlLength
    : 640;

const INTERNAL_HOSTNAME_SUFFIXES = [
  'localdomain',
  'local',
  'internal',
  'intranet',
  'lan',
  'home.arpa',
  'test',
  'example',
  'invalid',
];

const LOCAL_HOSTNAME_SUFFIXES = ['localhost', 'localhost.localdomain'];

export const MESSAGES = {
  invalid:
    "That doesn't look like a valid URL — paste the full link, including https://",
  credentials:
    'URLs that include login credentials (user:pass@) are not allowed',
  privateNetwork:
    'Localhost and private network addresses are not allowed',
  internal:
    'Internal or special-use hostnames are not allowed',
  idn: 'Internationalized domain names are not supported',
};

/**
 * Network prefixes the private-range checks accept as normal. Keep
 * unicast-style banners out of the browser: only the cheap textual rejects
 * are mirrored here; classification otherwise happens server-side.
 */
const isPrivateIpv4 = (host) => {
  const parts = host.split('.');

  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const [a, b, c, d] = parts.map(Number);

  if ([a, b, c, d].some((n) => n > 255)) {
    return false;
  }

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a >= 224 && a <= 239) ||
    a >= 240 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
};

const stripIpv6Brackets = (hostname) =>
  hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

const isIpLiteral = (host) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
  /^[0-9a-f:]+$/i.test(host) && host.includes(':');

/**
 * Cheap textual IPv6 rejects mirroring the server's unicast-only policy for
 * the commonly abused ranges: loopback, IPv4-mapped, unique-local (fc/fd),
 * link-local (fe80::/10 → fe8..feb), multicast (ff), 6to4, teredo, and the
 * TEST-NET documentation range. Anything rarer passes here and is decided
 * server-side with ipaddr.js.
 */
const isNonPublicIpv6 = (host) => {
  const h = host.toLowerCase();

  return (
    // `::/96` covers unspecified, loopback, IPv4-mapped, and deprecated
    // IPv4-compatible forms (e.g. `::7f00:1` = 127.0.0.1).
    h.startsWith('::') ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe8') ||
    h.startsWith('fe9') ||
    h.startsWith('fea') ||
    h.startsWith('feb') ||
    h.startsWith('ff') ||
    h.startsWith('2002:') ||
    h.startsWith('2001:0') ||
    h.startsWith('2001:db8')
  );
};

const matchesSuffix = (hostname, suffixes) =>
  suffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );

/**
 * Validate a URL input value.
 *
 * Returns `{ valid: true, url }` or `{ valid: false, message }`, with the
 * message mirroring the backend's rejection reasons.
 */
export const validateUrlInput = (value) => {
  const reject = (message) => ({ valid: false, message });

  if (!value || typeof value !== 'string') {
    return reject(MESSAGES.invalid);
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.includes('\\')) {
    return reject(MESSAGES.invalid);
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return reject(
      `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`
    );
  }

  if (FORBIDDEN_CHARS.test(trimmed)) {
    return reject(MESSAGES.invalid);
  }

  if (RAW_CREDENTIALS_PATTERN.test(trimmed)) {
    return reject(MESSAGES.credentials);
  }

  let parsed;

  try {
    parsed = new URL(trimmed);
  } catch {
    return reject(MESSAGES.invalid);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return reject(MESSAGES.invalid);
  }

  if (!parsed.hostname) {
    return reject(MESSAGES.invalid);
  }

  if (parsed.username || parsed.password) {
    return reject(MESSAGES.credentials);
  }

  const hostname = parsed.hostname
    .replace(/\.$/, '');
  const bareHost = stripIpv6Brackets(hostname);

  if (isIpLiteral(bareHost)) {
    // The browser's parser already canonicalises obfuscated IPv4/IPv6 forms,
    // so the cheap textual checks remain meaningful here.
    if (isPrivateIpv4(bareHost) || isNonPublicIpv6(bareHost)) {
      return reject(MESSAGES.privateNetwork);
    }

    return { valid: true, url: parsed };
  }

  if (
    hostname.length > MAX_HOSTNAME_LENGTH ||
    hostname.includes('%') ||
    bareHost.split('.').some((label) => label.startsWith('xn--'))
  ) {
    return reject(
      bareHost.split('.').some((label) => label.startsWith('xn--'))
        ? MESSAGES.idn
        : MESSAGES.invalid
    );
  }

  for (const label of bareHost.split('.')) {
    if (
      !label ||
      label.length > MAX_LABEL_LENGTH ||
      !HOSTNAME_LABEL_PATTERN.test(label) ||
      label.charCodeAt(0) === 0x2d ||
      label.charCodeAt(label.length - 1) === 0x2d
    ) {
      return reject(MESSAGES.invalid);
    }
  }

  if (matchesSuffix(bareHost, LOCAL_HOSTNAME_SUFFIXES)) {
    return reject(MESSAGES.privateNetwork);
  }

  if (matchesSuffix(bareHost, INTERNAL_HOSTNAME_SUFFIXES)) {
    return reject(MESSAGES.internal);
  }

  // Single-label or dot-less hosts are not public internet domains; the
  // server's public-suffix check is the final word either way.
  if (!bareHost.includes('.')) {
    return reject(MESSAGES.invalid);
  }

  return { valid: true, url: parsed };
};
