import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Building,
  Sliders,
  Cpu,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface SettingsForm {
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  address: string;
  idleThresholdMinutes: string;
  speedThresholdKmh: string;
  timezone: string;
  language: string;
  vatPercent: string;
}

interface SettingsUsage {
  devices: number | null;
  users: number | null;
  vehicles: number | null;
}

interface DeviceItem {
  id: number;
  imei: string | null;
  vehicle: string | null;
  type: string | null;
  status: string | null;
  sim: string | null;
  lastHeartbeat: string | null;
}

const EMPTY_SETTINGS: SettingsForm = {
  companyName: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  city: '',
  address: '',
  idleThresholdMinutes: '',
  speedThresholdKmh: '',
  timezone: '',
  language: '',
  vatPercent: '',
};

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

// The API returns 0 for unset numeric settings; hide it rather than showing a fabricated number.
const optionalNumber = (value: unknown): string => {
  const num = Number(value);
  return Number.isFinite(num) && num !== 0 ? String(num) : '';
};

export const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  const [settings, setSettings] = useState<SettingsForm>(EMPTY_SETTINGS);
  const [usage, setUsage] = useState<SettingsUsage>({ devices: null, users: null, vehicles: null });

  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [newDevice, setNewDevice] = useState({
    imei: '',
    vehiclePlate: '',
    simNumber: '',
  });

  const loadSettings = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/settings');
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || 'Failed to load organization settings.');
      }
      const company = json.data.company || {};
      const stored = json.data.settings || {};
      const counts = json.data.usage || {};

      setSettings({
        companyName: text(company.name),
        contactPerson: text(company.contactPerson),
        contactEmail: text(company.contactEmail),
        contactPhone: text(company.contactPhone),
        city: text(company.city),
        address: text(company.address),
        idleThresholdMinutes: optionalNumber(stored.idleThresholdMinutes),
        speedThresholdKmh: optionalNumber(stored.speedThresholdKmh),
        timezone: text(stored.timezone),
        language: text(stored.language),
        vatPercent: optionalNumber(stored.vatPercent),
      });
      setUsage({
        devices: typeof counts.devices === 'number' ? counts.devices : null,
        users: typeof counts.users === 'number' ? counts.users : null,
        vehicles: typeof counts.vehicles === 'number' ? counts.vehicles : null,
      });
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load organization settings.');
    }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    setDeviceError(null);
    try {
      const res = await fetchWithAuth('/api/v1/devices');
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || 'Failed to load tracking devices.');
      }
      setDevices(
        json.data.map((d: any) => ({
          id: d.id,
          imei: d.imei ?? null,
          vehicle: d.assignedVehicle || '—',
          type: d.protocol || '—',
          status: d.status || '—',
          sim: d.simNo || '—',
          lastHeartbeat: d.lastHeartbeat || null,
        }))
      );
    } catch (err: any) {
      setDeviceError(err?.message || 'Failed to load tracking devices.');
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadDevices();
  }, [user?.company_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetchWithAuth('/api/v1/settings', {
        method: 'PUT',
        body: JSON.stringify({
          companyName: settings.companyName,
          contactPerson: settings.contactPerson,
          contactEmail: settings.contactEmail,
          contactPhone: settings.contactPhone,
          city: settings.city,
          address: settings.address,
          idleThresholdMinutes: Number(settings.idleThresholdMinutes) || 0,
          speedThresholdKmh: Number(settings.speedThresholdKmh) || 0,
          timezone: settings.timezone,
          language: settings.language,
          vatPercent: Number(settings.vatPercent) || 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to save settings.');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadSettings();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const imei = newDevice.imei.trim();
    if (!imei) {
      setRegisterError('Enter the tracker IMEI to register a device.');
      return;
    }
    setRegisterError(null);
    try {
      const payload: Record<string, string> = { imei };
      if (newDevice.vehiclePlate.trim()) payload.assignedVehicle = newDevice.vehiclePlate.trim();
      if (newDevice.simNumber.trim()) payload.simNo = newDevice.simNumber.trim();

      const res = await fetchWithAuth('/api/v1/devices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to register device.');
      }

      setNewDevice({ imei: '', vehiclePlate: '', simNumber: '' });
      setIsAddDeviceOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadDevices();
    } catch (err: any) {
      setRegisterError(err?.message || 'Failed to register device.');
    }
  };

  // Heartbeat status is derived from the device rows returned by the API.
  const heartbeatCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const reportingDevices = devices.filter((d) => {
    if (!d.lastHeartbeat) return false;
    const time = Date.parse(d.lastHeartbeat);
    return Number.isFinite(time) && time >= heartbeatCutoff;
  });
  const healthHealthy = reportingDevices.length > 0;
  const healthHeadline =
    devices.length === 0
      ? 'No tracking units registered'
      : `${reportingDevices.length} of ${devices.length} tracking units reported in the last 24 hours`;
  const healthDetail =
    usage.devices === null && usage.vehicles === null && usage.users === null
      ? 'Usage counters are not available from the settings API.'
      : `${usage.devices ?? '—'} devices · ${usage.vehicles ?? '—'} vehicles · ${usage.users ?? '—'} users registered in this organization.`;

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

      {loadError && (
        <div
          style={{
            background: 'var(--attention-bg)',
            border: '1px solid var(--attention-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            color: 'var(--attention)',
            fontSize: '0.875rem',
          }}
        >
          {loadError}
        </div>
      )}

      {/* System Health Status (derived from API device heartbeats and usage counts) */}
      <div
        style={{
          background: healthHealthy ? 'var(--good-bg)' : 'var(--attention-bg)',
          border: healthHealthy ? '1px solid var(--good-border)' : '1px solid var(--attention-border)',
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
                backgroundColor: healthHealthy ? 'var(--good)' : 'var(--attention)',
                display: 'inline-block',
              }}
            />
            <div>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {healthHeadline}
              </span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {healthDetail}
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

        {/* Technical Details (real values from the settings and devices APIs) */}
        {showTechnicalDetails && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: `1px dashed ${healthHealthy ? 'var(--good-border)' : 'var(--attention-border)'}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Registered devices</div>
              <div>{usage.devices ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Heartbeats (last 24h)</div>
              <div>{devices.length > 0 ? `${reportingDevices.length} of ${devices.length}` : '—'}</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Fleet & portal users</div>
              <div>{`${usage.vehicles ?? '—'} vehicles · ${usage.users ?? '—'} users`}</div>
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
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
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
                value={settings.contactPerson}
                onChange={(e) => setSettings({ ...settings, contactPerson: e.target.value })}
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
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
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
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
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
                Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
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
                Contact email
              </label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
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
              <input
                type="number"
                min="1"
                placeholder="Minutes"
                value={settings.idleThresholdMinutes}
                onChange={(e) => setSettings({ ...settings, idleThresholdMinutes: e.target.value })}
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
                Highway speed alert threshold
              </label>
              <input
                type="number"
                min="1"
                placeholder="km/h"
                value={settings.speedThresholdKmh}
                onChange={(e) => setSettings({ ...settings, speedThresholdKmh: e.target.value })}
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
              onClick={() => {
                setRegisterError(null);
                setIsAddDeviceOpen(true);
              }}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} />
              <span>Add a tracking unit</span>
            </button>
          </div>

          {deviceError && (
            <div style={{ padding: '12px 16px', marginBottom: '12px', borderRadius: 'var(--radius-md)', background: 'var(--attention-bg)', border: '1px solid var(--attention-border)', color: 'var(--attention)', fontSize: '0.85rem' }}>
              {deviceError}
            </div>
          )}

          {/* List of hardware units */}
          {loadingDevices ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading registered tracking devices...
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No tracking units registered yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {devices.map((d) => {
                const isOnline = /active|online|connected/i.test(d.status || '');
                return (
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
                        IMEI: {d.imei || '—'} · {d.type} · SIM: {d.sim}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={isOnline ? 'badge badge-good' : 'badge badge-neutral'}>
                        <span className={isOnline ? 'status-dot status-dot-good' : 'status-dot status-dot-neutral'} />
                        <span>{d.status}</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                        Device #{d.id}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

              {registerError && (
                <div style={{ marginBottom: '12px', color: '#DC2626', fontSize: '0.825rem' }}>
                  {registerError}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Tracker IMEI *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 869234051284999"
                  value={newDevice.imei}
                  onChange={(e) => setNewDevice({ ...newDevice, imei: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    background: '#FFFFFF',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Vehicle plate number
                  </label>
                  <input
                    type="text"
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
                      color: 'var(--text-primary)',
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
                      color: 'var(--text-primary)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save preferences'}
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--good)', fontSize: '0.9rem', fontWeight: 500 }}>
              <CheckCircle2 size={16} />
              Settings saved successfully
            </span>
          )}
          {saveError && (
            <span style={{ color: '#DC2626', fontSize: '0.875rem', fontWeight: 500 }}>
              {saveError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
