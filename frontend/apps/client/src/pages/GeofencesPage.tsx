import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  MapPin,
  CheckCircle2,
  X,
  Trash2,
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface ZoneItem {
  id: number;
  name: string | null;
  type: string | null;
  speedLimit: number | null;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  areaKm2: number | null;
  activeVehicles: number | null;
}

interface SavedPlace {
  id: number;
  name: string | null;
  category: string | null;
  address: string | null;
}

const dash = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '—' : String(value);

// Boundary vertices entered by the user; the API expects [lng, lat] pairs.
const parseCoordinateLines = (raw: string): [number, number][] => {
  const points: [number, number][] = [];
  raw.split('\n').forEach((line) => {
    const parts = line.split(',').map((part) => Number(part.trim()));
    if (parts.length === 2 && parts.every((num) => Number.isFinite(num))) {
      points.push([parts[0], parts[1]]);
    }
  });
  return points;
};

export const GeofencesPage: React.FC<{ initialTab?: 'zones' | 'places' }> = ({ initialTab = 'zones' }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'zones' | 'places'>(initialTab);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qTab = params.get('tab');
    if (qTab && (qTab === 'zones' || qTab === 'places')) {
      setActiveTab(qTab);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [location.search, initialTab]);

  const [newZone, setNewZone] = useState({
    name: '',
    speedLimit: '',
    alertOnEnter: false,
    alertOnExit: false,
    coordinates: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [zonesRes, placesRes] = await Promise.all([
        fetchWithAuth('/api/v1/geofences'),
        fetchWithAuth('/api/v1/poi'),
      ]);

      if (zonesRes.ok) {
        const json = await zonesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setZones(json.data);
        }
      }

      if (placesRes.ok) {
        const json = await placesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setPlaces(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load geofences from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.name) return;

    const coordinates = parseCoordinateLines(newZone.coordinates);
    if (coordinates.length < 3) {
      showToast('Enter at least 3 boundary points as "longitude, latitude" (one per line).');
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: newZone.name,
        coordinates,
        alertOnEnter: newZone.alertOnEnter,
        alertOnExit: newZone.alertOnExit,
      };
      const speedLimit = Number(newZone.speedLimit);
      if (newZone.speedLimit.trim() !== '' && Number.isFinite(speedLimit) && speedLimit > 0) {
        body.speedLimit = speedLimit;
      }

      const res = await fetchWithAuth('/api/v1/geofences', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        showToast(`Zone "${newZone.name}" created successfully in database.`);
        setIsCreateModalOpen(false);
        setNewZone({ name: '', speedLimit: '', alertOnEnter: false, alertOnExit: false, coordinates: '' });
        loadData();
      } else {
        showToast(json?.error || 'Failed to create zone.');
      }
    } catch (err) {
      showToast('Error creating zone in database.');
    }
  };

  const handleDeleteZone = async (id: number, name: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/geofences/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setZones((prev) => prev.filter((z) => z.id !== id));
        showToast(`Zone "${name}" removed.`);
      }
    } catch (err) {
      showToast('Failed to delete zone.');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1060px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} color="var(--good)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Title & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeTab === 'places' ? 'Location Manager' : 'Geofence Manager'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            {activeTab === 'places'
              ? 'Manage company locations, hubs, customer terminals, and fuel stops.'
              : 'Set delivery boundaries to get notified automatically when your vehicles arrive or depart.'}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>{activeTab === 'places' ? 'Add Location' : 'Add Geofence'}</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('zones')}
          className={activeTab === 'zones' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Geofence Manager ({zones.length})
        </button>
        <button
          onClick={() => setActiveTab('places')}
          className={activeTab === 'places' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Location Manager ({places.length})
        </button>
      </div>

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading zones from database…
            </div>
          ) : zones.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No zones configured for this organization yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {zones.map((z) => {
                const activeVehicles = typeof z.activeVehicles === 'number' ? z.activeVehicles : null;
                const hasVehiclesInside = activeVehicles !== null && activeVehicles > 0;
                return (
                <div key={z.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {dash(z.name)}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                        {dash(z.type)}
                      </span>
                    </div>

                    <span className={hasVehiclesInside ? 'badge badge-good' : 'badge badge-neutral'}>
                      <span className={hasVehiclesInside ? 'status-dot status-dot-good' : 'status-dot status-dot-neutral'} />
                      <span>
                        {activeVehicles === null
                          ? '—'
                          : activeVehicles > 0
                          ? `${activeVehicles} vehicles inside`
                          : 'No vehicles inside'}
                      </span>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem', marginBottom: '16px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Speed limit:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{z.speedLimit ? `${z.speedLimit} km/h` : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Zone area:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{z.areaKm2 != null ? `${z.areaKm2} km²` : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Entry alert:</span>{' '}
                      <strong style={{ color: z.alertOnEnter ? 'var(--good)' : 'var(--text-tertiary)' }}>
                        {z.alertOnEnter ? 'On' : 'Off'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Exit alert:</span>{' '}
                      <strong style={{ color: z.alertOnExit ? 'var(--good)' : 'var(--text-tertiary)' }}>
                        {z.alertOnExit ? 'On' : 'Off'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {(z.alertOnEnter || z.alertOnExit) ? 'Entry/exit alerts enabled' : 'Alerts disabled'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => handleDeleteZone(z.id, z.name || `#${z.id}`)}
                        title="Delete zone"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => showToast(`Zone boundaries opened for editing`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit zone
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Places Tab */}
      {activeTab === 'places' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Location name</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Address</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading locations…
                  </td>
                </tr>
              ) : places.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No locations configured for this organization yet.
                  </td>
                </tr>
              ) : (
                places.map((place) => (
                  <tr key={place.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={16} color="var(--accent)" />
                        <span>{dash(place.name)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{dash(place.category)}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{dash(place.address)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => showToast(`Opening ${place.name || `location #${place.id}`} on map`)}
                        className="btn btn-secondary btn-sm"
                      >
                        View on map
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Zone Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(30, 37, 33, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              width: '100%',
              maxWidth: '480px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Add a new delivery zone
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateZone} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Zone name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dubai South Logistics District"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-family)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Speed limit inside zone
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 40"
                  value={newZone.speedLimit}
                  onChange={(e) => setNewZone({ ...newZone, speedLimit: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-family)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                  Leave blank if the zone has no speed limit.
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Zone boundary (one vertex per line as "longitude, latitude")
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={'lon, lat\nlon, lat\nlon, lat'}
                  value={newZone.coordinates}
                  onChange={(e) => setNewZone({ ...newZone, coordinates: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                  Minimum 3 vertices; the polygon is closed automatically by the server.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={newZone.alertOnEnter}
                    onChange={(e) => setNewZone({ ...newZone, alertOnEnter: e.target.checked })}
                    style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                  />
                  <span>Notify me when a vehicle enters this zone</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={newZone.alertOnExit}
                    onChange={(e) => setNewZone({ ...newZone, alertOnExit: e.target.checked })}
                    style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                  />
                  <span>Notify me when a vehicle departs this zone</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
