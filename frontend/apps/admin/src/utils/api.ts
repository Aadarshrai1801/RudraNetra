export function getSuperAdminToken(): string {
  return localStorage.getItem('rudra_superadmin_token') || localStorage.getItem('rudra_admin_token') || '';
}

export function getSuperAdminUser(): any {
  try {
    const raw = localStorage.getItem('rudra_superadmin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isSuperAdminAuthenticated(): boolean {
  const token = getSuperAdminToken();
  const user = getSuperAdminUser();
  return !!token && user?.role === 'superadmin';
}

export function clearSuperAdminAuth(): void {
  localStorage.removeItem('rudra_superadmin_token');
  localStorage.removeItem('rudra_superadmin_user');
  localStorage.removeItem('rudra_admin_token');
}

export async function fetchWithAdminAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getSuperAdminToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  // If 401 Unauthorized or 403 Forbidden, session is revoked
  if (res.status === 401 || res.status === 403) {
    clearSuperAdminAuth();
    window.dispatchEvent(new Event('rudra:superadmin:auth_expired'));
  }

  return res;
}
