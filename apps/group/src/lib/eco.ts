import { getAccessToken } from '@/lib/auth';

/** Authenticated JSON client for the KiaDot department APIs. */
export async function eco<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as { message?: string }) : {};
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}
