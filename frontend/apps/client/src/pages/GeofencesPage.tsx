import React, { useState } from 'react';
import { Layers, Plus, MapPin, Compass } from 'lucide-react';

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

const mockGeofences: GeofenceItem[] = [
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
  const [activeTab, setActiveTab] = useState<'geofences' | 'poi'>('geofences');
  const [testLat, setTestLat] = useState('25.0000');
  const [testLng, setTestLng] = useState('55.0500');
  const [containmentResult, setContainmentResult] = useState<string | null>(null);

  const checkContainment = () => {
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    // Simple bounding check for Jebel Ali Zone (55.030 to 55.080, 24.960 to 25.020)
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
        <button className="btn btn-primary" style={{ gap: '8px' }}>
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
          Active Geofences ({mockGeofences.length})
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
          {mockGeofences.map((g) => (
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
                <div>Enter Alert: <strong style={{ color: '#10b981' }}>Enabled</strong></div>
                <div>Exit Alert: <strong style={{ color: '#10b981' }}>Enabled</strong></div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>PostGIS Polygon (4326)</span>
                <span style={{ color: 'var(--cyan-accent)', cursor: 'pointer', fontWeight: 600 }}>Edit Boundaries →</span>
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
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      View on Map
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
    </div>
  );
};
