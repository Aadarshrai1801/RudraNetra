import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Crosshair,
  Gauge,
  History,
  Layers,
  Cpu,
  Truck,
  FileText,
  AlertOctagon,
  Sliders,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div
          style={{
            background: '#ffffff',
            borderRadius: '2px',
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--line)',
          }}
        >
          <img
            src="/RudraNetraLogo.png"
            alt="RudraNetra"
            style={{ width: '28px', height: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div>
          <span className="brand-title">RudraNetra</span>
        </div>
      </div>

      {/* Nav Menu with Logical Section Grouping */}
      <nav className="nav-menu">
        {/* MONITORING GROUP */}
        <div className="sidebar-group">
          <div className="sidebar-section-title">Monitoring</div>

          <NavLink
            to="/live"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Crosshair size={16} strokeWidth={2.2} />
            <span>Live Tracking</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Gauge size={16} strokeWidth={2.2} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/playback"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <History size={16} strokeWidth={2.2} />
            <span>Route Playback</span>
          </NavLink>
        </div>

        <div style={{ height: '1px', background: 'var(--line)', margin: '8px 16px' }} />

        {/* CONFIGURATION GROUP */}
        <div className="sidebar-group">
          <div className="sidebar-section-title">Configuration</div>

          <NavLink
            to="/geofences"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Layers size={16} strokeWidth={2.2} />
            <span>Geofences & POI</span>
          </NavLink>

          <NavLink
            to="/devices"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Cpu size={16} strokeWidth={2.2} />
            <span>Devices & Hardware</span>
          </NavLink>

          <NavLink
            to="/fleet"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Truck size={16} strokeWidth={2.2} />
            <span>Fleet Operations</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <FileText size={16} strokeWidth={2.2} />
            <span>Reports & Export</span>
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <AlertOctagon size={16} strokeWidth={2.2} />
            <span>Alerts & Rules</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Sliders size={16} strokeWidth={2.2} />
            <span>System Settings</span>
          </NavLink>
        </div>
      </nav>

      {/* Industrial System Telemetry Status Footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '5px',
              height: '5px',
              background: 'var(--signal-green)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.68rem' }}>INGEST :5040</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          TIMESCALEDB
        </span>
      </div>
    </aside>
  );
};
