import type { Request, Response } from "express";

/**
 * Health check endpoint (`GET /api/v1/ping`). Used by the frontend to show
 * whether the backend is reachable.
 */
export const pingController = (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();

  res.json({
    message: "pong ;)",
    timestamp,
  });
};