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

const routeTitles: Record<string, string> = {
  '/live': 'Vehicles',
  '/vehicles': 'Vehicles',
  '/dashboard': 'Overview',
  '/playback': 'Trip History',
  '/geofences': 'Zones',
  '/devices': 'Settings',
  '/fleet': 'Fleet Operations',
  '/reports': 'Reports',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/login': 'Login',
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

// Authenticated layout wrapper
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
          path="/fleet"
          element={
            <DashboardLayout>
              <FleetPage />
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
