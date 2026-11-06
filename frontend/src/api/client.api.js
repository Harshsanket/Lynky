/**
 * Shared fetch wrapper + error type for the Lynky backend API.
 *
 * Every `api/` module builds on this so error handling and JSON parsing are
 * consistent across the app.
 */

const API_URL = import.meta.env.VITE_API_URL;
const REQUEST_TIMEOUT_MS = 15_000;

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
 * Sets `Content-Type: application/json` only when a body is present (GETs with
 * no body should stay simple requests), applies a timeout, and resolves with
 * the parsed JSON body. Throws an `ApiError` when the response is not OK.
 */
export const api = async (endpoint, options = {}) => {
  if (!API_URL) {
    throw new Error(
      "VITE_API_URL is not configured. Set it to the backend API base URL.",
    );
  }

  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const abortFromCaller = () => controller.abort();

  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, {
      once: true,
    });
  }

  const headers = new Headers(options.headers);

  if (
    options.body !== undefined &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    let data;

    try {
      data = await response.json();
    } catch {
      // Response had no JSON body.
    }

    if (!response.ok) {
      if (
        response.status >= 500 &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(new CustomEvent("lynky:api-error"));
      }

      throw new ApiError(response.status, data);
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        timedOut
          ? "Request timed out. Please try again."
          : "Request cancelled.",
        { cause: error },
      );
    }

    if (typeof window !== "undefined" && !(error instanceof ApiError)) {
      window.dispatchEvent(new CustomEvent("lynky:api-error"));
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
};
