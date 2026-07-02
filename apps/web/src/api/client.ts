// SPDX-License-Identifier: AGPL-3.0-only

import { ApiError } from './types';

export const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

let onUnauthorized: (() => void) | null = null;
/** Register a callback fired whenever any API call returns 401 (session expired/revoked). */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/** Typed fetch against the API: sends the session cookie, parses JSON, throws ApiError on failure. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers ?? {}),
      ...(init.body != null ? { 'content-type': 'application/json' } : {}),
    },
  });

  if (!res.ok) {
    let title = res.statusText;
    let detail: string | undefined;
    try {
      const body = (await res.json()) as { title?: string; detail?: string };
      title = body.title ?? title;
      detail = body.detail;
    } catch {
      // non-JSON error body; keep statusText
    }
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, title, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** POST multipart form data — the browser sets the multipart boundary (do NOT set content-type). */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', credentials: 'include', body: form });
  if (!res.ok) {
    let title = res.statusText;
    let detail: string | undefined;
    try {
      const b = (await res.json()) as { title?: string; detail?: string };
      title = b.title ?? title;
      detail = b.detail;
    } catch {
      // non-JSON error body; keep statusText
    }
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, title, detail);
  }
  return (await res.json()) as T;
}

/** Fetch a file with credentials and trigger a browser download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
