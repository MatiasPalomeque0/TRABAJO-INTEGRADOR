import { API_URL, REQUEST_TIMEOUT_MS } from '../constants/config';
import { getSession, saveTokens } from './storage';

export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const session = await getSession();
      if (!session) return false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }), signal: controller.signal });
        if (!response.ok) return false;
        const json = await response.json() as { data: { accessToken: string; refreshToken: string } };
        await saveTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      } catch { return false; } finally { clearTimeout(timeout); }
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const session = await getSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    if (response.status === 401 && retry && !path.includes('/auth/refresh')) {
      if (await refreshSession()) return apiRequest<T>(path, options, false);
    }
    const body = response.status === 204 ? null : await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string; details?: unknown } } | null;
    if (!response.ok) throw new ApiError(response.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? 'No se pudo completar la solicitud.', body?.error?.details);
    return (body?.data ?? body) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(408, 'TIMEOUT', 'La solicitud tardó demasiado.');
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Revisá tu conexión.');
  } finally { clearTimeout(timeout); }
}

export function query(params: Record<string, string | number | undefined>) { const search = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)); }); const result = search.toString(); return result ? `?${result}` : ''; }

