import { Router } from "express";
import { apiKeyManagementDisabled } from "../controller/api-key-management.controller.js";

const router = Router();

// All management routes stay disabled until login/signup and
// admin approval are implemented.
router.post("/request", apiKeyManagementDisabled);
router.post("/", apiKeyManagementDisabled);
router.get("/", apiKeyManagementDisabled);
router.delete("/:id", apiKeyManagementDisabled);

export default router;
