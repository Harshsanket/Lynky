import cors from "cors";
import { env } from "../src/config/env.js";

/**
 * CORS policy: production only allows the configured frontend origin;
 * development allows the local Vite dev server. Requests without an Origin
 * header (curl, Postman, server-to-server) are always allowed.
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    // (curl, Postman, server-to-server requests, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Reject by omitting the CORS headers rather than throwing. Throwing
    // would turn a browser-policy decision into a 500 error response.
    return callback(null, false);
  },

  methods: ["GET", "POST", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "X-CSRF-Token",
  ],
  exposedHeaders: [
    "X-Request-Id",
    "Retry-After",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],

  // Sysadmin sessions use a cookie; the origin allowlist above is the boundary.
  credentials: true,

  optionsSuccessStatus: 204,
});

