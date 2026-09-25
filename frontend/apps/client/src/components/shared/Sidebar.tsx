import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  Clock,
  Compass,
  FileText,
  AlertCircle,
  Settings,
  Bell,
  Sliders,
  BarChart3,
  LifeBuoy,
  Share2,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
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
      <nav className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <NavLink
          to="/live"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Truck size={17} />
          <span>Vehicles</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={17} />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/playback"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Clock size={17} />
          <span>Trip history</span>
        </NavLink>

        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 12px' }} />

        <NavLink
          to="/fleet"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Truck size={17} />
          <span>Fleet Operations</span>
        </NavLink>

        <NavLink
          to="/reminders"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Bell size={17} />
          <span>Reminders</span>
        </NavLink>

        <NavLink
          to="/control-panel"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Sliders size={17} />
          <span>Control Panel</span>
        </NavLink>

        <NavLink
          to="/analytics"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <BarChart3 size={17} />
          <span>Analytics</span>
        </NavLink>

        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 12px' }} />

        <NavLink
          to="/complaints"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <LifeBuoy size={17} />
          <span>Support Register</span>
        </NavLink>

        <NavLink
          to="/guest-access"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Share2 size={17} />
          <span>Guest Tracking</span>
        </NavLink>

        <NavLink
          to="/geofences"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Compass size={17} />
          <span>Zones & POI</span>
        </NavLink>

        <NavLink
          to="/alerts"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <AlertCircle size={17} />
          <span>Alerts</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FileText size={17} />
          <span>Reports</span>
        </NavLink>

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
