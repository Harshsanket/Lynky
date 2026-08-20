import { Router } from "express";
import { createShortUrlController } from "../controller/url.controller.js";

const router = Router();

// Public URL shortening used by the frontend home page.
router.post("/urls", createShortUrlController);

export default router;