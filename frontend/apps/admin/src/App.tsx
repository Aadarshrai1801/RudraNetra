import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom';
import { CompanyManagerPage } from './pages/CompanyManagerPage';
import { DeviceMasterPage } from './pages/DeviceMasterPage';
import { ExtensionManagerPage } from './pages/ExtensionManagerPage';
import { BillingMasterPage } from './pages/BillingMasterPage';
import { WarrantyMasterPage } from './pages/WarrantyMasterPage';
import { RawDataPage } from './pages/RawDataPage';
import { TollMasterPage } from './pages/TollMasterPage';
import { RoleRightsPage } from './pages/RoleRightsPage';
import { MastersPage } from './pages/MastersPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { isSuperAdminAuthenticated, clearSuperAdminAuth, getSuperAdminUser } from './utils/api';

import { 
  ExternalLink, ShieldCheck, ChevronDown, LogOut, 
  Building2, Radio, CalendarClock, CreditCard, Wrench, 
  Terminal, Milestone, KeyRound, Database 
} from 'lucide-react';

const routeTitles: Record<string, string> = {
  '/companies': 'Organization & Tenant Registry',
  '/devices': 'Device & SIM Master',
  '/extensions': 'Subscription Validity Extensions',
  '/billing': 'Invoicing & SaaS Billing',
  '/warranty': 'Hardware Warranty & AMC',
  '/raw-data': 'Raw Socket Packet Inspector',
  '/toll-data': 'Toll Plaza & Salik Gate Master',
  '/roles': 'Module Rights & Permissions Matrix',
  '/masters': 'System Lookup Masters',
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isSuperAdminAuthenticated());
  const [user, setUser] = useState<any>(() => getSuperAdminUser());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setUser(null);
    };
    window.addEventListener('rudra:superadmin:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('rudra:superadmin:auth_expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearSuperAdminAuth();
    setIsAuthenticated(false);
    setUser(null);
  };

  if (!isAuthenticated) {
    return (
      <AdminLoginPage
        onLoginSuccess={(authUser) => {
          setUser(authUser);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <PageTitleManager />
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
        {/* Daylight SuperAdmin Header */}
        <header
          style={{
            height: 'var(--header-height, 64px)',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/RudraNetraLogo.png"
                alt="RudraNetra Logo"
                style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
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

          {/* Quick Switch to Fleet Dispatch Console & User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '6px', textDecoration: 'none' }}
            >
              <span>Fleet Tracking Console</span>
              <ExternalLink size={13} />
            </a>

            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

            {/* Admin Profile Chip */}
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
                    {user?.full_name || user?.username || 'System SuperAdmin'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                    SuperAdmin · {user?.email || 'superadmin@rudranetrais.com'}
                  </span>
                </div>
                <ChevronDown size={14} color="var(--text-secondary)" />
              </button>

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
                  }}
                >
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#dc2626',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <LogOut size={13} />
                    <span>Logout SuperAdmin</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* SuperAdmin Navigation Sub-Bar */}
        <nav
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '0 32px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          {[
            { to: '/companies', label: 'Tenants & Orgs', icon: Building2 },
            { to: '/devices', label: 'Devices & SIMs', icon: Radio },
            { to: '/extensions', label: 'Validity Extensions', icon: CalendarClock },
            { to: '/billing', label: 'Billing & Invoices', icon: CreditCard },
            { to: '/warranty', label: 'Warranty & AMC', icon: Wrench },
            { to: '/raw-data', label: 'Raw Socket Packets', icon: Terminal },
            { to: '/toll-data', label: 'Toll & Salik Master', icon: Milestone },
            { to: '/roles', label: 'Role Rights Matrix', icon: KeyRound },
            { to: '/masters', label: 'Lookup Masters', icon: Database },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '12px 14px',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                })}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <main>
          <Routes>
            <Route path="/companies" element={<CompanyManagerPage />} />
            <Route path="/devices" element={<DeviceMasterPage />} />
            <Route path="/extensions" element={<ExtensionManagerPage />} />
            <Route path="/billing" element={<BillingMasterPage />} />
            <Route path="/warranty" element={<WarrantyMasterPage />} />
            <Route path="/raw-data" element={<RawDataPage />} />
            <Route path="/toll-data" element={<TollMasterPage />} />
            <Route path="/roles" element={<RoleRightsPage />} />
            <Route path="/masters" element={<MastersPage />} />
            <Route path="*" element={<Navigate to="/companies" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
