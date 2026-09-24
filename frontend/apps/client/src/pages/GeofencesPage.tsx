import React, { useState, useEffect } from 'react';
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
  name: string;
  type: string;
  speedLimit: number;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  areaKm2: number;
  activeVehicles: number;
}

interface SavedPlace {
  id: number;
  name: string;
  category: string;
  address: string;
}

export const GeofencesPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'zones' | 'places'>('zones');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newZone, setNewZone] = useState({
    name: '',
    speedLimit: 40,
    alertOnEnter: true,
    alertOnExit: true,
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
    try {
      const res = await fetchWithAuth('/api/v1/geofences', {
        method: 'POST',
        body: JSON.stringify(newZone),
      });
      if (res.ok) {
        showToast(`Zone "${newZone.name}" created successfully in database.`);
        setIsCreateModalOpen(false);
        setNewZone({ name: '', speedLimit: 40, alertOnEnter: true, alertOnExit: true });
        loadData();
      } else {
        showToast('Failed to create zone.');
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
            Zones & locations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Set delivery boundaries to get notified automatically when your vehicles arrive or depart.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>Add new zone</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('zones')}
          className={activeTab === 'zones' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Delivery zones ({zones.length})
        </button>
        <button
          onClick={() => setActiveTab('places')}
          className={activeTab === 'places' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Saved places & fuel stations ({places.length})
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
              {zones.map((z) => (
                <div key={z.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {z.name}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                        {z.type}
                      </span>
                    </div>

                    <span className={z.activeVehicles > 0 ? 'badge badge-good' : 'badge badge-neutral'}>
                      <span className={z.activeVehicles > 0 ? 'status-dot status-dot-good' : 'status-dot status-dot-neutral'} />
                      <span>{z.activeVehicles > 0 ? `${z.activeVehicles} vehicles inside` : 'No vehicles inside'}</span>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem', marginBottom: '16px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Speed limit:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{z.speedLimit} km/h</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Zone area:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{z.areaKm2} km²</strong>
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
                      Automatic alerts enabled
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => handleDeleteZone(z.id, z.name)}
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
                        Edit zone →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
              {places.map((place) => (
                <tr key={place.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={16} color="var(--accent)" />
                      <span>{place.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{place.category}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{place.address}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => showToast(`Opening ${place.name} on map`)}
                      className="btn btn-secondary btn-sm"
                    >
                      View on map
                    </button>
                  </td>
                </tr>
              ))}
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
                <select
                  value={newZone.speedLimit}
                  onChange={(e) => setNewZone({ ...newZone, speedLimit: Number(e.target.value) })}
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
                >
                  <option value={20}>20 km/h (Depot / Warehouse Yard)</option>
                  <option value={30}>30 km/h (Cargo Terminal)</option>
                  <option value={40}>40 km/h (Industrial District)</option>
                  <option value={60}>60 km/h (Connecting Roads)</option>
                </select>
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
