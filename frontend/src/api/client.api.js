/**
 * Shared fetch wrapper + error type for the Lynky backend API.
 *
 * Every `api/` module builds on this so error handling and JSON parsing are
 * consistent across the app.
 */

const API_URL = import.meta.env.VITE_API_URL;

/** Error raised for non-2xx responses, carrying status and response body. */
export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || `API error: ${status}`);
    this.status = status;
    this.data = data;
  }
}

/**
 * Perform an API request against `VITE_API_URL`.
 *
 * Sets `Content-Type: application/json` by default (override via
 * `options.headers`) and resolves with the parsed JSON body. Throws an
 * `ApiError` when the response is not OK.
 */
export const api = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let data;

  try {
    data = await response.json();
  } catch {
    // Response had no JSON body.
  }

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
};
