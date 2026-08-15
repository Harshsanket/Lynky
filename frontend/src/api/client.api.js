const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || `API error: ${status}`);
    this.status = status;
    this.data = data;
  }
}

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
