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
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: '#f8fafc' }}>
        <header
          style={{
            height: '64px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '3px 5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(249, 115, 22, 0.35)',
              }}
            >
              <img
                src="/RudraNetraLogo.png"
                alt="RudraNetra Logo"
                style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
                RudraNetra
              </span>
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                SuperAdmin Portal
              </span>
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
