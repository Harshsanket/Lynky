import { api } from "./client.api";

export const getApiKeyUsage = async (secretKey) => {
  return api("/api/stats/usage", {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
};
