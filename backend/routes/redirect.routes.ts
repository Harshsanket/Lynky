import { Router } from "express";
import { redirectToOriginalUrl } from "../controller/redirect.controller.js";

const router = Router();

// `GET /<code>` resolves a short link to its destination.
router.get("/:code", redirectToOriginalUrl);

export default router;