import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logInfo } from "../service/logger.js";
import { runWithRequestContext } from "../service/request-context.service.js";

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

const requestIdFor = (req: Request): string => {
  const header = req.header("x-request-id");

  if (header && VALID_REQUEST_ID.test(header)) {
    return header;
  }

  return crypto.randomUUID();
};

/**
 * Assigns/propagates a request ID and runs the request inside an
 * AsyncLocalStorage context so every structured log line can include it.
 *
 * Access logs contain the matched route pattern, status and duration — never
 * the raw path, query string, headers, or request body.
 */
export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = requestIdFor(req);
  const startedAt = performance.now();

  res.setHeader("X-Request-Id", requestId);

  runWithRequestContext(
    {
      requestId,
      method: req.method,
    },
    () => {
      res.on("finish", () => {
        const routePath = Array.isArray(req.route?.path)
          ? req.route.path[0]
          : req.route?.path;
        const route =
          routePath !== undefined
            ? `${req.baseUrl}${routePath}`
            : req.baseUrl || "<unmatched>";

        logInfo("request_complete", {
          requestId,
          method: req.method,
          route,
          status: res.statusCode,
          durationMs:
            Math.round((performance.now() - startedAt) * 100) / 100,
        });
      });

      next();
    }
  );
};
