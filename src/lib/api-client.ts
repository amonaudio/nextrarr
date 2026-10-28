/**
 * Client-side API fetch wrapper.
 *
 * Centralizes:
 * - Content-Type: application/json header for POST/PUT
 * - res.ok check before res.json() (prevents "Unexpected token '<'" on HTML responses)
 * - Typed responses
 * - Consistent error handling
 *
 * Usage:
 *   const data = await apiFetch<MyType>('/api/settings');
 *   const result = await apiFetch<{status: string}>('/api/download-media/radarr/1', {
 *     method: 'POST',
 *     body: JSON.stringify({ url }),
 *   });
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };
  // Auto-add Content-Type for JSON bodies
  if (options?.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    // [0.8.2] Default to no-store so a refreshed media/artwork list can
    // never be served from the browser HTTP cache. Callers can still
    // override by passing their own `cache` option.
    res = await fetch(path, { cache: 'no-store', ...options, headers });
  } catch (e) {
    throw new ApiError('Errore di rete: ' + (e instanceof Error ? e.message : ''), 0);
  }

  if (res.status === 204) return null as T;

  const ct = res.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    // Server returned HTML (probably an error page or crash)
    let preview = '';
    try { preview = (await res.text()).slice(0, 100); } catch { /* ignore */ }
    throw new ApiError(
      `Risposta non JSON da ${path} (HTTP ${res.status}, Content-Type: ${ct || 'vuoto'}). Anteprima: ${preview}`,
      res.status,
    );
  }

  const data = await res.json();
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Errore ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}
