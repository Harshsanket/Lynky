import { Router } from "express";
import { externalShortenController, readApiKeyUsage } from "../controller/api-key.controller.js";
import { apiKeyAuthMiddleware, apiKeyAuthOnlyMiddleware } from "../middleware/api-key-auth.middleware.js";

const router = Router();

router.post(
  "/urls",
  apiKeyAuthMiddleware,
  externalShortenController
);

router.get(
  "/stats/usage",
  apiKeyAuthOnlyMiddleware,
  readApiKeyUsage
);

export default router;
