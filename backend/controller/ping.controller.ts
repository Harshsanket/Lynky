import type { Request, Response } from "express";

/**
 * Health check endpoint (`GET /api/v1/ping`). Used by the frontend to show
 * whether the backend is reachable.
 */
export const pingController = (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip;

  res.json({
    message: "pong ;)",
    timestamp,
    ip,
  });
};