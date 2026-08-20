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

    return callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],

  credentials: true,

  optionsSuccessStatus: 204,
});

