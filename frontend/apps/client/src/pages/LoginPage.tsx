import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearVehicles = useVehicleStore((state) => state.clearVehicles);

  const doLogin = async (userToAuth: string, passToAuth: string) => {
    setLoading(true);
    setError(null);
    try {
      const host =
        window.location.port !== '8080' && window.location.hostname === 'localhost'
          ? 'http://localhost:8080'
          : '';

      const res = await fetch(`${host}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userToAuth, password: passToAuth }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials.');
      }

      // If user is superadmin, direct them straight to the SuperAdmin Console!
      if (data.user?.role === 'superadmin') {
        localStorage.setItem('rudra_superadmin_token', data.token);
        localStorage.setItem('rudra_superadmin_user', JSON.stringify(data.user));
        localStorage.setItem('rudra_admin_token', data.token);
        window.location.href = 'http://localhost:3001';
        return;
      }

      // Organizational admin or user:
      // Strip any superadmin tokens so organizational accounts cannot access the SuperAdmin Console
      localStorage.removeItem('rudra_superadmin_token');
      localStorage.removeItem('rudra_superadmin_user');
      localStorage.removeItem('rudra_admin_token');

      // Clear previous cached fleet vehicles
      clearVehicles();

      // Save token and user details in store and localStorage for client portal
      setAuth(data.token, data.user);
      localStorage.setItem('rudra_auth_token', data.token);

      // Navigate to live tracking for their organization
      navigate('/live');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(username, password);
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
        overflowY: 'auto',
        padding: '30px 20px',
      }}
    >
      {/* Background glow effects */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '30%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 242, 254, 0.12) 0%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          right: '30%',
          width: '520px',
          height: '520px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(2, 132, 199, 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Login Box */}
      <div
        className="glass-panel"
        style={{
          width: '450px',
          maxWidth: '100%',
          padding: '36px',
          zIndex: 10,
          border: '1px solid var(--border-accent)',
          boxShadow: 'var(--shadow-cyan)',
          borderRadius: '16px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px auto',
              borderRadius: '16px',
              background: '#ffffff',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(249, 115, 22, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
            }}
          >
            <img
              src="/RudraNetraLogo.png"
              alt="RudraNetra Logo"
              style={{ width: '52px', height: 'auto', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>RudraNetra</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Enterprise Multi-Tenant GPS Telematics
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.95rem', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Authenticating & Verifying Tenancy...' : 'Sign In to Portal'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Need to register a new company or user?{' '}
            <Link to="/signup" style={{ color: 'var(--cyan-accent)', fontWeight: 600, textDecoration: 'none' }}>
              Create Account
            </Link>
          </p>
        </div>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={16} color="var(--cyan-accent)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            JWT Authenticated · Isolated Organization Data
          </span>
        </div>
      </div>
    </div>
  );
};
