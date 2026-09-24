import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle, Building } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
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

      // Clear previous cached fleet vehicles
      clearVehicles();

      // Save token and user details in store and localStorage
      setAuth(data.token, data.user);

      // Navigate to live tracking
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

  const selectDemoAccount = (orgUser: string, orgPass: string) => {
    setUsername(orgUser);
    setPassword(orgPass);
    doLogin(orgUser, orgPass);
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

        {/* Demo Organization Selector */}
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Building size={13} color="var(--cyan-accent)" />
            <span>Select Demo Organization to Test Isolation</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => selectDemoAccount('admin', 'password')}
              style={{
                background: username === 'admin' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: username === 'admin' ? '1px solid var(--cyan-accent)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Allied Transport</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--cyan-accent)', marginTop: '2px' }}>
                312 Vehicles (Org 1)
              </div>
            </button>

            <button
              type="button"
              onClick={() => selectDemoAccount('eksc_admin', 'password')}
              style={{
                background: username === 'eksc_admin' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: username === 'eksc_admin' ? '1px solid var(--cyan-accent)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>EKSC Dubai</div>
              <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '2px' }}>
                5 Vehicles (Org 2)
              </div>
            </button>
          </div>
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
            style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.95rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating & Verifying Tenancy...' : 'Sign In to Portal'}
            <ArrowRight size={18} />
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
