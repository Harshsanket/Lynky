import { env } from "../src/config/env.js";

const CODE_PATTERN = /^[0-9A-Za-z]+$/;

/*
 * Accept a broad range rather than the current configuration: codes issued
 * before a `MIN_CODE_LENGTH`/`MAX_CODE_LENGTH` change must keep resolving.
 * The database lookup remains the authority on whether a code exists.
 */
const MAX_CODE_LOOKUP_LENGTH = Math.max(
  env.MAX_CODE_LENGTH,
  64
);

/**
 * Whether a short code is worth a database lookup.
 *
 * Used before the database middleware so scanner paths (`/favicon.ico`,
 * `/robots.txt`, …) do not trigger a connection attempt.
 */
export const isValidCode = (code: string): boolean =>
  code.length >= 1 &&
  code.length <= MAX_CODE_LOOKUP_LENGTH &&
  CODE_PATTERN.test(code);
