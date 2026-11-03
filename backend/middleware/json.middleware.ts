import express from "express";
import { env } from "../src/config/env.js";

/**
 * JSON body parsing with a 1 KB cap.
 *
 * A single `{"url":"..."}` request for the maximum 640-character URL fits
 * comfortably below 1 KB, so no larger body is ever needed.
 */
const bodyLimit = 1024;

export const jsonMiddleware = express.json({
  limit: bodyLimit,
});
