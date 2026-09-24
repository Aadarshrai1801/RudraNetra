import React, { useState } from 'react';
import { Layers, Plus, MapPin, Compass, X, Check, Edit2, Eye } from 'lucide-react';

interface GeofenceItem {
  id: number;
  name: string;
  type: string;
  speedLimit: number;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  areaKm2: number;
  activeVehicles: number;
}

interface POIItem {
  id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
}

const initialGeofences: GeofenceItem[] = [
  {
    id: 1,
    name: 'Jebel Ali Port & Freezone',
    type: 'Polygon Zone',
    speedLimit: 40,
    alertOnEnter: true,
    alertOnExit: true,
    areaKm2: 18.4,
    activeVehicles: 2,
  },
  {
    id: 2,
    name: 'DXB Cargo Terminal Gate 4',
    type: 'Polygon Zone',
    speedLimit: 30,
    alertOnEnter: true,
    alertOnExit: true,
    areaKm2: 6.2,
    activeVehicles: 1,
  },
  {
    id: 3,
    name: 'Al Quoz Central Warehouse',
    type: 'Depot / Depot Yard',
    speedLimit: 20,
    alertOnEnter: true,
    alertOnExit: true,
    areaKm2: 2.1,
    activeVehicles: 1,
  },
];

const mockPOIs: POIItem[] = [
  { id: 1, name: 'ENOC Service Station 1042', category: 'Fuel Depot', lat: 25.142, lng: 55.235, address: 'Sheikh Zayed Rd, Exit 43' },
  { id: 2, name: 'EPPCO Depot Al Quoz', category: 'Fuel Depot', lat: 25.130, lng: 55.240, address: 'Al Asayel St, Al Quoz 3' },
  { id: 3, name: 'JAFZA Customer Service Center', category: 'Client Office', lat: 24.990, lng: 55.050, address: 'JAFZA 14 Building' },
  { id: 4, name: 'Al Maktoum Airport Freight Gate 2', category: 'Logistics Terminal', lat: 24.900, lng: 55.160, address: 'DWC Aviation City' },
];

