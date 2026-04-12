// API client with automatic token refresh on 401 responses.

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.code = error.code;
    this.status = status;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const body = await res.json();
    const token = body.data.access_token;
    setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(path, { ...options, headers, credentials: 'include' });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(path, { ...options, headers, credentials: 'include' });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Request failed' } }));
    throw new ApiRequestError(res.status, body.error);
  }
  return res;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await rawFetch(path, options);
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return body.data as T;
}

// apiFetchEnvelope returns the entire response envelope so callers can access
// the sibling `pagination` field alongside `data`.
export async function apiFetchEnvelope<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await rawFetch(path, options);
  return (await res.json()) as T;
}
