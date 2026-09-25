import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Mail, Building2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface CompanyOption {
  id: number;
  name: string;
  code: string;
}

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyId, setCompanyId] = useState<number>(2); // Default to EKSC or 1
  const [companies, setCompanies] = useState<CompanyOption[]>([
    { id: 1, name: 'Allied Transport UAE (312 Vehicles)', code: 'COMP_1' },
    { id: 2, name: 'EKSC Logistics Dubai (5 Vehicles)', code: 'EKSC' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearVehicles = useVehicleStore((state) => state.clearVehicles);

  useEffect(() => {
    // Fetch available companies from backend
    const host =
      window.location.port !== '8080' && window.location.hostname === 'localhost'
        ? 'http://localhost:8080'
        : '';
    fetch(`${host}/api/v1/auth/companies`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setCompanies(json.data);
          setCompanyId(json.data[0].id);
        }
      })
      .catch((err) => console.warn('Could not load company list', err));
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const host =
        window.location.port !== '8080' && window.location.hostname === 'localhost'
          ? 'http://localhost:8080'
          : '';

      const res = await fetch(`${host}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          full_name: fullName,
          email,
          company_id: Number(companyId),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account.');
      }

      // Clear any prior cached vehicles
      clearVehicles();

      // Save token and user
      setAuth(data.token, data.user);

      // Redirect to live fleet view
      navigate('/live');
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
          top: '15%',
          left: '25%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 242, 254, 0.12) 0%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '25%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(2, 132, 199, 0.14) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Form Card */}
      <div
        className="glass-panel"
        style={{
          width: '460px',
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
              width: '60px',
              height: '60px',
              margin: '0 auto 12px auto',
              borderRadius: '14px',
              background: '#ffffff',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(249, 115, 22, 0.45)',
            }}
          >
            <img
              src="/RudraNetraLogo.png"
              alt="RudraNetra Logo"
              style={{ width: '48px', height: 'auto', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Create Fleet Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', marginTop: '4px' }}>
            Register your credentials under your organization
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              marginBottom: '18px',
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

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Organization Select */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Organization / Company
            </label>
            <div style={{ position: 'relative' }}>
              <Building2
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <select
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
                required
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#0f172a', color: '#fff' }}>
                    {c.name} {c.id === 1 ? '(312 Vehicles)' : c.id === 2 ? '(5 Vehicles)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              You will only view vehicles assigned to this organization.
            </span>
          </div>

          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Full Name
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Tariq Al-Mansoor"
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Username
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
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="e.g. tariq_dispatch"
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Work Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Work Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. tariq@eksc.ae"
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Password */}
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
                placeholder="Minimum 6 characters"
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Confirm Password
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.925rem', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--cyan-accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign In to Fleet Portal
            </Link>
          </p>
        </div>

        <div
          style={{
            marginTop: '22px',
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
            Strict Organization-Level Data Isolation (Multi-Tenant)
          </span>
        </div>
      </div>
    </div>
  );
};
