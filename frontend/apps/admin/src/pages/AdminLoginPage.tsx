import React, { useState } from 'react';
import { Lock, User, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface AdminLoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials.');
      }

      const token: string = data.token || data.access_token || '';
      if (!token) {
        throw new Error('Authentication response did not include an access token.');
      }

      // STRICT ROLE VALIDATION: Organizational admins or regular users are strictly forbidden!
      if (data.user?.role !== 'superadmin') {
        throw new Error(
          `Access Denied: Account '${data.user?.username || username}' is an Organizational account (${data.user?.company_name || 'Tenant'}). Organizational accounts cannot access the SuperAdmin Console.`
        );
      }

      // Valid SuperAdmin authenticated
      localStorage.setItem('rudra_superadmin_token', token);
      localStorage.setItem('rudra_superadmin_user', JSON.stringify(data.user));
      localStorage.setItem('rudra_admin_token', token);

      onLoginSuccess(data.user, token);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-page)',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-card)',
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/RudraNetraLogo.png"
              alt="RudraNetra Logo"
              style={{ width: '42px', height: 'auto', objectFit: 'contain' }}
            />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            RudraNetra SuperAdmin
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Restricted Infrastructure & Tenant Operations
          </p>
          <div
            style={{
              display: 'inline-block',
              marginTop: '10px',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              border: '1px solid rgba(47, 111, 109, 0.25)',
            }}
          >
            Authorized SuperAdmin Access Only
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--alert-bg)',
              border: '1px solid var(--alert-border)',
              color: 'var(--alert)',
              fontSize: '0.84rem',
              lineHeight: 1.45,
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              SuperAdmin Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                color="var(--text-tertiary)"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter superadmin username"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                color="var(--text-tertiary)"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 16px',
              fontSize: '0.9rem',
              fontWeight: 700,
              justifyContent: 'center',
              marginTop: '4px',
            }}
          >
            {loading ? 'Verifying SuperAdmin Privileges...' : 'Sign In to SuperAdmin Console'}
          </button>
        </form>

        {/* Footer Info */}
        <div
          style={{
            marginTop: '26px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.78rem',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={13} color="var(--accent)" />
          <span>Role-Based Multi-Tenant Isolation Enforced</span>
        </div>
      </div>
    </div>
  );
};
