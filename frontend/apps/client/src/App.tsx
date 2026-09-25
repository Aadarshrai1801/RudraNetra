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

// Legacy module pages & managers
import { RemindersPage } from './pages/RemindersPage';
import { ControlPanelPage } from './pages/ControlPanelPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { GuestAccessPage } from './pages/GuestAccessPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ListViewPage } from './pages/ListViewPage';

import { useVehicleStore } from './store/vehicleStore';
import { useAuthStore } from './store/authStore';

// Page titles strictly based on legacy project feature names
const routeTitles: Record<string, string> = {
  '/': 'Vehicle',
  '/home': 'Vehicle',
  '/live': 'Vehicle',
  '/vehicles': 'Vehicle',
  '/overview': 'Overview',
  '/dashboard': 'Overview',
  '/list-view': 'List View',
  '/alert': 'Alert',
  '/alerts': 'Alert',
  '/report': 'Report',
  '/reports': 'Report',
  '/playback': 'Trip History',
  '/trip-manager': 'Trip Manager',
  '/party-routes': 'Party Routes Manager',
  '/driver-manager': 'Driver Manager',
  '/trailor-master': 'Trailor Master',
  '/truck-master': 'Truck Master',
  '/party-manager': 'Party/Company Manager',
  '/fleet': 'Trip Manager',
  '/control-panel': 'Control Panel',
  '/geofence-manager': 'Geofence Manager',
  '/geofences': 'Geofence Manager',
  '/location-manager': 'Location Manager',
  '/enable-feature': 'Enable Feature',
  '/guest-access': 'Enable Feature',
  '/sms-email-config': 'Sms & Email Configuration',
  '/asset-manager': 'Asset Manager',
  '/devices': 'Asset Manager',
  '/complaint-manager': 'Complaint Manager',
  '/complaints': 'Complaint Manager',
  '/document-master': 'Document Master',
  '/reminders': 'Document Master',
  '/find-nearest-vehicle': 'Find Nearest Vehicle',
  '/show-nearest-places': 'Show Nearest Places',
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
        
        {/* 1. Vehicle */}
        <Route
          path="/live"
          element={
            <DashboardLayout>
              <LiveTrackingPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/home"
          element={
            <DashboardLayout>
              <LiveTrackingPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/vehicles"
          element={
            <DashboardLayout>
              <LiveTrackingPage />
            </DashboardLayout>
          }
        />

        {/* 2. Overview (Preserved name) */}
        <Route
          path="/dashboard"
          element={
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/overview"
          element={
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          }
        />

        {/* 3. List View */}
        <Route
          path="/list-view"
          element={
            <DashboardLayout>
              <ListViewPage />
            </DashboardLayout>
          }
        />

        {/* 4. Alert (Legacy name) */}
        <Route
          path="/alert"
          element={
            <DashboardLayout>
              <AlertsPage initialTab="alarms" />
            </DashboardLayout>
          }
        />
        <Route
          path="/alerts"
          element={
            <DashboardLayout>
              <AlertsPage initialTab="alarms" />
            </DashboardLayout>
          }
        />

        {/* 5. Report (Legacy name) */}
        <Route
          path="/report"
          element={
            <DashboardLayout>
              <ReportsPage />
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

        {/* 6. Trip Group: Trip Manager, Party Routes Manager, Trip History (Screenshot 3) */}
        <Route
          path="/trip-manager"
          element={
            <DashboardLayout>
              <FleetPage initialTab="trips" />
            </DashboardLayout>
          }
        />
        <Route
          path="/party-routes"
          element={
            <DashboardLayout>
              <FleetPage initialTab="partyroutes" />
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
              <FleetPage initialTab="trips" />
            </DashboardLayout>
          }
        />

        {/* 7. Configuration Group (Screenshot 5) */}
        <Route
          path="/enable-feature"
          element={
            <DashboardLayout>
              <GuestAccessPage />
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
          path="/geofence-manager"
          element={
            <DashboardLayout>
              <GeofencesPage initialTab="zones" />
            </DashboardLayout>
          }
        />
        <Route
          path="/geofences"
          element={
            <DashboardLayout>
              <GeofencesPage initialTab="zones" />
            </DashboardLayout>
          }
        />
        <Route
          path="/location-manager"
          element={
            <DashboardLayout>
              <GeofencesPage initialTab="places" />
            </DashboardLayout>
          }
        />
        <Route
          path="/sms-email-config"
          element={
            <DashboardLayout>
              <AlertsPage initialTab="rules" />
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

        {/* 8. Manager Group (Screenshot 2) */}
        <Route
          path="/asset-manager"
          element={
            <DashboardLayout>
              <DevicesPage />
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
          path="/complaint-manager"
          element={
            <DashboardLayout>
              <ComplaintsPage />
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
          path="/driver-manager"
          element={
            <DashboardLayout>
              <FleetPage initialTab="drivers" />
            </DashboardLayout>
          }
        />
        <Route
          path="/party-manager"
          element={
            <DashboardLayout>
              <FleetPage initialTab="partyroutes" />
            </DashboardLayout>
          }
        />
        <Route
          path="/trailor-master"
          element={
            <DashboardLayout>
              <FleetPage initialTab="tyres" />
            </DashboardLayout>
          }
        />
        <Route
          path="/truck-master"
          element={
            <DashboardLayout>
              <FleetPage initialTab="trips" />
            </DashboardLayout>
          }
        />
        <Route
          path="/document-master"
          element={
            <DashboardLayout>
              <RemindersPage />
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
          path="/find-nearest-vehicle"
          element={
            <DashboardLayout>
              <LiveTrackingPage initialAction="find-nearest" />
            </DashboardLayout>
          }
        />
        <Route
          path="/show-nearest-places"
          element={
            <DashboardLayout>
              <LiveTrackingPage initialAction="nearest-places" />
            </DashboardLayout>
          }
        />

        {/* Other modules */}
        <Route
          path="/analytics"
          element={
            <DashboardLayout>
              <AnalyticsPage />
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

        {/* Default Fallback & Redirects */}
        <Route path="/vehicles" element={<Navigate to="/live" replace />} />
        <Route path="/" element={<Navigate to="/live" replace />} />
        <Route path="*" element={<Navigate to="/live" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
