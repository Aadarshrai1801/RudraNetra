import React, { useState } from 'react';
import { Shield, Server, Map, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>System & Fleet Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Global preferences for telematics ingestion, organization profile, and map displays.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Organization Profile */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--cyan-accent)" />
            Tenant Organization Profile
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Company Name
              </label>
              <input
                type="text"
                defaultValue="VAVE Logistics UAE"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Tenant Organization Code
              </label>
              <input
                type="text"
                defaultValue="VAVE_UAE"
                readOnly
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: 'var(--text-muted)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Contact Person
              </label>
              <input
                type="text"
                defaultValue="Sanjay Kumar"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Primary Phone (SMS Sender)
              </label>
              <input
                type="text"
                defaultValue="+971-50-1234567"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              />
            </div>
          </div>
        </div>

        {/* Telematics Ingestion Engine */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} color="#10b981" />
            GPS Telematics & Ingestion Engine
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                TCP Ingest Port (Teltonika FMB920)
              </label>
              <input
                type="number"
                defaultValue={5040}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                TimescaleDB Partition Interval
              </label>
              <input
                type="text"
                defaultValue="7 days chunk partition"
                readOnly
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: 'var(--text-muted)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                GPS Stoppage Idle Threshold
              </label>
              <select
                defaultValue="180"
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              >
                <option value="60">1 minute</option>
                <option value="180">3 minutes (Recommended)</option>
                <option value="300">5 minutes</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Over-speed Grace Period
              </label>
              <select
                defaultValue="15"
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              >
                <option value="10">10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Map & GIS Preferences */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Map size={18} color="#f59e0b" />
            Map & GIS Preferences
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Default Map Vector Theme
              </label>
              <select
                defaultValue="dark"
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              >
                <option value="dark">Carto Dark Matter (Cyber)</option>
                <option value="streets">OpenStreetMap Standard</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Measurement Units
              </label>
              <select
                defaultValue="metric"
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              >
                <option value="metric">Kilometers (km/h, Liters, °C)</option>
                <option value="imperial">Miles (mph, Gallons, °F)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>
            Save All Preferences
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem' }}>
              <Check size={16} />
              Settings updated successfully!
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
