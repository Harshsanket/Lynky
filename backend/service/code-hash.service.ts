import crypto from "node:crypto";
import { env } from "../src/config/env.js";
import { BASE62_ALPHABET } from "./shortcode-generater.service.js";

/**
 * Short codes are never stored in plaintext. `codeHash` is a keyed HMAC of the
 * path code, so a leaked database cannot be used to enumerate or recover
 * short URLs; redirects hash the incoming code and look up that digest.
 */
const CODE_HASH_VERSION = "v1";
const CODE_HASH_PREFIX = `${CODE_HASH_VERSION}:`;

const CODE_HASH_KEY = crypto
  .createHash("sha256")
  .update(`${env.ENCRYPTION_KEY}:codehash:${CODE_HASH_VERSION}`)
  .digest();

export const CODE_HASH_PATTERN = /^v1:[a-f0-9]{64}$/;

export const hashCode = (code: string): string => {
  const digest = crypto
    .createHmac("sha256", CODE_HASH_KEY)
    .update(code)
    .digest("hex");

  return `${CODE_HASH_PREFIX}${digest}`;
};

export const isCurrentCodeHash = (value: unknown): boolean =>
  typeof value === "string" && CODE_HASH_PATTERN.test(value);

/* -------------------------------------------------------------------------- */
/*  Durable code recovery                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `codeSalt` is a per-row random 16-byte value (hex encoded). It is not a
 * secret, but it lets the server re-derive the same code from `urlHash` after
 * Redis loses the creation-response mapping.
 */
const CODE_SALT_VERSION = "v1";
const CODE_SALT_PATTERN = /^[a-f0-9]{32}$/;

const CODE_SALT_KEY = crypto
  .createHash("sha256")
  .update(`${env.ENCRYPTION_KEY}:codesalt:${CODE_SALT_VERSION}`)
  .digest();

export const generateCodeSalt = (): string =>
  crypto.randomBytes(16).toString("hex");

export const isValidCodeSalt = (value: unknown): value is string =>
  typeof value === "string" && CODE_SALT_PATTERN.test(value);

/**
 * Derive a stable short code from `urlHash + codeSalt`.
 *
 * The HMAC input is versioned so the derivation can change without silently
 * changing existing codes. With no explicit `codeLength`, the length is
 * derived deterministically from the last digest byte in
 * [MIN_CODE_LENGTH, MAX_CODE_LENGTH]; the code body is the leading base62
 * characters of the same digest. Re-deriving the same (urlHash, salt) pair
 * therefore always returns the same (length, code) pair.
 *
 * The modulo range is slightly biased (at most 1/256 per bucket for the
 * configured 4–6 range), which is acceptable for short-code generation.
 * Average space is roughly 1.9e10 versus 5.7e10 for fixed 6 characters
 * (62^4/62^5/62^6 split evenly); collision handling stays with the
 * insert-first E11000 retry loop and MAX_CODE_ATTEMPTS.
 */
export const deriveCodeFromSalt = (
  urlHash: string,
  codeSalt: string,
  codeLength?: number
): string => {
  if (!isValidCodeSalt(codeSalt)) {
    throw new Error("Invalid code salt");
  }

  const digest = crypto
    .createHmac("sha256", CODE_SALT_KEY)
    .update(`${CODE_SALT_VERSION}:${urlHash}:${codeSalt}`)
    .digest();

  const length =
    codeLength ??
    env.MIN_CODE_LENGTH +
      (digest[digest.length - 1]! %
        (env.MAX_CODE_LENGTH - env.MIN_CODE_LENGTH + 1));

  let value = BigInt(`0x${digest.toString("hex")}`);
  let encoded = "";

  while (value > 0n) {
    encoded =
      BASE62_ALPHABET[Number(value % 62n)]! + encoded;
    value /= 62n;
  }

  if (!encoded) {
    encoded = BASE62_ALPHABET[0]!;
  }

  return encoded.slice(0, length);
};
