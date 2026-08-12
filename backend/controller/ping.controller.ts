import type { Request, Response } from "express";

export const pingController = (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip;

  res.json({
    message: "pong ;)",
    timestamp,
    ip,
  });
};