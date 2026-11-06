import crypto from "node:crypto";
import { env } from "../src/config/env.js";

/**
 * Domain-separated key for URL hashes.
 *
 * `ENCRYPTION_KEY` already protects stored destinations; deriving a separate
 * HMAC key means a leaked database no longer contains a plain SHA-256 of every
 * URL (an offline confirmation oracle for candidate URLs). Dedupe remains
 * deterministic because the key and input are stable.
 */
const URL_HASH_KEY = crypto
  .createHash("sha256")
  .update(`${env.ENCRYPTION_KEY}:urlhash`)
  .digest();

/** Deterministic HMAC-SHA-256 of a cleaned URL, used as the dedupe key. */
export const hashUrl = (url: string): string =>
  crypto
    .createHmac("sha256", URL_HASH_KEY)
    .update(url)
    .digest("hex");
