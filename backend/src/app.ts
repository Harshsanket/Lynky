import express from "express";
import { corsMiddleware } from "../middleware/cors.middleware.js";
import { jsonMiddleware } from "../middleware/json.middleware.js";
import { databaseConnectionMiddleware } from "../middleware/database.middleware.js";
import {
  rateLimitMiddleware,
  linkRateLimitMiddleware,
} from "../middleware/rate-limit.middleware.js";
import { env } from "./config/env.js";

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

/* -------------------------------------------------------------------------- */
/*  Global middleware                                                          */
/* -------------------------------------------------------------------------- */

app.use(corsMiddleware);
app.use(jsonMiddleware);
app.use(rateLimitMiddleware);

/* -------------------------------------------------------------------------- */
/*  Routes                                                                     */
/* -------------------------------------------------------------------------- */

// Health check — no database required.
app.use("/api/v1", pingRoutes);

// Public URL shortening (frontend home page) — stricter link rate limit.
app.use(
  "/api/v1",
  linkRateLimitMiddleware,
  databaseConnectionMiddleware,
  urlRoutes
);

// Authenticated external API (scripts, iPhone Shortcuts).
app.use(
  "/api/v1/api",
  databaseConnectionMiddleware,
  linkRateLimitMiddleware,
  externalApiRoutes
);

// API-key management (all endpoints disabled until admin UI exists).
app.use("/api/v1/api-keys", apiKeyRoutes);

// Global stats counter.
app.use("/api/v1", databaseConnectionMiddleware, statsRoutes);

// Short-code redirect: `/<code>` → original (cleaned) destination.
app.use("/", databaseConnectionMiddleware, redirectRoutes);

export default app;