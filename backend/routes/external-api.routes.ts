import { Router } from "express";
import { externalShortenController, readApiKeyUsage } from "../controller/api-key.controller.js";
import { apiKeyAuthMiddleware, apiKeyAuthOnlyMiddleware } from "../middleware/api-key-auth.middleware.js";
import {
  linkRateLimitMiddleware,
  usageRateLimitMiddleware,
} from "../middleware/rate-limit.middleware.js";

const router = Router();

// Authenticated shorten endpoint (quota enforced before creating the link).
// Rate-limit before auth so invalid keys cannot be brute-forced cheaply.
router.post(
  "/urls",
  linkRateLimitMiddleware,
  apiKeyAuthMiddleware,
  externalShortenController
);

// Read-only usage endpoint (auth only, no quota consumed).
router.get(
  "/stats/usage",
  usageRateLimitMiddleware,
  apiKeyAuthOnlyMiddleware,
  readApiKeyUsage
);

export default router;
