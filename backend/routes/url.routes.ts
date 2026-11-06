import { Router } from "express";
import { createShortUrlController } from "../controller/url.controller.js";
import { linkRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { botIdMiddleware } from "../middleware/botid.middleware.js";

const router = Router();

// Public URL shortening used by the frontend home page.
router.post(
  "/urls",
  botIdMiddleware,
  linkRateLimitMiddleware,
  createShortUrlController
);

export default router;
