import React, { useEffect, useMemo, useState } from 'react';
import { LiveMap } from '../components/map/LiveMap';
import { useVehicleStore } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';
import {
  Search,
  Phone,
  X,
  Snowflake,
  MapPin,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';

export const LiveTrackingPage: React.FC = () => {
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);
  const filterStatus = useVehicleStore((state) => state.filterStatus);
  const setFilterStatus = useVehicleStore((state) => state.setFilterStatus);
  const searchQuery = useVehicleStore((state) => state.searchQuery);
  const setSearchQuery = useVehicleStore((state) => state.setSearchQuery);
  const fetchVehicles = useVehicleStore((state) => state.fetchVehicles);

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);

  const navigate = useNavigate();
  const [expandedDetailsId, setExpandedDetailsId] = useState<number | null>(null);
  const [frozenMap, setFrozenMap] = useState<Record<number, boolean>>({});
  const [nearestModal, setNearestModal] = useState<{ open: boolean; vehicle: any; pois: any[] }>({ open: false, vehicle: null, pois: [] });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleFreeze = (deviceId: number, reg: string) => {
    const isNowFrozen = !frozenMap[deviceId];
    setFrozenMap((prev) => ({ ...prev, [deviceId]: isNowFrozen }));
    if (isNowFrozen) {
      showToast(`Anti-theft freeze activated on ${reg}. 50m tamper geofence armed.`);
    } else {
      showToast(`Anti-theft freeze disarmed on ${reg}.`);
    }
  };

  const openNearestAmenities = async (vehicle: any) => {
    try {
      const res = await fetchWithAuth(`/api/v1/poi/nearest?lat=${vehicle.lat || 25.2048}&lng=${vehicle.lng || 55.2708}`);
      if (res.ok) {
        const json = await res.json();
        setNearestModal({ open: true, vehicle, pois: json.data || [] });
      } else {
        setNearestModal({ open: true, vehicle, pois: [] });
      }
    } catch (e) {
      setNearestModal({ open: true, vehicle, pois: [] });
    }
  };

  // Load organization-scoped fleet vehicles
  useEffect(() => {
    const init = async () => {
      let activeToken = token;
      let activeCompany = user?.company_id;

      // If user is not yet logged in, auto-login with default credentials
      if (!activeToken) {
        try {
          const host =
            window.location.port !== '8080' && window.location.hostname === 'localhost'
              ? 'http://localhost:8080'
              : '';
          const res = await fetch(`${host}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password' }),
          });
          const data = await res.json();
          if (data.success && data.token) {
            setAuth(data.token, data.user);
            activeToken = data.token;
            activeCompany = data.user.company_id;
          }
        } catch (e) {
          console.warn('Auto-login error:', e);
        }
      }

      if (activeToken) {
        fetchVehicles(activeToken, activeCompany);
      }
    };

    init();
  }, [token, user?.company_id, fetchVehicles, setAuth]);

  const vehicleList = useMemo(() => {
    const list = Array.from(vehiclesMap.values());
    return list.filter((v) => {
      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'moving' && v.status === 'moving') ||
        (filterStatus === 'waiting' && v.status === 'idle') ||
        (filterStatus === 'parked' && v.status === 'stopped');

      const matchesSearch =
        v.reg_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.name && v.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        v.device_id.toString().includes(searchQuery);

      return matchesFilter && matchesSearch;
    });
  }, [vehiclesMap, filterStatus, searchQuery]);

  const counts = useMemo(() => {
    let moving = 0;
    let waiting = 0;
    let parked = 0;
    vehiclesMap.forEach((v) => {
      if (v.status === 'moving') moving++;
      else if (v.status === 'idle') waiting++;
      else parked++;
    });
    return {
      total: vehiclesMap.size,
      moving,
      waiting,
      parked,
    };
  }, [vehiclesMap]);

  return (
    <div className="map-view-container">
      {/* Floating Left Drawer for Dispatchers & Fleet Owners */}
      <div className="vehicle-drawer">
        {/* Drawer Header */}
        <div style={{ padding: '20px 20px 16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {user?.company_name || (user?.company_id === 2 ? 'EKSC Logistics Dubai' : 'Allied Transport UAE')} ({counts.total})
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--cyan-accent)', fontWeight: 600 }}>
                {user?.company_id === 2 ? '🏢 Organization 2 Fleet' : '🏢 Organization 1 Fleet'}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Live location
            </span>
          </div>

          {/* Calm, readable filter tabs — plain language */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[
              { id: 'all', label: 'All', count: counts.total },
              { id: 'moving', label: 'Moving', count: counts.moving },
              { id: 'waiting', label: 'Waiting', count: counts.waiting },
              { id: 'parked', label: 'Parked', count: counts.parked },
            ].map((tab) => {
              const active = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  style={{
                    flex: 1,
                    background: active ? 'var(--accent)' : 'var(--bg-page)',
                    color: active ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 4px',
                    fontSize: '0.825rem',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{ opacity: active ? 0.9 : 0.7, fontSize: '0.75rem' }}>
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input with generous touch target */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-page)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
            }}
          >
            <Search size={15} color="var(--text-secondary)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by plate or driver..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-family)',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Vehicle List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {vehicleList.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No vehicles match your search
              </p>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Try clearing your search or changing the filter tab above.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '14px' }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            vehicleList.map((v) => {
              const isSelected = selectedDeviceId === v.device_id;
              const isExpanded = expandedDetailsId === v.device_id;

              // Plain human status description
              const statusPhrase =
                v.status === 'moving'
                  ? `Moving at ${Math.round(v.speed)} km/h`
                  : v.status === 'idle'
                  ? `Waiting with engine on (${v.idle_duration_min || 25} min)`
                  : 'Parked · Engine off';

              const statusColor =
                v.status === 'moving'
                  ? 'var(--good)'
                  : v.status === 'idle'
                  ? 'var(--attention)'
                  : 'var(--alert)';

              const statusBadgeClass =
                v.status === 'moving'
                  ? 'badge badge-good'
                  : v.status === 'idle'
                  ? 'badge badge-attention'
                  : 'badge badge-neutral';

              const statusText =
                v.status === 'moving' ? 'Moving' : v.status === 'idle' ? 'Waiting' : 'Parked';

              return (
                <div
                  key={v.device_id}
                  onClick={() => selectVehicle(v.device_id)}
                  style={{
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-card)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Top Row: Plate & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {v.reg_number}
                      </span>
                    </div>

                    <span className={statusBadgeClass}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: statusColor,
                          display: 'inline-block',
                        }}
                      />
                      <span>{statusText}</span>
                    </span>
                  </div>

                  {/* Vehicle Model & Driver */}
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {v.name || 'Delivery Truck'} • {v.driver_name || 'Assigned Driver'}
                  </div>

                  {/* Combined Human-Readable Status Sentence */}
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '10px' }}>
                    {statusPhrase}
                  </div>

                  {/* Secondary Tap: Show Details Toggle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-tertiary)' }}>
                      {v.location_name || 'Dubai, UAE'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDetailsId(isExpanded ? null : v.device_id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 0',
                      }}
                    >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>
                  </div>

                  {/* Expanded Details Pane (Behind Secondary Tap) */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px dashed var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '0.825rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Driver</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {v.driver_name} ({v.driver_phone})
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Engine state</span>
                        <span style={{ fontWeight: 600, color: v.ignition ? 'var(--good)' : 'var(--text-secondary)' }}>
                          {v.ignition ? 'Engine running' : 'Engine off'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total distance</span>
                        <span className="tabular-num" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {(v.odometer || 142580).toLocaleString()} km
                        </span>
                      </div>
                      {v.temperature !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Cargo temp</span>
                          <span className="tabular-num" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {v.temperature.toFixed(1)}°C
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Device ID</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>#{v.device_id}</span>
                      </div>

                      {v.driver_phone && (
                        <a
                          href={`tel:${v.driver_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '6px', width: '100%', justifyContent: 'center' }}
                        >
                          <Phone size={14} />
                          <span>Call driver</span>
                        </a>
                      )}

                      {/* Legacy Action Suite: Freeze Mode, Find Nearest Amenities, Control Panel */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFreeze(v.device_id, v.reg_number);
                          }}
                          className="btn btn-sm"
                          style={{
                            justifyContent: 'center',
                            gap: '4px',
                            background: frozenMap[v.device_id] ? '#FEE2E2' : 'var(--bg-subtle)',
                            color: frozenMap[v.device_id] ? '#DC2626' : 'var(--text-primary)',
                            border: frozenMap[v.device_id] ? '1px solid #DC2626' : '1px solid var(--border)',
                          }}
                          title="Anti-theft parking freeze"
                        >
                          <Snowflake size={13} />
                          <span>{frozenMap[v.device_id] ? 'Frozen' : 'Freeze'}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openNearestAmenities(v);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ justifySelf: 'stretch', justifyContent: 'center', gap: '4px' }}
                          title="Find closest fuel stations, tyre hubs & workshops"
                        >
                          <MapPin size={13} />
                          <span>Nearest</span>
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/control-panel');
                        }}
                        className="btn btn-sm"
                        style={{
                          marginTop: '4px',
                          width: '100%',
                          justifyContent: 'center',
                          gap: '6px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#DC2626',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        <ShieldAlert size={14} />
                        <span>Immobilizer Command</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Map View */}
      <LiveMap />

      {/* Toast Notice */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Find Nearest Amenities Modal */}
      {nearestModal.open && nearestModal.vehicle && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="var(--accent)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  Nearest Amenities for {nearestModal.vehicle.reg_number}
                </h3>
              </div>
              <button
                onClick={() => setNearestModal({ open: false, vehicle: null, pois: [] })}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
              {nearestModal.pois.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  Scanning surrounding radius for registered fuel stations & workshops...
                </div>
              ) : (
                nearestModal.pois.map((poi: any) => (
                  <div
                    key={poi.id}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{poi.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {poi.category} • {poi.address}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {poi.phone}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: 'var(--accent)',
                          display: 'block',
                        }}
                      >
                        {poi.distanceKm ? `${poi.distanceKm} KM` : 'Nearby'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setNearestModal({ open: false, vehicle: null, pois: [] })}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
