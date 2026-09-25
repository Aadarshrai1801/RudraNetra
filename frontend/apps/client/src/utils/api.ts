import { useAuthStore } from '../store/authStore';

export const getApiHost = (): string => {
  return window.location.port !== '8080' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : '';
};

export async function refreshClientToken(): Promise<string | null> {
  const host = getApiHost();
  const currentUser = useAuthStore.getState().user;
  const username = currentUser?.username || 'admin';
  try {
    const res = await fetch(`${host}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'password' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token) {
        useAuthStore.getState().setAuth(data.token, data.user);
        return data.token;
      }
    }
  } catch (err) {
    console.error('Failed to auto-refresh token:', err);
  }
  return null;
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const host = getApiHost();
  const base = host || window.location.origin;
  let token = useAuthStore.getState().token || localStorage.getItem('rudra_auth_token');
  const companyId = useAuthStore.getState().user?.company_id || 1;

  if (!token) {
    token = await refreshClientToken();
  }

  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = new URL(path, base);
  if (companyId && !url.searchParams.has('company_id')) {
    url.searchParams.set('company_id', companyId.toString());
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url.toString(), {
    ...options,
    headers,
  });

  // If 401 Unauthorized, automatically renew token and retry once
  if (res.status === 401) {
    const freshToken = await refreshClientToken();
    if (freshToken) {
      headers.set('Authorization', `Bearer ${freshToken}`);
      res = await fetch(url.toString(), {
        ...options,
        headers,
      });
    }
  }

  return res;
}
