/**
 * Stats API — global "links cleaned & shortened" counter.
 */

import { api } from "./client.api";

export const getTotalLinks = async () => {
  const data = await api("/stats/links");

  return data?.totalLinks;
};