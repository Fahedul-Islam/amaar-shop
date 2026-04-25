let accessToken: string | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }

// On the server (Node), relative URLs like "/api/..." can't be fetched — Next.js
// won't apply the rewrite because we're not going through the Next server. Use
// BACKEND_URL (set in docker-compose to http://backend:8080) to reach the API
// directly. In the browser, return "" so paths stay relative and the Next.js
// rewrite handles routing.
function resolveURL(path: string): string {
  if (typeof window !== 'undefined') return path;
  const base = process.env.BACKEND_URL || 'http://localhost:8080';
  return path.startsWith('http') ? path : `${base}${path}`;
}

interface ApiError { code: string; message: string }

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
    const res = await fetch(resolveURL('/api/auth/refresh'), { method: 'POST', credentials: 'include' });
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
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const url = resolveURL(path);
  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, credentials: 'include' });
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

export async function apiFetchEnvelope<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await rawFetch(path, options);
  return (await res.json()) as T;
}

export async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(resolveURL(path), { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Request failed' } }));
    throw new ApiRequestError(res.status, body.error);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return body.data as T;
}

export async function publicFetchEnvelope<T>(path: string): Promise<T> {
  const res = await fetch(resolveURL(path), { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Request failed' } }));
    throw new ApiRequestError(res.status, body.error);
  }
  return (await res.json()) as T;
}
