import { Router } from "express";
import { redirectToOriginalUrl } from "../controller/redirect.controller.js";
import { databaseConnectionMiddleware } from "../middleware/database.middleware.js";
import { validateShortCode } from "../middleware/redirect-code.middleware.js";

const router = Router();

// `GET /<code>` resolves a short link to its destination. Validate the code
// before touching the database so scanner traffic stays cheap.
router.get(
  "/:code",
  validateShortCode,
  databaseConnectionMiddleware,
  redirectToOriginalUrl
);

export default router;
