/**
 * Sysadmin API client. Admin routes live at the backend root (`/sysadmin/api`),
 * not under the public `/api/v1` prefix, and use a Mongo session cookie.
 */

const API_URL = import.meta.env.VITE_API_URL || "";
const API_ROOT = API_URL.replace(/\/api\/v1\/?$/, "");

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_ROOT}/sysadmin/api${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  let data;

  try {
    data = await response.json();
  } catch {
    // Empty error body.
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || `Admin request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
};

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
