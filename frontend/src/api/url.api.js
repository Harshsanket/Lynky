/**
 * URL API — shorten a URL (public endpoint used by the home page).
 */

import { api } from "./client.api";

export const createShortUrl = async (url) => {
  return api("/urls", {
    method: "POST",
    body: JSON.stringify({
      url,
    }),
  });
};