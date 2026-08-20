import { env } from "../src/config/env.js";

/**
 * Build the public short URL for a code, e.g. `https://host/{code}`.
 */
export const getPublicUrl = (
  code: string
): string => {
  return `${env.PUBLIC_URL.replace(/\/$/, "")}/${code}`;
};