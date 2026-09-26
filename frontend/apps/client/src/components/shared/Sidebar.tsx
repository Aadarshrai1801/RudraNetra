import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Navigation,
  Bell,
  FileText,
  Table,
  Sliders,
  Wrench,
  ChevronDown,
  Settings,
  Truck,
  Route,
  History,
  ToggleRight,
  Shield,
  MapPin,
  Cpu,
  Radio,
  MessageSquare,
  Users,
  Building2,
  Disc,
  FileCheck,
  Compass,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const location = useLocation();

  // Collapsible dropdown groups matching legacy project (Screenshot 2, 3, 5)
  const isTripActive = ['/trip-manager', '/party-routes', '/playback', '/fleet'].some((p) =>
    location.pathname.startsWith(p)
  );
  const isConfigActive = ['/control-panel', '/geofence-manager', '/location-manager', '/enable-feature'].some((p) =>
    location.pathname.startsWith(p)
  );
  const isManagerActive = ['/asset-manager', '/complaint-manager', '/driver-manager', '/party-manager', '/trailor-master', '/truck-master', '/document-master', '/find-nearest-vehicle', '/show-nearest-places'].some((p) =>
    location.pathname.startsWith(p)
  );

  const [tripOpen, setTripOpen] = useState(isTripActive || false);
  const [configOpen, setConfigOpen] = useState(isConfigActive || false);
  const [managerOpen, setManagerOpen] = useState(isManagerActive || false);

  return (
    <aside className="sidebar" style={{ overflowY: 'auto' }}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div
          style={{
            background: 'var(--accent-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
          }}
        >
          <img
            src="/RudraNetraLogo.png"
            alt="RudraNetra"
            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
          />
        </div>
        <div>
          <span className="brand-title">RudraNetra</span>
          <span className="brand-subtitle">Fleet tracking</span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {/* 1. Vehicle */}
        <NavLink
          to="/live"
          className={({ isActive }) => `nav-link ${isActive || location.pathname === '/home' || location.pathname === '/' || location.pathname === '/vehicles' ? 'active' : ''}`}
        >
          <Truck size={17} />
          <span>Vehicle</span>
        </NavLink>

        {/* 2. Overview (Preserved name) */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive || location.pathname === '/overview' ? 'active' : ''}`}
        >
          <LayoutDashboard size={17} />
          <span>Overview</span>
        </NavLink>

        {/* 3. Trip Dropdown Group (Screenshot 3) */}
        <div style={{ marginTop: '2px' }}>
          <button
            type="button"
            onClick={() => setTripOpen(!tripOpen)}
            className={`nav-link ${isTripActive ? 'active' : ''}`}
            style={{
              width: '100%',
              justifyContent: 'space-between',
              background: isTripActive ? 'var(--accent-light)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: isTripActive ? 600 : 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Navigation size={17} />
              <span>Trip</span>
            </div>
            <ChevronDown size={14} style={{ transform: tripOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
          </button>

          {tripOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '20px', marginTop: '2px' }}>
              <NavLink
                to="/trip-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Truck size={15} />
                <span>Trip Manager</span>
              </NavLink>
              <NavLink
                to="/party-routes"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Route size={15} />
                <span>Party Routes Manager</span>
              </NavLink>
              <NavLink
                to="/playback"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <History size={15} />
                <span>Trip History</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* 4. Alert (Legacy name) */}
        <NavLink
          to="/alert"
          className={({ isActive }) => `nav-link ${isActive || location.pathname === '/alerts' ? 'active' : ''}`}
        >
          <Bell size={17} />
          <span>Alert</span>
        </NavLink>

        {/* 5. Report (Legacy name) */}
        <NavLink
          to="/report"
          className={({ isActive }) => `nav-link ${isActive || location.pathname === '/reports' ? 'active' : ''}`}
        >
          <FileText size={17} />
          <span>Report</span>
        </NavLink>

        {/* 6. List View (Legacy name) */}
        <NavLink
          to="/list-view"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Table size={17} />
          <span>List View</span>
        </NavLink>

        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 12px' }} />

        {/* 7. Configuration Dropdown Group (Screenshot 5) */}
        <div>
          <button
            type="button"
            onClick={() => setConfigOpen(!configOpen)}
            className={`nav-link ${isConfigActive ? 'active' : ''}`}
            style={{
              width: '100%',
              justifyContent: 'space-between',
              background: isConfigActive ? 'var(--accent-light)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: isConfigActive ? 600 : 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Sliders size={17} />
              <span>Configuration</span>
            </div>
            <ChevronDown size={14} style={{ transform: configOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
          </button>

          {configOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '20px', marginTop: '2px' }}>
              <NavLink
                to="/enable-feature"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ToggleRight size={15} />
                <span>Enable Feature</span>
              </NavLink>
              <NavLink
                to="/geofence-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Shield size={15} />
                <span>Geofence Manager</span>
              </NavLink>
              <NavLink
                to="/location-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <MapPin size={15} />
                <span>Location Manager</span>
              </NavLink>
              <NavLink
                to="/control-panel"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Cpu size={15} />
                <span>Control Panel</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* 8. Manager Dropdown Group (Screenshot 2) */}
        <div>
          <button
            type="button"
            onClick={() => setManagerOpen(!managerOpen)}
            className={`nav-link ${isManagerActive ? 'active' : ''}`}
            style={{
              width: '100%',
              justifyContent: 'space-between',
              background: isManagerActive ? 'var(--accent-light)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: isManagerActive ? 600 : 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Wrench size={17} />
              <span>Manager</span>
            </div>
            <ChevronDown size={14} style={{ transform: managerOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
          </button>

          {managerOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '20px', marginTop: '2px' }}>
              <NavLink
                to="/asset-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Radio size={15} />
                <span>Asset Manager</span>
              </NavLink>
              <NavLink
                to="/complaint-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <MessageSquare size={15} />
                <span>Complaint Manager</span>
              </NavLink>
              <NavLink
                to="/driver-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Users size={15} />
                <span>Driver Manager</span>
              </NavLink>
              <NavLink
                to="/find-nearest-vehicle"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Compass size={15} />
                <span>Find Nearest Vehicle</span>
              </NavLink>
              <NavLink
                to="/party-manager"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Building2 size={15} />
                <span>Party/Company Manager</span>
              </NavLink>
              <NavLink
                to="/show-nearest-places"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <MapPin size={15} />
                <span>Show Nearest Places</span>
              </NavLink>
              <NavLink
                to="/trailor-master"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Disc size={15} />
                <span>Trailor Master</span>
              </NavLink>
              <NavLink
                to="/truck-master"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Truck size={15} />
                <span>Truck Master</span>
              </NavLink>
              <NavLink
                to="/document-master"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ fontSize: '0.84rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FileCheck size={15} />
                <span>Document Master</span>
              </NavLink>
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 12px' }} />

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Settings size={17} />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', marginTop: 'auto', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
        <div>SIRA Approved Platform</div>
      </div>
    </aside>
  );
};
