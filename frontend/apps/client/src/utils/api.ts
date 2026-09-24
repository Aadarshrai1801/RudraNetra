import { useAuthStore } from '../store/authStore';

export const getApiHost = (): string => {
  return window.location.port !== '8080' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : '';
};

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const host = getApiHost();
  const token = useAuthStore.getState().token;
  const companyId = useAuthStore.getState().user?.company_id;

  const url = new URL(`${host}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
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

  return fetch(url.toString(), {
    ...options,
    headers,
  });
}
