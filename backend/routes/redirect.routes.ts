import { Router } from "express";
import { redirectToOriginalUrl } from "../controller/redirect.controller.js";

const router = Router();

router.get("/:code", redirectToOriginalUrl);

export default router;