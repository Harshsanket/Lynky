import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../src/config/env.js";

/**
 * Rate-limit identity.
 *
 * `X-Forwarded-For` is only honoured in production, where the request is
 * guaranteed to arrive through Vercel's edge (which appends the real client
 * address as the rightmost entry). In development the origin is hit directly,
 * so the raw socket address is used — otherwise the header could be spoofed
 * to rotate the limit bucket indefinitely.
 *
 * `ipKeyGenerator` returns the IPv4 unchanged but normalises IPv6 to its /56
 * subnet, so a single attacker cannot rotate through an address block to
 * bypass the limits.
 */
const keyGenerator = (req: Request): string => {
  const ip = env.isProduction
    ? req.ip
    : req.socket.remoteAddress;

  return ipKeyGenerator(ip || "unknown");
};

/** Global throttle applied to every request (anti-DoS backstop). */
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,

  keyGenerator,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  statusCode: 429,
});

/** Stricter throttle for URL-creation endpoints (frontend + API). */
export const linkRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,

  keyGenerator,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  statusCode: 429,
});