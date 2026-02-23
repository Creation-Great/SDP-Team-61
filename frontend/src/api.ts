import { API_BASE_URL } from './config.ts';

const DEFAULT_DEV_HEADERS: Record<string, string> = {
  'x-user-id':
    (import.meta.env.VITE_DEV_USER_ID as string | undefined) ||
    '00000000-0000-0000-0000-0000000000a1',
  'x-user-role': ((import.meta.env.VITE_DEV_ROLE as string | undefined) || 'student').toLowerCase(),
  'x-user-course': (import.meta.env.VITE_DEV_COURSE as string | undefined) || 'CSE4939W',
  'x-user-group': (import.meta.env.VITE_DEV_GROUP as string | undefined) || 'G1',
};

export function getDevHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    ...DEFAULT_DEV_HEADERS,
    ...overrides,
  };
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers((options.headers as HeadersInit | undefined) || {});
  const devHeaders = getDevHeaders();

  Object.entries(devHeaders).forEach(([key, value]) => {
    if (value && !headers.has(key)) {
      headers.set(key, value);
    }
  });

  const method = ((options.method || 'GET') as string).toUpperCase();
  const isFormData = options.body instanceof FormData;

  if (method !== 'GET' && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'omit',
  });

  return response;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const detail =
      typeof payload === 'string'
        ? payload
        : (payload as Record<string, unknown>)?.detail ||
          (payload as Record<string, unknown>)?.error ||
          'Request failed';
    throw new ApiError(String(detail), res.status, payload);
  }

  return payload as T;
}

export const DEV_HEADERS = DEFAULT_DEV_HEADERS;
