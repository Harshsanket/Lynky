import express from "express";

/**
 * JSON body parsing with a 1 MB cap to reject oversized payloads early.
 */
export const jsonMiddleware = express.json({
  limit: "1mb",
});