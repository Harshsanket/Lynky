import { rateLimit } from "express-rate-limit";

export const createUrlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many URLs created. Please try again later.",
  },
});