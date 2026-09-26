import { useAuthStore } from '../store/authStore';

export const getApiHost = (): string => {
  return window.location.port !== '8080' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : '';
};

function clearSessionAndRedirectToLogin(): void {
  useAuthStore.getState().logout();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const host = getApiHost();
  const base = host || window.location.origin;
  const auth = useAuthStore.getState();
  const token = auth.token || localStorage.getItem('rudra_auth_token');
  const companyId = auth.user?.company_id;

  // There is no credential fallback: a session requires both a token and the
  // tenant (company_id) that was returned by the login endpoint.
  if (!token || companyId === undefined || companyId === null) {
    clearSessionAndRedirectToLogin();
    throw new Error('Unauthenticated: missing token or company. Redirecting to sign in.');
  }

  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = new URL(path, base);
  if (!url.searchParams.has('company_id')) {
    url.searchParams.set('company_id', String(companyId));
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers,
  });

  // Expired/invalid tokens are never silently renewed. Drop the stored session
  // and send the user back to the login screen.
  if (res.status === 401) {
    clearSessionAndRedirectToLogin();
  }

  return res;
}
