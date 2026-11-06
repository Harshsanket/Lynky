import { Router } from "express";
import {
  healthController,
  readyController,
} from "../controller/health.controller.js";

const router = Router();

router.get(["/health", "/api/v1/health"], healthController);
router.get(["/ready", "/api/v1/ready"], readyController);

export default router;
