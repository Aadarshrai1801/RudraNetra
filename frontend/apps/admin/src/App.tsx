import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CompanyManagerPage } from './pages/CompanyManagerPage';
import { ExternalLink, ShieldCheck, ChevronDown, LogOut } from 'lucide-react';

const routeTitles: Record<string, string> = {
  '/companies': 'Organization & Tenant Registry',
};

const PageTitleManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const pageName = routeTitles[location.pathname];
    if (pageName) {
      document.title = `RudraNetra · ${pageName}`;
    } else {
      document.title = 'RudraNetra · SuperAdmin Console';
    }
  }, [location.pathname]);

  return null;
};

export const App: React.FC = () => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExit = () => {
    localStorage.removeItem('rudra_admin_token');
    localStorage.removeItem('rudra_auth_token');
    window.location.href = 'http://localhost:3000/login';
  };

  return (
    <BrowserRouter>
      <PageTitleManager />
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
        {/* Daylight SuperAdmin Header */}
        <header
          style={{
            height: 'var(--header-height)',
            borderBottom: '1px solid var(--border)',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-sm)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/* Brand & Console Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/RudraNetraLogo.png"
                alt="RudraNetra Logo"
                style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                RudraNetra
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid rgba(47, 111, 109, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={13} strokeWidth={2.5} />
                <span>SuperAdmin Platform</span>
              </span>
            </div>
          </div>

          {/* Client Console Switcher & User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Quick Switch to Fleet Dispatch Console */}
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                gap: '6px',
                textDecoration: 'none',
              }}
            >
              <span>Fleet Tracking Console</span>
              <ExternalLink size={13} />
            </a>

            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

            {/* Admin Profile Chip with Exit button appearing on clicking Admin */}
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="Superadmin account menu"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: isUserMenuOpen ? 'var(--bg-hover)' : 'transparent',
                  border: '1px solid',
                  borderColor: isUserMenuOpen ? 'var(--border)' : 'transparent',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'var(--accent-light)',
                    border: '1px solid rgba(47, 111, 109, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--accent)',
                    fontWeight: 700,
                  }}
                >
                  SA
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Platform Admin
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                    Root Administrator
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  color="var(--text-secondary)"
                  style={{
                    transform: isUserMenuOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    marginLeft: '2px',
                  }}
                />
              </button>

              {/* Exit button sized to the length of the word only */}
              {isUserMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: '0',
                    width: 'fit-content',
                    minWidth: 'auto',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '4px',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleExit();
                    }}
                    title="Sign out of SuperAdmin console"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: 'fit-content',
                      whiteSpace: 'nowrap',
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#dc2626',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.22)';
                    }}
                  >
                    <LogOut size={13} />
                    <span>Exit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/companies" element={<CompanyManagerPage />} />
            <Route path="*" element={<Navigate to="/companies" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
