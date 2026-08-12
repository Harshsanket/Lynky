import cors from "cors";


const isProduction = process.env.NODE_ENV === "PRODUCTION";

const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ["http://localhost:5173"];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    // (curl, Postman, server-to-server requests, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],

  credentials: true,

  optionsSuccessStatus: 204,
});

