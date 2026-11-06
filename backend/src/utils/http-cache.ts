import type { Response } from "express";

const CDN_HEADER = "Vercel-CDN-Cache-Control";

export const setStatusCacheHeaders = (res: Response): void => {
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader(
    CDN_HEADER,
    "public, s-maxage=5, stale-while-revalidate=10"
  );
};

export const setStatsCacheHeaders = (res: Response): void => {
  res.setHeader("Cache-Control", "public, max-age=30");
  res.setHeader(
    CDN_HEADER,
    "public, s-maxage=30, stale-while-revalidate=60"
  );
};

export const setShortLinkNotFoundHeaders = (res: Response): void => {
  res.setHeader("Cache-Control", "public, max-age=30");
  res.setHeader(
    CDN_HEADER,
    "public, s-maxage=30, stale-while-revalidate=60"
  );
  res.setHeader("Vary", "Accept");
};

export const setSuccessfulRedirectHeaders = (res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(CDN_HEADER, "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
};
