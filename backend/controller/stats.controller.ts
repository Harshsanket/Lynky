import type { Request, Response } from "express";
import {
  getTotalLinks,
  incrementTotalLinks,
} from "../service/stats.service.js";

export const readTotalLinks = async (req: Request,
  res: Response) => {
  try {
    const totalLinks = await getTotalLinks();

    return res.status(200).json({
      totalLinks,
    });
  } catch (error) {
    console.error("Failed to read total links:", error);

    return res.status(500).json({
      message: "Unable to read stats",
    });
  }
};

export const increaseTotalLinks = async (req: Request,
  res: Response) => {
  try {
    const totalLinks = await incrementTotalLinks();

    return res.status(200).json({
      totalLinks,
    });
  } catch (error) {
    console.error("Failed to increment total links:", error);

    return res.status(500).json({
      message: "Unable to update stats",
    });
  }
};