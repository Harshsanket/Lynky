import { api } from "./client.api";

export const getTotalLinks = async () => {
  const data = await api("/stats/links");

  return data?.totalLinks;
};

export const incrementTotalLinks = async () => {
  const data = await api("/stats/links/increment", {
    method: "POST",
  });

  return data?.totalLinks;
};