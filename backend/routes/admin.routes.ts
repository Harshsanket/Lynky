import { Router } from "express";
import {
  adminBenchmarkReportController,
  adminErrorsController,
  adminLoginController,
  adminLogoutController,
  adminMetricsController,
  adminSessionController,
} from "../controller/admin.controller.js";

const router = Router();

router.post("/login", adminLoginController);
router.post("/logout", adminLogoutController);
router.get("/session", adminSessionController);
router.get("/metrics", adminMetricsController);
router.get("/errors", adminErrorsController);
router.get("/benchmark-report", adminBenchmarkReportController);

export default router;
