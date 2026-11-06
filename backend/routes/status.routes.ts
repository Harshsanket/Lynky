import { Router } from "express";
import {
  publicStatsController,
  statusController,
} from "../controller/status.controller.js";

const router = Router();

router.get("/status", statusController);
router.get("/stats", publicStatsController);

export default router;
