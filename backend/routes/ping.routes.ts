import { Router } from "express";
import { pingController } from "../controller/ping.controller.js";

const router = Router();

router.get("/ping", pingController);
// QStash keep-warm schedules publish POST by default.
router.post("/ping", pingController);

export default router;