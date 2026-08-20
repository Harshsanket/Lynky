import { Router } from "express";
import { externalShortenController, readApiKeyUsage } from "../controller/api-key.controller.js";
import { apiKeyAuthMiddleware, apiKeyAuthOnlyMiddleware } from "../middleware/api-key-auth.middleware.js";

const router = Router();

// Authenticated shorten endpoint (quota enforced before creating the link).
router.post(
  "/urls",
  apiKeyAuthMiddleware,
  externalShortenController
);

// Read-only usage endpoint (auth only, no quota consumed).
router.get(
  "/stats/usage",
  apiKeyAuthOnlyMiddleware,
  readApiKeyUsage
);

export default router;
