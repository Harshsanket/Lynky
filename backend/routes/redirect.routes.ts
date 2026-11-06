import { Router } from "express";
import { redirectToOriginalUrl } from "../controller/redirect.controller.js";
import { validateShortCode } from "../middleware/redirect-code.middleware.js";

const router = Router();

// `GET /<code>` resolves a short link to its destination. Validate the code
// before touching Redis or the database so scanner traffic stays cheap. The
// controller connects to MongoDB only on a cache/negative-cache miss, which
// keeps hot redirects database-free.
router.get("/:code", validateShortCode, redirectToOriginalUrl);

export default router;
