import ipaddr from "ipaddr.js";
import { parse as parsePublicDomain } from "tldts";
import { env } from "../src/config/env.js";
import { PublicError } from "./public-error.service.js";

/**
 * Hostname-level URL checks that require backend-only dependencies
 * (`ipaddr.js` for IP classification, `tldts` for public-suffix data) plus the
 * canonical hostname the WHATWG parser derived from the input.
 *
 * Every check runs against `parsedUrl.hostname` — the *canonical* form
 * (lowercase, punycode, IPv4 already normalised) — which is what defuses
 * obfuscation: `http://2130706433` and `http://0x7f.0.0.1` arrive here already
 * normalised to `127.0.0.1` and fall into the loopback bucket.
 *
 * Fail-closed: a classification error is treated as an invalid URL, never as a
 * pass.
 */

/** RFC 1123 maximum total hostname length. */
const MAX_HOSTNAME_LENGTH = 253;

/** RFC 1123 maximum label length. */
const MAX_LABEL_LENGTH = 63;

/** RFC 1123 label letters — SHA-1 separators and underscores are excluded. */
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9-]+$/;

/**
 * IPv4-compatible IPv6 (`::/96`, e.g. `::7f00:1` = 127.0.0.1).
 *
 * These are deprecated but still parse, and `ipaddr.js` reports them as
 * `unicast`, so they need an explicit reject. IPv4-mapped addresses
 * (`::ffff:0:0/96`) are outside this range and already rejected by their
 * `ipv4Mapped` range classification.
 */
const IPV4_COMPATIBLE_IPV6_RANGE = ipaddr.parseCIDR("::/96");

/**
 * Suffixes reserved by RFC 6761/6762/8375/2606 plus common intranet names,
 * which never describe a reachable public destination.
 */
const INTERNAL_HOSTNAME_SUFFIXES: readonly string[] = [
  "localdomain",
  "local",
  "internal",
  "intranet",
  "lan",
  "home.arpa",
  "test",
  "example",
  "invalid",
];

/** Loopback names are special-use but read as "not a reachable public URL" to users. */
const LOCAL_HOSTNAME_SUFFIXES: readonly string[] = [
  "localhost",
  "localhost.localdomain",
];

/** Public error messages, kept in one place so callers/tests can assert them. */
export const MESSAGES = {
  invalid:
    "This URL doesn't look like a real internet address",
  credentials:
    "URLs that include login credentials (user:pass@) are not allowed",
  privateNetwork:
    "Localhost and private network addresses are not allowed",
  internal:
    "Internal or special-use hostnames are not allowed",
  idn: "Internationalized domain names are not supported",
  blocklisted: "This URL is not allowed",
} as const;

/**
 * `URL.hostname` keeps IPv6 brackets; every other check wants the bare
 * literal (`::ffff:a00:1`), so unwrap exactly one bracket pair.
 */
const stripIpv6Brackets = (hostname: string): string =>
  hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

/** A single trailing root dot ("example.com.") is legal DNS syntax. */
const stripTrailingDot = (hostname: string): string =>
  hostname.length > 0 && hostname.endsWith(".")
    ? hostname.slice(0, -1)
    : hostname;

/**
 * RFC 1123 shape: non-empty labels of `[a-z0-9-]`, ≤ 63 chars each, total
 * ≤ 253, no leading/trailing hyphen, no leftover percent-escapes.
 */
export const assertValidHostnameShape = (hostname: string): void => {
  if (
    !hostname ||
    hostname.length > MAX_HOSTNAME_LENGTH ||
    hostname.includes("%")
  ) {
    throw new PublicError(MESSAGES.invalid);
  }

  for (const label of hostname.split(".")) {
    if (
      !label ||
      label.length > MAX_LABEL_LENGTH ||
      !HOSTNAME_LABEL_PATTERN.test(label) ||
      label.charCodeAt(0) === 0x2d ||
      label.charCodeAt(label.length - 1) === 0x2d
    ) {
      throw new PublicError(MESSAGES.invalid);
    }
  }
};

/** `user:pass@host` — including the empty-`@` smuggling form `http://@host`. */
export const assertNotEmbeddedCredentials = (parsedUrl: URL): void => {
  if (parsedUrl.username || parsedUrl.password) {
    throw new PublicError(MESSAGES.credentials);
  }
};

