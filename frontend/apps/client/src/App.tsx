import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/shared/Sidebar';
import { Header } from './components/shared/Header';
import { LiveTrackingPage } from './pages/LiveTrackingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { PlaybackPage } from './pages/PlaybackPage';
import { GeofencesPage } from './pages/GeofencesPage';
import { DevicesPage } from './pages/DevicesPage';
import { FleetPage } from './pages/FleetPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';

// Newly added legacy module pages
import { RemindersPage } from './pages/RemindersPage';
import { ControlPanelPage } from './pages/ControlPanelPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { GuestAccessPage } from './pages/GuestAccessPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

const routeTitles: Record<string, string> = {
  '/live': 'Vehicles',
  '/vehicles': 'Vehicles',
  '/dashboard': 'Overview',
  '/playback': 'Trip History',
  '/geofences': 'Zones & POI',
  '/devices': 'Settings',
  '/fleet': 'Fleet Operations',
  '/reminders': 'Compliance & Reminders',
  '/control-panel': 'Control Panel & Immobilizer',
  '/complaints': 'Support & Complaints',
  '/guest-access': 'Guest Tracking Sharing',
  '/analytics': 'Fleet Analytics',
  '/reports': 'Reports',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/login': 'Login',
  '/signup': 'Create Account',
  '/register': 'Create Account',
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

import { useVehicleStore } from './store/vehicleStore';
import { useAuthStore } from './store/authStore';

// Authenticated layout wrapper
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchVehicles = useVehicleStore((state) => state.fetchVehicles);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);

  useEffect(() => {
    const activeToken = token || localStorage.getItem('rudra_auth_token') || '';
    const activeCompany = user?.company_id || 1;
    if (vehiclesMap.size === 0) {
      fetchVehicles(activeToken, activeCompany);
    }
  }, [token, user?.company_id, fetchVehicles, vehiclesMap.size]);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header />
        {children}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PageTitleManager />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/register" element={<SignupPage />} />
        
        <Route
          path="/live"
          element={
            <DashboardLayout>
              <LiveTrackingPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/playback"
          element={
            <DashboardLayout>
              <PlaybackPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/fleet"
          element={
            <DashboardLayout>
              <FleetPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/reminders"
          element={
            <DashboardLayout>
              <RemindersPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/control-panel"
          element={
            <DashboardLayout>
              <ControlPanelPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/analytics"
          element={
            <DashboardLayout>
              <AnalyticsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/complaints"
          element={
            <DashboardLayout>
              <ComplaintsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/guest-access"
          element={
            <DashboardLayout>
              <GuestAccessPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/geofences"
          element={
            <DashboardLayout>
              <GeofencesPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/devices"
          element={
            <DashboardLayout>
              <DevicesPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/reports"
          element={
            <DashboardLayout>
              <ReportsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/alerts"
          element={
            <DashboardLayout>
              <AlertsPage />
            </DashboardLayout>
          }
        />

        <Route
          path="/settings"
          element={
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          }
        />

        {/* Fallback & Redirects */}
        <Route path="/vehicles" element={<Navigate to="/live" replace />} />
        <Route path="/" element={<Navigate to="/live" replace />} />
        <Route path="*" element={<Navigate to="/live" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
