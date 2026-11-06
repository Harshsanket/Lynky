import express from "express";
import { env } from "../src/config/env.js";

/**
 * JSON body parsing with a byte limit derived from `MAX_URL_LENGTH`.
 *
 * `MAX_URL_LENGTH` counts characters, but the request body is measured in
 * UTF-8 bytes: a 640-character CJK/emoji URL can be ~2.6 KB before JSON
 * overhead. Four bytes per character plus 1 KB of JSON/escape overhead covers
 * the worst case, and a 8 KB floor keeps room for future small additions.
 */
const derivedLimit =
  env.MAX_URL_LENGTH * 4 + 1024;

export const JSON_BODY_LIMIT_BYTES = Math.max(
  8 * 1024,
  derivedLimit
);

export const jsonMiddleware = express.json({
  limit: JSON_BODY_LIMIT_BYTES,
});
