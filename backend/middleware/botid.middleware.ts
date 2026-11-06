import type { NextFunction, Request, Response } from "express";
import { logWarn } from "../service/logger.js";
import { markRequestMetric } from "../service/metrics.service.js";

type BotCheck = (options: {
  advancedOptions: { checkLevel: "basic" };
}) => Promise<{ isBot: boolean }>;

const defaultCheck: BotCheck = async (options) => {
  const { checkBotId } = await import("botid/server");

  return checkBotId(options);
};

export const createBotIdMiddleware = (check: BotCheck = defaultCheck) => {
  /**
   * Vercel BotID basic check for the two high-value routes. Local development
   * and any verification failure fail open: availability wins over a bot check
   * that cannot run outside Vercel. Deep Analysis is intentionally not used.
   */
  return async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await check({
        advancedOptions: { checkLevel: "basic" },
      });

      if (result.isBot) {
        markRequestMetric(res, "botBlocks");

        res.status(403).json({
          success: false,
          message: "Automated requests are not allowed.",
        });

        return;
      }

      next();
    } catch (error) {
      logWarn("botid_error", {
        errorCode: "botid_error",
        reason: (error as Error)?.name ?? "unknown",
      });

      next();
    }
  };
};

export const botIdMiddleware = createBotIdMiddleware();
