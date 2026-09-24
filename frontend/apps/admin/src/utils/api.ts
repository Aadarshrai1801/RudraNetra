export async function getAdminToken(): Promise<string> {
  const existing = localStorage.getItem('rudra_admin_token') || localStorage.getItem('rudra_auth_token');
  if (existing) {
    return existing;
  }

  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });

    if (res.ok) {
      const data = await res.json();
      const token = data.access_token || data.data?.tokens?.access_token || '';
      if (token) {
        localStorage.setItem('rudra_admin_token', token);
        return token;
      }
    }
  } catch (err) {
    console.error('Failed to auto-authenticate admin:', err);
  }
  return '';
}

export async function fetchWithAdminAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = await getAdminToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url, { ...options, headers });

  // If 401, re-login and retry once
  if (res.status === 401) {
    localStorage.removeItem('rudra_admin_token');
    token = await getAdminToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  return res;
}
