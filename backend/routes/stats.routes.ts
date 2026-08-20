import { Router } from "express";

import { readTotalLinks } from "../controller/stats.controller.js";

const router = Router();

router.get("/stats/links", readTotalLinks);

export default router;