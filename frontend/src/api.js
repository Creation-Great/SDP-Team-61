import { API_BASE_URL } from "./config.js";

const DEFAULT_DEV_HEADERS = {
  "x-user-id":
    import.meta.env.VITE_DEV_USER_ID ||
    "00000000-0000-0000-0000-0000000000a1",
  "x-user-role": (import.meta.env.VITE_DEV_ROLE || "student").toLowerCase(),
  "x-user-course": import.meta.env.VITE_DEV_COURSE || "CSE4939W",
  "x-user-group": import.meta.env.VITE_DEV_GROUP || "G1",
};

export function getDevHeaders(overrides = {}) {
  return {
    ...DEFAULT_DEV_HEADERS,
    ...overrides,
  };
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const devHeaders = getDevHeaders();

  Object.entries(devHeaders).forEach(([key, value]) => {
    if (value && !headers.has(key)) {
      headers.set(key, value);
    }
  });

  const method = (options.method || "GET").toUpperCase();
  const isFormData = options.body instanceof FormData;

  if (method !== "GET" && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "omit",
  });

  return response;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.detail || payload?.error || "Request failed";
    const error = new Error(detail);
    error.status = res.status;
    error.body = payload;
    throw error;
  }

  return payload;
}

export const DEV_HEADERS = DEFAULT_DEV_HEADERS;

