const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function apiPath(path) {
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/api/") ? path.slice(4) : path;
  return `${API_BASE}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

function readStoredToken() {
  try {
    return localStorage.getItem("pl_token") || "";
  } catch {
    return "";
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem("pl_token", token);
    else localStorage.removeItem("pl_token");
  } catch {
    // ignore unavailable localStorage
  }
}

export function getStoredToken() {
  return readStoredToken();
}

async function readError(response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    return JSON.stringify(data);
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  const token = readStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(apiPath(path), {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = new Error(await readError(response));
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function apiGet(path) {
  const response = await apiFetch(path);
  return response.json();
}

export async function apiPost(path, body = {}) {
  const response = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function apiPut(path, body = {}) {
  const response = await apiFetch(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return response.json();
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}
