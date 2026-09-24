import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
        <Route path="/" element={<Navigate to="/live" replace />} />
        <Route path="*" element={<Navigate to="/live" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
