import { Router } from "express";

import {
  readTotalLinks,
  increaseTotalLinks,
} from "../controller/stats.controller.js";

const router = Router();

router.get("/stats/links", readTotalLinks);

router.post("/stats/links/increment", increaseTotalLinks);

export default router;