export const GeofencesPage: React.FC = () => {
  const [geofences, setGeofences] = useState<GeofenceItem[]>(initialGeofences);
  const [activeTab, setActiveTab] = useState<'geofences' | 'poi'>('geofences');
  const [testLat, setTestLat] = useState('25.0000');
  const [testLng, setTestLng] = useState('55.0500');
  const [containmentResult, setContainmentResult] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<GeofenceItem | null>(null);
  const [viewingPOI, setViewingPOI] = useState<POIItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Geofence Form State
  const [newZone, setNewZone] = useState({
    name: '',
    type: 'Polygon Zone',
    speedLimit: 40,
    areaKm2: 5.0,
    alertOnEnter: true,
    alertOnExit: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.name) return;
    const created: GeofenceItem = {
      id: Date.now(),
      name: newZone.name,
      type: newZone.type,
      speedLimit: Number(newZone.speedLimit) || 40,
      areaKm2: Number(newZone.areaKm2) || 4.5,
      alertOnEnter: newZone.alertOnEnter,
      alertOnExit: newZone.alertOnExit,
      activeVehicles: 0,
    };
    setGeofences((prev) => [...prev, created]);
    setIsCreateModalOpen(false);
    setNewZone({
      name: '',
      type: 'Polygon Zone',
      speedLimit: 40,
      areaKm2: 5.0,
      alertOnEnter: true,
      alertOnExit: true,
    });
    showToast(`Geofence Zone "${created.name}" registered successfully.`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGeofence) return;
    setGeofences((prev) =>
      prev.map((g) => (g.id === editingGeofence.id ? editingGeofence : g))
    );
    setEditingGeofence(null);
    showToast(`Updated boundaries for "${editingGeofence.name}".`);
  };

  const checkContainment = () => {
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (lng >= 55.030 && lng <= 55.080 && lat >= 24.960 && lat <= 25.020) {
      setContainmentResult('✅ Coordinate is INSIDE "Jebel Ali Port & Freezone" (PostGIS ST_Contains matched)');
    } else {
      setContainmentResult('ℹ️ Coordinate is OUTSIDE all active geofence zones.');
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Geofences & Points of Interest</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            PostGIS spatial engine powering automatic enter/exit boundary events and proximity queries.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          style={{ gap: '8px' }}
        >
          <Plus size={16} />
          Create Geofence Zone
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('geofences')}
          className="btn"
          style={{
            background: activeTab === 'geofences' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Active Geofences ({geofences.length})
        </button>
        <button
          onClick={() => setActiveTab('poi')}
          className="btn"
          style={{
            background: activeTab === 'poi' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Points of Interest / POI ({mockPOIs.length})
        </button>
      </div>

      {/* Geofences Tab */}
      {activeTab === 'geofences' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {geofences.map((g) => (
            <div key={g.id} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(2,132,199,0.2)' }}>
                    <Layers size={20} color="var(--cyan-accent)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{g.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.type}</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(16,185,129,0.15)',
                    color: '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {g.activeVehicles} Vehicles Inside
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', marginTop: '16px' }}>
                <div>Speed Limit: <strong style={{ color: '#fff' }}>{g.speedLimit} km/h</strong></div>
                <div>Area: <strong style={{ color: '#fff' }}>{g.areaKm2} km²</strong></div>
                <div>Enter Alert: <strong style={{ color: g.alertOnEnter ? '#10b981' : '#64748b' }}>{g.alertOnEnter ? 'Enabled' : 'Disabled'}</strong></div>
                <div>Exit Alert: <strong style={{ color: g.alertOnExit ? '#10b981' : '#64748b' }}>{g.alertOnExit ? 'Enabled' : 'Disabled'}</strong></div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>PostGIS Polygon (SRID 4326)</span>
                <span
                  onClick={() => setEditingGeofence(g)}
                  style={{ color: 'var(--cyan-accent)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit2 size={12} />
                  <span>Edit Boundaries →</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POI Tab */}
      {activeTab === 'poi' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>Name</th>
                <th style={{ padding: '12px 10px' }}>Category</th>
                <th style={{ padding: '12px 10px' }}>Coordinates</th>
                <th style={{ padding: '12px 10px' }}>Address</th>
                <th style={{ padding: '12px 10px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mockPOIs.map((poi) => (
                <tr key={poi.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 10px', fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={16} color="var(--cyan-accent)" />
                      {poi.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>{poi.category}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>{poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}</td>
                  <td style={{ padding: '14px 10px', color: 'var(--text-muted)' }}>{poi.address}</td>
                  <td style={{ padding: '14px 10px' }}>
                    <button
                      onClick={() => setViewingPOI(poi)}
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                    >
                      <Eye size={12} />
                      <span>View on Map</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive PostGIS Spatial Containment Test Card */}
      <div className="glass-panel" style={{ marginTop: '24px', padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={18} color="var(--cyan-accent)" />
          PostGIS Spatial Engine Query Tester (ST_Contains)
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Test whether a given GPS point (Latitude, Longitude) falls within any of your defined PostGIS boundary polygons.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Latitude</label>
            <input
              type="text"
              value={testLat}
              onChange={(e) => setTestLat(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Longitude</label>
            <input
              type="text"
              value={testLng}
              onChange={(e) => setTestLng(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <button onClick={checkContainment} className="btn btn-primary" style={{ padding: '9px 16px', fontSize: '0.85rem' }}>
            Check Containment
          </button>
        </div>

        {containmentResult && (
          <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid var(--border-accent)', fontSize: '0.85rem', color: '#fff' }}>
            {containmentResult}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '56px',
            right: '24px',
            zIndex: 1000,
            background: 'var(--bg-raised)',
            border: '1px solid var(--signal-green)',
            color: 'var(--text-primary)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ width: '6px', height: '6px', background: 'var(--signal-green)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Create Geofence Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(500px, 95vw)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                  Create Geofence Zone
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleCreateZone} style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dubai South Logistics Hub"
                    value={newZone.name}
                    onChange={(e) => setNewZone((prev) => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--line)',
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Zone Classification
                    </label>
                    <select
                      value={newZone.type}
                      onChange={(e) => setNewZone((prev) => ({ ...prev, type: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    >
                      <option value="Polygon Zone">Polygon Zone</option>
                      <option value="Depot / Depot Yard">Depot / Yard</option>
                      <option value="Port & Customs">Port & Customs</option>
                      <option value="Restricted Zone">Restricted Zone</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Speed Limit (km/h)
                    </label>
                    <input
                      type="number"
                      value={newZone.speedLimit}
                      onChange={(e) => setNewZone((prev) => ({ ...prev, speedLimit: Number(e.target.value) }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newZone.alertOnEnter}
                      onChange={(e) => setNewZone((prev) => ({ ...prev, alertOnEnter: e.target.checked }))}
                      style={{ accentColor: 'var(--signal-amber)' }}
                    />
                    Alert on Entry
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newZone.alertOnExit}
                      onChange={(e) => setNewZone((prev) => ({ ...prev, alertOnExit: e.target.checked }))}
                      style={{ accentColor: 'var(--signal-amber)' }}
                    />
                    Alert on Exit
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-ghost" style={{ padding: '6px 14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 18px', gap: '6px' }}>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Save Geofence</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Boundaries Modal */}
      {editingGeofence && (
        <div className="modal-overlay" onClick={() => setEditingGeofence(null)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(500px, 95vw)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                  Edit Boundary: {editingGeofence.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingGeofence(null)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Zone Label
                  </label>
                  <input
                    type="text"
                    value={editingGeofence.name}
                    onChange={(e) => setEditingGeofence({ ...editingGeofence, name: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--line)',
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Speed Limit (km/h)
                    </label>
                    <input
                      type="number"
                      value={editingGeofence.speedLimit}
                      onChange={(e) => setEditingGeofence({ ...editingGeofence, speedLimit: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Enclosed Area (km²)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingGeofence.areaKm2}
                      onChange={(e) => setEditingGeofence({ ...editingGeofence, areaKm2: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                <button type="button" onClick={() => setEditingGeofence(null)} className="btn btn-ghost" style={{ padding: '6px 14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 18px', gap: '6px' }}>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Update Polygon</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POI View on Map Modal */}
      {viewingPOI && (
        <div className="modal-overlay" onClick={() => setViewingPOI(null)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(460px, 95vw)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                  POI: {viewingPOI.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingPOI(null)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
              <div>Category: <strong style={{ color: 'var(--signal-amber)' }}>{viewingPOI.category}</strong></div>
              <div>Coordinates: <span className="mono-num" style={{ color: 'var(--text-primary)' }}>{viewingPOI.lat.toFixed(4)}°N, {viewingPOI.lng.toFixed(4)}°E</span></div>
              <div>Address: <span style={{ color: 'var(--text-muted)' }}>{viewingPOI.address}</span></div>
              <div style={{ padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--line)', color: 'var(--signal-green)' }}>
                Spatial Index GIST matched. Proximity radius: 500m.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => setViewingPOI(null)} className="btn btn-primary" style={{ padding: '6px 16px' }}>
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
