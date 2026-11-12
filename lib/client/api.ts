export class ApiError extends Error { constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; } }
/** Tiny fetch wrapper for our JSON API. Throws ApiError with the server's human-readable message. */
export async function api<T = unknown>(path: string, init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'POST', headers: { 'content-type': 'application/json' },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'Something went wrong. Please try again.', res.status);
  return data as T;
}
