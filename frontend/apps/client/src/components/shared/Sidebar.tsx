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
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
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

      {/* Nav Menu — Cut down to what a fleet owner thinks about */}
      <nav className="nav-menu">
        <NavLink
          to="/live"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Truck size={18} />
          <span>Vehicles</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/playback"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Clock size={18} />
          <span>Trip history</span>
        </NavLink>

        <NavLink
          to="/geofences"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Compass size={18} />
          <span>Zones</span>
        </NavLink>

        <NavLink
          to="/alerts"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <AlertCircle size={18} />
          <span>Alerts</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FileText size={18} />
          <span>Reports</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* Calm Status Footer — No server logs or internal DB names */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--good)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            All systems normal
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          Updated just now
        </span>
      </div>
    </aside>
  );
};
