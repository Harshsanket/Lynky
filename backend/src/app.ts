import express from "express";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import helmet from "helmet";
import { corsMiddleware } from "../middleware/cors.middleware.js";
import { jsonMiddleware } from "../middleware/json.middleware.js";
import { databaseConnectionMiddleware } from "../middleware/database.middleware.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { env } from "./config/env.js";
import { logError } from "../service/logger.js";
import { getPublicErrorMessage } from "../service/public-error.service.js";

import pingRoutes from "../routes/ping.routes.js";
import urlRoutes from "../routes/url.routes.js";
import externalApiRoutes from "../routes/external-api.routes.js";
import apiKeyRoutes from "../routes/api-key.routes.js";
import statsRoutes from "../routes/stats.routes.js";
import redirectRoutes from "../routes/redirect.routes.js";

const app = express();

// Trust the first proxy (Vercel) in production so `req.ip` and rate limiting
// resolve the real client address. In development the origin is hit directly,
// so trusting the proxy would let clients spoof `X-Forwarded-For`.
app.set("trust proxy", env.isProduction ? 1 : false);

app.disable("x-powered-by");

/* -------------------------------------------------------------------------- */
/*  Global middleware                                                          */
/* -------------------------------------------------------------------------- */

app.use(
  helmet({
    // The API is consumed cross-origin by the frontend.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(corsMiddleware);
app.use(jsonMiddleware);
app.use(rateLimitMiddleware);

/* -------------------------------------------------------------------------- */
/*  Routes                                                                     */
/* -------------------------------------------------------------------------- */

// Health check — no database required.
app.use("/api/v1", pingRoutes);

// Public URL shortening (frontend home page). The link limiter is applied on
// the create route itself so reads do not consume the link budget.
app.use(
  "/api/v1",
  databaseConnectionMiddleware,
  urlRoutes
);

// Authenticated external API (scripts, iPhone Shortcuts). The create route
// applies its own link limiter.
app.use(
  "/api/v1/api",
  databaseConnectionMiddleware,
  externalApiRoutes
);

// API-key management (all endpoints disabled until admin UI exists).
app.use("/api/v1/api-keys", apiKeyRoutes);

// Global stats counter.
app.use("/api/v1", databaseConnectionMiddleware, statsRoutes);

// Short-code redirect: `/<code>` → original (cleaned) destination.
app.use("/", redirectRoutes);

/* -------------------------------------------------------------------------- */
/*  Centralised 404 + error handling                                           */
/* -------------------------------------------------------------------------- */

app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: "Not found",
  });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    // Let Express close the connection if a response is already streaming.
    if (res.headersSent) {
      return _next(error);
    }

    const candidate =
      typeof error === "object" &&
      error !== null &&
      "status" in error
        ? (error as { status?: unknown }).status
        : undefined;

    const status =
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= 400 &&
      candidate <= 599
        ? candidate
        : 500;

    if (status >= 500) {
      logError("UNHANDLED EXPRESS ERROR", error, {
        operation: "errorHandler",
      });
    }

    return res.status(status).json({
      success: false,
      message:
        status >= 500
          ? getPublicErrorMessage(
              error,
              "Internal server error"
            )
          : status === 413
            ? "Request body too large"
            : "Invalid request",
    });
  }
);

export default app;