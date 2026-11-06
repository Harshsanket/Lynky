/**
 * Status API — one cached public request for the server pill and link counter.
 */

import { api } from "./client.api";

export const fetchBackendStatus = async () => {
  const data = await api("/status");

  return {
    online: data?.online === true,
    totalLinks:
      typeof data?.totalLinks === "number" ? data.totalLinks : null,
  };
};
