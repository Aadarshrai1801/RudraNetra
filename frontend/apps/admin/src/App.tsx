import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CompanyManagerPage } from './pages/CompanyManagerPage';

const routeTitles: Record<string, string> = {
  '/companies': 'Company Management',
};

const PageTitleManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const pageName = routeTitles[location.pathname];
    if (pageName) {
      document.title = `RudraNetra | ${pageName}`;
    } else {
      document.title = 'RudraNetra';
    }
  }, [location.pathname]);

  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PageTitleManager />
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        {/* Industrial SuperAdmin Header */}
        <header
          style={{
            height: 'var(--header-height)',
            borderBottom: '1px solid var(--line)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          {/* Brand & Console Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '2px',
                padding: '2px 5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--line)',
              }}
            >
              <img
                src="/RudraNetraLogo.png"
                alt="RudraNetra Logo"
                style={{ height: '22px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                RudraNetra
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  background: 'var(--bg-raised)',
                  color: 'var(--signal-amber)',
                  padding: '2px 8px',
                  border: '1px solid var(--line)',
                  letterSpacing: '0.04em',
                }}
              >
                SUPERADMIN CONSOLE
              </span>
            </div>
          </div>

          {/* Cluster Status Readout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: 'var(--signal-green)',
                  display: 'inline-block',
                }}
              />
              <span
                className="mono-num"
                style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
              >
                CLUSTER: UAE-PRIMARY &middot; SHARD: 01 &middot; TIMESCALEDB [TCP:5040 OK]
              </span>
            </div>

            <div style={{ width: '1px', height: '16px', background: 'var(--line)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.62rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--signal-amber)',
                  fontWeight: 700,
                }}
              >
                SA
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SuperAdmin</span>
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
