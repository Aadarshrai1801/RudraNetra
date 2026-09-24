import React, { useState } from 'react';
import {
  CheckCircle2,
  Building,
  Sliders,
  Cpu,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [saved, setSaved] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  const [devices, setDevices] = useState([
    { id: 101, vehicle: '95321', type: 'Standard GPS unit (Teltonika FMB920)', status: 'Connected', sim: '+971 50 198 1240' },
    { id: 102, vehicle: '82561', type: 'Standard GPS unit (Teltonika FMB920)', status: 'Connected', sim: '+971 50 198 1241' },
    { id: 106, vehicle: '84707', type: 'Standard GPS unit (Teltonika FMB920)', status: 'Connected', sim: '+971 50 198 1242' },
    { id: 104, vehicle: '99292', type: 'Standard GPS unit (Teltonika FMB920)', status: 'Connected', sim: '+971 50 198 1243' },
    { id: 184, vehicle: '33566', type: 'Standard GPS unit (Teltonika FMB920)', status: 'Connected', sim: '+971 50 198 1244' },
  ]);

  const [newDevice, setNewDevice] = useState({
    vehiclePlate: '',
    simNumber: '',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.vehiclePlate) return;
    setDevices([
      ...devices,
      {
        id: 100 + devices.length + 1,
        vehicle: newDevice.vehiclePlate,
        type: 'Standard GPS unit',
        status: 'Connected',
        sim: newDevice.simNumber || '+971 50 000 0000',
      },
    ]);
    setNewDevice({ vehiclePlate: '', simNumber: '' });
    setIsAddDeviceOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="page-container" style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
          Manage your business profile, vehicle tracking preferences, and installed hardware.
        </p>
      </div>

      {/* System Health Status — One calm plain line */}
      <div
        style={{
          background: 'var(--good-bg)',
          border: '1px solid var(--good-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--good)',
                display: 'inline-block',
              }}
            />
            <div>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                All systems working normally
              </span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                GPS tracking, live maps, and notifications are fully operational.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{showTechnicalDetails ? 'Hide technical details' : 'Show details'}</span>
            {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Technical Details behind secondary tap */}
        {showTechnicalDetails && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px dashed var(--good-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>GPS Receiver Gateway</div>
              <div>Connected (TCP Port 5040 active)</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Historical Data Store</div>
              <div>Partitioned time-series healthy</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Real-Time Dispatch Engine</div>
              <div>WebSocket streaming active</div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Company Profile */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <Building size={20} color="var(--accent)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Business profile
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Company name
              </label>
              <input
                type="text"
                defaultValue="Allied Transport UAE"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-page)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Contact manager
              </label>
              <input
                type="text"
                defaultValue="Operations Manager"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-page)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Dispatch contact phone
              </label>
              <input
                type="text"
                defaultValue="+971 4 8800000"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-page)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                City & region
              </label>
              <input
                type="text"
                defaultValue="Dubai, United Arab Emirates"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-page)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Fleet Tracking Preferences */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <Sliders size={20} color="var(--accent)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Tracking preferences
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Notify when vehicle is waiting with engine on
              </label>
              <select
                defaultValue="20"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-page)',
                }}
              >
                <option value="15">After 15 minutes</option>
                <option value="20">After 20 minutes (Recommended)</option>
                <option value="30">After 30 minutes</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Highway speed alert threshold
              </label>
              <select
                defaultValue="80"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-page)',
                }}
              >
                <option value="80">80 km/h (Standard heavy vehicle limit)</option>
                <option value="90">90 km/h</option>
                <option value="100">100 km/h</option>
              </select>
            </div>
          </div>
        </div>

        {/* Folded Devices & Hardware Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={20} color="var(--accent)" />
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tracking devices & hardware ({devices.length})
                </h2>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Hardware units installed in your vehicles
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddDeviceOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} />
              <span>Add a tracking unit</span>
            </button>
          </div>

          {/* List of hardware units */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {devices.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  background: 'var(--bg-page)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {d.vehicle}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {d.type} · SIM: {d.sim}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="badge badge-good">
                    <span className="status-dot status-dot-good" />
                    <span>{d.status}</span>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    Device #{d.id}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add Device Mini Modal */}
          {isAddDeviceOpen && (
            <div
              style={{
                marginTop: '16px',
                padding: '18px',
                background: 'var(--accent-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent)',
              }}
            >
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Register a new vehicle tracker
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Vehicle plate number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DXB-E-55120"
                    value={newDevice.vehiclePlate}
                    onChange={(e) => setNewDevice({ ...newDevice, vehiclePlate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      background: '#FFFFFF',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tracker SIM phone number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +971 50 198 1244"
                    value={newDevice.simNumber}
                    onChange={(e) => setNewDevice({ ...newDevice, simNumber: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      background: '#FFFFFF',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsAddDeviceOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddDevice}
                  className="btn btn-primary btn-sm"
                >
                  Add device
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button type="submit" className="btn btn-primary">
            Save preferences
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--good)', fontSize: '0.9rem', fontWeight: 500 }}>
              <CheckCircle2 size={16} />
              Settings saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
