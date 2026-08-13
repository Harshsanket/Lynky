import { Router } from "express";
import { createShortUrlController } from "../controller/url.controller.js";

const router = Router();

router.post("/urls", createShortUrlController);

export default router;