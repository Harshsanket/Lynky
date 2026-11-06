import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { env } from "../src/config/env.js";
import { logWarn } from "../service/logger.js";
import { consumeGlobalRateLimit } from "../service/rate-limit.service.js";

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

const handler = (
  req: Request,
  res: Response,
  _next: unknown,
  options: { statusCode: number; message: unknown }
) => {
  logWarn("rate_limited", {
    route: req.baseUrl || "<unmatched>",
    method: req.method,
    status: options.statusCode,
    errorCode: "rate_limited",
  });

  return res.status(options.statusCode).json(options.message);
};

/** Global throttle applied to every request (anti-DoS backstop). */
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await consumeGlobalRateLimit();

    res.setHeader("X-RateLimit-Limit", String(result.limit));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, result.limit - result.count))
    );
    res.setHeader("X-RateLimit-Reset", String(result.retryAfterSeconds));

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));

      logWarn("rate_limited", {
        route: req.baseUrl || "<unmatched>",
        method: req.method,
        status: 429,
        errorCode: "rate_limited",
      });

      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });

      return;
    }

    next();
  } catch (error) {
    // The cache store already falls back to memory; reaching this branch means
    // even the fallback failed. Let the request through rather than turning a
    // limiter outage into a full outage.
    logWarn("rate_limit_failure", {
      errorCode: "rate_limited",
      message: (error as Error)?.message ?? String(error),
    });

    next();
  }
};

/** Small throttle for API-key usage reads / probing attempts. */
export const usageRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,

  keyGenerator,
  handler,

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
  limit: env.LINK_RATE_LIMIT_PER_15_MIN,

  keyGenerator,
  handler,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  statusCode: 429,
});
