import crypto from "node:crypto";
import { env } from "../src/config/env.js";

export const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const BASE62 = BASE62_ALPHABET;

/**
 * Random code length within the configured [MIN, MAX] range.
 *
 * Uses the CSPRNG so the length cannot be predicted or biased.
 */
export const getCodeLength = (): number => {
  return crypto.randomInt(
    env.MIN_CODE_LENGTH,
    env.MAX_CODE_LENGTH + 1
  );
};

/**
 * Generate a cryptographically random short code.
 *
 * Codes must not be derived from the destination URL: doing so makes them
 * predictable and lets anyone who knows a URL compute its short link without
 * calling the API. Dedupe is handled by `urlHash`, so randomness is safe.
 */
export const generateCode = (codeLength: number): string => {
  let code = "";

  for (let i = 0; i < codeLength; i++) {
    code += BASE62[crypto.randomInt(BASE62.length)]!;
  }

  return code;
};