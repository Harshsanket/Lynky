import type { Request, Response } from "express";

/**
 * Placeholder for API-key self-service endpoints.
 *
 * All management routes respond 503 until login/signup and admin approval
 * exist, so clients get an explicit "not available" instead of a 404.
 */
export const apiKeyManagementDisabled = (
  _req: Request,
  res: Response
) => {
  return res.status(503).json({
    success: false,
    message: "API key management is not available yet.",
  });
};
