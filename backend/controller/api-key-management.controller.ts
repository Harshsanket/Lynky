import type { Request, Response } from "express";

export const apiKeyManagementDisabled = (
  _req: Request,
  res: Response
) => {
  return res.status(503).json({
    success: false,
    message:
      "API key management is not available yet. ",
  });
};