/** `*.localhost` reads as "local machine" → the private-network message. */
export const assertNotInternalHostname = (hostname: string): void => {
  const isLocal = LOCAL_HOSTNAME_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );

  if (isLocal) {
    throw new PublicError(MESSAGES.privateNetwork);
  }

  const isInternal = INTERNAL_HOSTNAME_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );

  if (isInternal) {
    throw new PublicError(MESSAGES.internal);
  }
};

/** `null` when the hostname is not an IP literal, else its ipaddr.js range. */
const ipLiteralRange = (hostname: string): string | null => {
  try {
    return ipaddr.parse(hostname).range();
  } catch {
    return null;
  }
};

/** Whether an IPv6 literal sits in the deprecated IPv4-compatible `::/96`. */
const isIpv4CompatibleIpv6 = (hostname: string): boolean => {
  if (!hostname.includes(":")) {
    return false;
  }

  try {
    const address = ipaddr.parse(hostname);

    return (
      address.kind() === "ipv6" &&
      address.match(IPV4_COMPATIBLE_IPV6_RANGE)
    );
  } catch {
    return false;
  }
};

/**
 * Reject any IP literal outside the global unicast range.
 *
 * Covers loopback, RFC 1918 private, link-local (169.254/16, fe80::/10),
 * multicast (224/4, ff00::/8), unique-local (fc00::/7), CGNAT (100.64/10),
 * TEST-NET documentation ranges, unspecified, broadcast, benchmarking
 * (198.18/15), and the embedded-obfuscation forms: 6to4, teredo, and
 * IPv4-mapped IPv6 (`::ffff:10.0.0.1`).
 */
export const assertPublicIpLiteral = (hostname: string): void => {
  const range = ipLiteralRange(hostname);

  if (range !== null && range !== "unicast") {
    throw new PublicError(MESSAGES.privateNetwork);
  }

  if (isIpv4CompatibleIpv6(hostname)) {
    throw new PublicError(MESSAGES.privateNetwork);
  }
};

/**
 * The hostname must sit under an ICANN-registered registrable domain.
 *
 * Rejects single-label hosts (`myserver`), hosts on unknown/offline TLDs
 * (`.corp`, `.intranet`), suffix-only URLs, punycode/IDN labels, and — unless
 * `ALLOW_PRIVATE_SUFFIXES` is enabled — hosts on private public-suffix-List
 * entries (`foo.eu.org`, `myblog.pp.ua`, GitHub-Pages-style spaces).
 */
export const assertRegistrableDomain = (hostname: string): void => {
  if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
    throw new PublicError(MESSAGES.idn);
  }

  // A public unicast IP literal is a legitimate destination; the public
  // suffix machinery marks it `isIp` and has no registrable domain for it.
  // Every non-public literal has already been rejected by
  // `assertPublicIpLiteral`, so reaching this point with an IP literal
  // means it is public.
  if (ipLiteralRange(hostname) === "unicast") {
    return;
  }

  let info: ReturnType<typeof parsePublicDomain>;

  try {
    info = parsePublicDomain(hostname, {
      allowPrivateDomains: true,
      allowIcannDomains: true,
    });
  } catch {
    // Fail closed: a suffix-classification error is an invalid URL, never a
    // pass and never a 500.
    throw new PublicError(MESSAGES.invalid);
  }

  // Fail closed on classification errors or IP literals that slipped past
  // `assertPublicIpLiteral` in some form.
  const allowedDomain =
    info.isIp === false &&
    Boolean(info.domain) &&
    (info.isIcann === true ||
      ((env.ALLOW_PRIVATE_SUFFIXES && info.isPrivate === true) ||
        false));

  if (!allowedDomain) {
    throw new PublicError(MESSAGES.invalid);
  }
};

/**
 * Run all hostname-level checks against a parsed URL; order is cheap →
 * expensive and each check throws its own `PublicError`.
 *
 * IP literals branch off early: the RFC 1123 shape and the suffix checks do
 * not apply to them — only the unicast-range rule does.
 */
export const assertHostAllowed = (parsedUrl: URL): void => {
  const bareHost = stripIpv6Brackets(parsedUrl.hostname);
  const hostname = stripTrailingDot(bareHost);

  assertNotEmbeddedCredentials(parsedUrl);

  if (ipLiteralRange(hostname) !== null) {
    assertPublicIpLiteral(hostname);
    return;
  }

  assertValidHostnameShape(hostname);
  assertNotInternalHostname(hostname);
  assertRegistrableDomain(hostname);
};
