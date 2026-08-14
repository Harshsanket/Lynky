import { isTrackingParameter } from "./tracking-checker.service.js";

export const cleanUrl = (
  inputUrl: string
): string => {
  const url = new URL(inputUrl.trim());

  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParameter(key)) {
      url.searchParams.delete(key);
    }
  }

  // Normalize standard ports
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  // Keep fragments because they may be functional:
  // https://example.com/docs#installation

  return url.toString();
};