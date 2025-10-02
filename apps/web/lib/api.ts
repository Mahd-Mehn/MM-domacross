// Prefer explicit NEXT_PUBLIC_API_BASE_URL but gracefully fall back to legacy NEXT_PUBLIC_API_BASE
const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

import { getToken } from './token';

export function authHeader(): HeadersInit {
  const token = typeof window === 'undefined' ? null : getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
