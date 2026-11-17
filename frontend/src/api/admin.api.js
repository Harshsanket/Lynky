/**
 * Sysadmin API client. Admin routes live at the backend root (`/sysadmin/api`),
 * not under the public `/api/v1` prefix, and use a Mongo session cookie.
 */

import { apiAt } from "./client.api";

const API_URL = import.meta.env.VITE_API_URL || "";
const API_ROOT = API_URL.replace(/\/api\/v1\/?$/, "");
const adminRequest = apiAt(`${API_ROOT}/sysadmin/api`);
const request = (path, options = {}) =>
  adminRequest(path, { credentials: "include", ...options });

export const getAdminSession = () => request("/session");

export const adminLogin = (username, password) =>
  request("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const adminLogout = (csrfToken) =>
  request("/logout", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });

export const getAdminMetrics = () => request("/metrics");

export const getAdminErrors = (limit = 100) =>
  request(`/errors?limit=${limit}`);

export const getAdminBenchmarkReport = () =>
  request("/benchmark-report");

export const getAdminApiKeys = () => request("/api-keys");

export const createApiKey = (csrfToken, label) =>
  request("/api-keys", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ label }),
  });

export const resetApiKeyUsage = (csrfToken, id) =>
  request(`/api-keys/${id}/reset-usage`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });

export const setApiKeyStatus = (csrfToken, id, status) =>
  request(`/api-keys/${id}/${status === "disabled" ? "disable" : "enable"}`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });

export const deleteApiKey = (csrfToken, id) =>
  request(`/api-keys/${id}`, {
    method: "DELETE",
    headers: { "X-CSRF-Token": csrfToken },
  });
