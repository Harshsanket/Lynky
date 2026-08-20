/**
 * Usage API — read an API key's monthly usage (authenticated).
 */

import { api } from "./client.api";

export const getApiKeyUsage = async (secretKey) => {
  return api("/api/stats/usage", {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
};
