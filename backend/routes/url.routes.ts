import { Router } from "express";
import { createShortUrlController } from "../controller/url.controller.js";
import { linkRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";

const router = Router();

// Public URL shortening used by the frontend home page.
router.post(
  "/urls",
  linkRateLimitMiddleware,
  createShortUrlController
);

export default router;
