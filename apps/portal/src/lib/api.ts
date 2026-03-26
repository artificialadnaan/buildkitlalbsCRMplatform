const API_BASE = import.meta.env.VITE_PORTAL_API_URL || '';

export async function portalApi<T>(path: string, options?: RequestInit): Promise<T> {
  const session = localStorage.getItem('portal_session');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'x-portal-session': session } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('portal_session');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}
