import { api } from "./client.api";

export const createShortUrl = async (url) => {
  return api("/urls", {
    method: "POST",
    body: JSON.stringify({
      url,
    }),
  });
};