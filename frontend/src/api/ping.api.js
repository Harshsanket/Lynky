import { api } from "./client.api";

export const checkBackendHealth = async () => {
  try {
    const data = await api("/ping");

    return {
      online: true,
      data,
    };
  } catch (error) {
    console.error("Backend health check failed:", error);

    return {
      online: false,
      data: null,
    };
  }
};