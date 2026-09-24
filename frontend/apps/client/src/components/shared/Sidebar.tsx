import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Navigation,
  LayoutDashboard,
  Layers,
  History,
  FileSpreadsheet,
  Cpu,
  Truck,
  Bell,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div
          className="brand-icon"
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '3px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(249, 115, 22, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <img
            src="/RudraNetraLogo.png"
            alt="RudraNetra"
            style={{ width: '32px', height: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div>
          <div className="brand-title">RudraNetra</div>
          <span className="brand-badge">NextGen V2</span>
        </div>
      </div>

      <nav className="nav-menu">
        <NavLink
          to="/live"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Navigation size={18} />
          <span>Live Tracking</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/playback"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <History size={18} />
          <span>Route Playback</span>
        </NavLink>

        <NavLink
          to="/geofences"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Layers size={18} />
          <span>Geofences & POI</span>
        </NavLink>

        <NavLink
          to="/devices"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Cpu size={18} />
          <span>Devices & Hardware</span>
        </NavLink>

        <NavLink
          to="/fleet"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Truck size={18} />
          <span>Fleet Operations</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FileSpreadsheet size={18} />
          <span>Reports & Analytics</span>
        </NavLink>

        <NavLink
          to="/alerts"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Bell size={18} />
          <span>Alerts & Rules</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <Settings size={18} />
          <span>System Settings</span>
        </NavLink>
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldCheck size={20} color="#10b981" />
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active Fleet Server</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Go + TimescaleDB</div>
        </div>
      </div>
    </aside>
  );
};
