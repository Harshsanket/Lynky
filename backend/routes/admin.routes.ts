import { Router } from "express";
import {
  adminApiKeysController,
  adminBenchmarkReportController,
  adminCreateApiKeyController,
  adminDisableApiKeyController,
  adminEnableApiKeyController,
  adminErrorsController,
  adminLoginController,
  adminLogoutController,
  adminMetricsController,
  adminResetApiKeyUsageController,
  adminSessionController,
} from "../controller/admin.controller.js";
import { adminLoginRateLimitMiddleware } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.post(
  "/login",
  adminLoginRateLimitMiddleware,
  adminLoginController
);
router.post("/logout", adminLogoutController);
router.get("/session", adminSessionController);
router.get("/metrics", adminMetricsController);
router.get("/errors", adminErrorsController);
router.get("/benchmark-report", adminBenchmarkReportController);
router.get("/api-keys", adminApiKeysController);
router.post("/api-keys", adminCreateApiKeyController);
router.post(
  "/api-keys/:id/reset-usage",
  adminResetApiKeyUsageController
);
router.post("/api-keys/:id/disable", adminDisableApiKeyController);
router.post("/api-keys/:id/enable", adminEnableApiKeyController);

export default router;
