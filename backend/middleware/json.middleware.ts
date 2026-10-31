import express from "express";
import { env } from "../src/config/env.js";

/**
 * JSON body parsing with a small cap.
 *
 * 8 KB covers the default `MAX_URL_LENGTH` (640) with room to spare. If a
 * deployment raises the URL limit, grow the body cap with it so a valid URL
 * cannot be rejected by the parser.
 */
const bodyLimit = Math.max(
  8 * 1024,
  env.MAX_URL_LENGTH + 1024
);

export const jsonMiddleware = express.json({
  limit: bodyLimit,
});
