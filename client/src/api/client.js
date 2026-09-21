// api/client.js — the ONLY place the backend base URL is read from.
// Every resource file in src/api/ builds its requests through this module,
// and every page calls a resource file — never fetch()/axios() directly.

// Base URL comes from VITE_API_URL only. Falls back to the same local
// backend the (untouched) auth pages already point at, so this layer talks
// to the same server during local development.
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_TIMEOUT_MS = 15000;

const STATUS_MESSAGES = {
  400: "That request couldn't be processed. Please check the details and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find that item — it may have been removed.",
  409: "This conflicts with an existing record.",
  422: "Some of the information provided isn't valid.",
  500: "Something went wrong on our end. Please try again in a moment.",
};

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = network error, 408 = client-side timeout
    this.body = body;
  }
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Builds `${API_BASE}${path}?query`, skipping empty/undefined query values —
// used by list() calls so pagination/search/sort/filter params are optional.
export function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
}

// Core request function. Resolves with the parsed JSON body on success (2xx).
// Throws ApiError on any non-2xx response, network failure, or timeout, with
// a user-friendly `.message` a page can show directly.
export async function request(path, { method = "GET", body, params, headers, signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  // Let a caller-supplied signal cancel the request too (e.g. component unmount).
  if (signal) signal.addEventListener("abort", () => controller.abort());

  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new ApiError(408, "The request took too long and timed out. Please try again.");
    }
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  clearTimeout(timeout);

  let json = null;
  try { json = await res.json(); } catch { /* empty/non-JSON body is fine for 204s etc. */ }

  if (!res.ok) {
    const backendMessage = json?.message || json?.error;
    throw new ApiError(res.status, backendMessage || STATUS_MESSAGES[res.status] || `Request failed (${res.status}).`, json);
  }

  return json;
}

export const apiGet    = (path, params, opts) => request(path, { method: "GET", params, ...opts });
export const apiPost   = (path, body, opts)   => request(path, { method: "POST", body, ...opts });
export const apiPut    = (path, body, opts)   => request(path, { method: "PUT", body, ...opts });
export const apiPatch  = (path, body, opts)   => request(path, { method: "PATCH", body, ...opts });
export const apiDelete = (path, opts)         => request(path, { method: "DELETE", ...opts });
