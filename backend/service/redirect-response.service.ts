import type { Request, Response } from "express";
import { env } from "../src/config/env.js";
import {
  setShortLinkNotFoundHeaders,
  setSuccessfulRedirectHeaders,
} from "../src/utils/http-cache.js";

const wantsHtml = (req: Request): boolean => {
  const accept = req.headers.accept ?? "";

  return (
    accept.includes("text/html") &&
    !accept.includes("application/json")
  );
};

const frontendNotFoundUrl = (): string => {
  const base = env.FRONTEND_URL ?? env.PUBLIC_URL;

  return `${base.replace(/\/$/, "")}/not-found`;
};

/**
 * A 404/410 for a browser is a cacheable 302 to the frontend NotFound page;
 * API clients keep the existing JSON error. Cached responses must never set a
 * cookie or differ on anything except `Accept`.
 */
export const sendShortLinkNotFound = (
  req: Request,
  res: Response
): void => {
  setShortLinkNotFoundHeaders(res);

  if (wantsHtml(req)) {
    res.redirect(302, frontendNotFoundUrl());
    return;
  }

  res.status(404).json({
    success: false,
    message: "Short URL not found or expired",
  });
};

export const sendShortLinkGone = (
  req: Request,
  res: Response
): void => {
  setShortLinkNotFoundHeaders(res);

  if (wantsHtml(req)) {
    res.redirect(302, frontendNotFoundUrl());
    return;
  }

  res.status(410).json({
    success: false,
    message: "This short URL is no longer available",
  });
};

export const sendSuccessfulRedirect = (
  res: Response,
  originalUrl: string
): void => {
  setSuccessfulRedirectHeaders(res);

  res.redirect(302, originalUrl);
};
