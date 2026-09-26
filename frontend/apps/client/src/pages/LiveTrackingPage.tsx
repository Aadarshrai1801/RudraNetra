import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveMap } from '../components/map/LiveMap';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';
import {
  Search,
  X,
  Snowflake,
  MapPin,
  ShieldAlert,
  Play,
  Square,
  Navigation,
  Activity,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import { TeltonikaDetailsModal } from '../components/vehicle/TeltonikaDetailsModal';

interface PoiOption {
  id: number;
  name: string;
  category?: string;
  address?: string;
  lat: number;
  lng: number;
}

interface NearestVehicleResult extends VehiclePosition {
  distKm: number;
  etaMin?: string;
}

export const LiveTrackingPage: React.FC<{ initialAction?: string }> = ({ initialAction }) => {
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

  const navigate = useNavigate();
  const [expandedDetailsId, setExpandedDetailsId] = useState<number | null>(null);
  const [frozenMap, setFrozenMap] = useState<Record<number, boolean>>({});
  const [nearestModal, setNearestModal] = useState<{ open: boolean; vehicle: any; pois: any[] }>({ open: false, vehicle: null, pois: [] });
  const [findNearestVehicleModal, setFindNearestVehicleModal] = useState<{ open: boolean; targetPoint: string; results: NearestVehicleResult[] }>({ open: false, targetPoint: '', results: [] });
  const [poiOptions, setPoiOptions] = useState<PoiOption[]>([]);
  const [isLoadingPois, setIsLoadingPois] = useState(false);
  const [selectedTeltonikaVehicle, setSelectedTeltonikaVehicle] = useState<any | null>(null);
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const initialActionHandledRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const firstVehicleWithPosition = (): VehiclePosition | undefined =>
    Array.from(vehiclesMap.values()).find(
      (v) => typeof v.lat === 'number' && typeof v.lng === 'number'
    );

  useEffect(() => {
    if (initialActionHandledRef.current) return;
    if (initialAction === 'find-nearest') {
      initialActionHandledRef.current = true;
      handleOpenFindNearestVehicle();
    } else if (initialAction === 'nearest-places') {
      const first = firstVehicleWithPosition();
      if (first) {
        initialActionHandledRef.current = true;
        openNearestAmenities(first);
      }
    } else if (window.location.search.includes('modal=teltonika')) {
      const first = firstVehicleWithPosition();
      if (first) {
        initialActionHandledRef.current = true;
        setSelectedTeltonikaVehicle(first);
      }
    }
  }, [initialAction, vehiclesMap]);

  const toggleFreeze = (deviceId: number, reg: string) => {
    const isNowFrozen = !frozenMap[deviceId];
    setFrozenMap((prev) => ({ ...prev, [deviceId]: isNowFrozen }));
    // Local display highlight only; immobilizer commands are issued from the Control Panel.
    showToast(isNowFrozen ? `Freeze highlight enabled for ${reg}.` : `Freeze highlight disabled for ${reg}.`);
  };

  const openNearestAmenities = async (vehicle: VehiclePosition) => {
    // No real GPS position means the nearest-POI feature is unavailable.
    if (typeof vehicle.lat !== 'number' || typeof vehicle.lng !== 'number') {
      return;
    }
    setIsLoadingPois(true);
    try {
      const res = await fetchWithAuth(`/api/v1/poi/nearest?lat=${vehicle.lat}&lng=${vehicle.lng}`);
      const json = res.ok ? await res.json() : null;
      setNearestModal({
        open: true,
        vehicle,
        pois: json && Array.isArray(json.data) ? json.data : [],
      });
    } catch (e) {
      console.warn('Failed to load nearest places', e);
      setNearestModal({ open: true, vehicle, pois: [] });
    } finally {
      setIsLoadingPois(false);
    }
  };

  const rankVehiclesToTarget = (targetLat: number, targetLng: number): NearestVehicleResult[] => {
    const cosLat = Math.cos(targetLat * (Math.PI / 180));
    return Array.from(vehiclesMap.values())
      .filter(
        (v): v is VehiclePosition & { lat: number; lng: number } =>
          typeof v.lat === 'number' && typeof v.lng === 'number'
      )
      .map((v) => {
        const dLat = (v.lat - targetLat) * 111;
        const dLng = (v.lng - targetLng) * 111 * cosLat;
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
        const etaMin =
          typeof v.speed === 'number' && v.speed > 0
            ? (distKm / v.speed * 60).toFixed(0)
            : undefined;
        return {
          ...v,
          distKm: Number(distKm.toFixed(1)),
          etaMin,
        };
      })
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 6);
  };

  const handleOpenFindNearestVehicle = async () => {
    setFindNearestVehicleModal({ open: true, targetPoint: '', results: [] });
    setIsLoadingPois(true);
    try {
      const res = await fetchWithAuth('/api/v1/poi');
      const json = res.ok ? await res.json() : null;
      const list: PoiOption[] =
        json && Array.isArray(json.data)
          ? json.data.filter(
              (p: any) => typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lng === 'number'
            )
          : [];
      setPoiOptions(list);
    } catch (e) {
      console.warn('Failed to load registered places', e);
      setPoiOptions([]);
    } finally {
      setIsLoadingPois(false);
    }
  };

  const handleSelectTargetPoint = (targetPoint: string) => {
    const poi = poiOptions.find((p) => p.name === targetPoint);
    if (!poi) {
      setFindNearestVehicleModal((prev) => ({ ...prev, targetPoint, results: [] }));
      return;
    }
    setFindNearestVehicleModal({
      open: true,
      targetPoint,
      results: rankVehiclesToTarget(poi.lat, poi.lng),
    });
  };

  // Load organization-scoped fleet vehicles using the stored session only.
  // A 15s poll is kept as a fallback for when the WebSocket is unavailable.
  useEffect(() => {
    if (token && user?.company_id !== undefined && user?.company_id !== null) {
      fetchVehicles(token, user.company_id);
      const interval = setInterval(() => {
        fetchVehicles(token, user.company_id);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [token, user?.company_id, fetchVehicles]);

  // Helper to format authentic database timestamp
  const formatDatabaseTime = (ts?: string) => {
    if (!ts) return '—';
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return ts;
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${day}/${month}/${year} ${timeStr}`;
  };

  // Status counts derived strictly from the vehicles returned by the API
  const counts = useMemo(() => {
    let moving = 0;
    let waiting = 0;
    let parked = 0;
    let freezer = 0;
    let active = 0;
    let inactive = 0;

    vehiclesMap.forEach((v) => {
      if (v.status === 'moving') moving++;
      else if (v.status === 'idle') waiting++;
      else if (v.status === 'stopped' || v.status === 'offline') parked++;

      if (v.temperature !== undefined && v.temperature !== null) {
        freezer++;
      }
      // Active means the device is reporting now: the API sets `online` when a
      // position arrived within the last 15 minutes (status stays last known).
      if (v.online === true) active++;
      else inactive++;
    });

    return {
      total: vehiclesMap.size,
      active, // Real active device count (0 if no live data streaming)
      inactive,
      freezer,
      moving,
      waiting,
      idle: waiting,
      parked,
      stopped: parked,
    };
  }, [vehiclesMap]);

  const vehicleList = useMemo(() => {
    const list = Array.from(vehiclesMap.values());
    return list.filter((v) => {
      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'moving' && v.status === 'moving') ||
        (filterStatus === 'waiting' && v.status === 'idle') ||
        (filterStatus === 'idle' && v.status === 'idle') ||
        (filterStatus === 'parked' && (v.status === 'stopped' || v.status === 'offline')) ||
        (filterStatus === 'stopped' && (v.status === 'stopped' || v.status === 'offline')) ||
        (filterStatus === 'freezer' && (v.temperature !== undefined && v.temperature !== null)) ||
        (filterStatus === 'active' && v.online === true) ||
        (filterStatus === 'inactive' && v.online !== true);

      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (v.reg_number || '').toLowerCase().includes(query) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(query)) ||
        (v.name && v.name.toLowerCase().includes(query)) ||
        v.device_id.toString().includes(searchQuery);

      return matchesFilter && matchesSearch;
    });
  }, [vehiclesMap, filterStatus, searchQuery]);

  return (
    <div className="map-view-container">
      {/* Floating Left Drawer for Dispatchers & Fleet Owners (Screenshot 1 & 2 integration) */}
      <div className="vehicle-drawer" style={{ width: '420px', maxWidth: 'calc(100vw - 32px)' }}>
        {/* Drawer Header */}
        <div style={{ padding: '14px 16px 10px 16px', borderBottom: '1px solid var(--border)' }}>
          {/* Row 1: Company Name & Streaming Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {user?.company_name || '—'} ({counts.total})
              </h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: 600 }}>
                Live GPS Telematics
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isTrackingActive ? '● Streaming' : '⏸ Paused'}
            </span>
          </div>

          {/* Row 2: Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-page)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              marginBottom: '10px',
            }}
          >
            <Search size={14} color="var(--text-secondary)" />
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
                fontSize: '0.84rem',
                fontFamily: 'var(--font-family)',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Row 3: Track / Stop Tracking Action Controls & Quick Modals */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setIsTrackingActive(true);
                showToast('Live tracking stream active.');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: isTrackingActive ? '#15803D' : '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Play size={11} fill="#FFFFFF" />
              <span>Track</span>
            </button>

            <button
              onClick={() => {
                setIsTrackingActive(false);
                showToast('Live tracking paused.');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: !isTrackingActive ? '#374151' : '#4B5563',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Square size={10} fill="#FFFFFF" />
              <span>Stop Tracking</span>
            </button>

            <button
              onClick={handleOpenFindNearestVehicle}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.74rem', padding: '4px 10px', gap: '5px', marginLeft: 'auto' }}
              title="Find closest fleet vehicle to destination"
            >
              <Navigation size={11} color="var(--accent)" />
              <span>Find Nearest Vehicle</span>
            </button>
          </div>

          {/* Row 4: Status Filter Pills (First Image Thing) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              overflowX: 'auto',
              paddingBottom: '3px',
              scrollbarWidth: 'none',
            }}
          >
            {[
              { id: 'all', label: 'All', count: counts.total, bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC' },
              { id: 'active', label: 'Active', count: counts.active, bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' },
              { id: 'inactive', label: 'Inactive', count: counts.inactive, bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
              { id: 'freezer', label: 'Freezer', count: counts.freezer, bg: '#CFFAFE', color: '#0E7490', border: '#67E8F9' },
              { id: 'moving', label: 'Moving', count: counts.moving, bg: '#D1FAE5', color: '#047857', border: '#6EE7B7' },
              { id: 'stopped', label: 'Stopped', count: counts.stopped, bg: '#FEE2E2', color: '#B91C1C', border: '#F87171' },
              { id: 'idle', label: 'Idle', count: counts.idle, bg: '#FEF9C3', color: '#A16207', border: '#FDE047' },
            ].map((tab) => {
              const isSelected = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 7px',
                    borderRadius: '4px',
                    background: isSelected ? tab.bg : '#F8FAFC',
                    border: isSelected ? `2px solid ${tab.color}` : `1px solid ${tab.border}`,
                    color: isSelected ? tab.color : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ cursor: 'pointer', pointerEvents: 'none', margin: 0 }}
                  />
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: 'rgba(0,0,0,0.06)',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legacy Table Column Header Strip (Screenshot 1: VEHICLE | DATE TIME | FUEL | TEMP | SPEED | LOCATION) */}
        <div
          style={{
            background: 'var(--accent)',
            color: '#FFFFFF',
            padding: '7px 14px',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            display: 'flex',
            justifyContent: 'space-between',
            textTransform: 'uppercase',
          }}
        >
          <span>VEHICLE & DRIVER</span>
          <span>TELEMETRY (KM/H • TEMP)</span>
        </div>

        {/* Vehicle List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {vehicleList.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No vehicles match your search
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '12px' }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            vehicleList.map((v) => {
              const isSelected = selectedDeviceId === v.device_id;
              const isExpanded = expandedDetailsId === v.device_id;

              const statusColor =
                v.status === 'moving'
                  ? '#22C55E'
                  : v.status === 'idle'
                  ? '#EAB308'
                  : v.status === 'offline'
                  ? '#94A3B8'
                  : v.status === 'stopped'
                  ? '#EF4444'
                  : 'var(--text-tertiary)';

              const statusText =
                v.status === 'moving'
                  ? 'Moving'
                  : v.status === 'idle'
                  ? 'Idle'
                  : v.status === 'offline'
                  ? 'Offline'
                  : v.status === 'stopped'
                  ? 'Stopped'
                  : '—';

              return (
                <div
                  key={v.device_id}
                  onClick={() => {
                    selectVehicle(v.device_id);
                    setExpandedDetailsId(isExpanded ? null : v.device_id);
                  }}
                  style={{
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-card)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Top Row: Plate & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: statusColor,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {v.reg_number}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {v.name || '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="tabular-num" style={{ fontWeight: 700, fontSize: '0.85rem', color: typeof v.speed === 'number' && v.speed > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {typeof v.speed === 'number' ? `${Math.round(v.speed)} km/h` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Driver & Telemetry Indicators */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>{v.driver_name || '—'}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {v.temperature !== undefined && v.temperature !== null && (
                        <span
                          style={{
                            fontWeight: 700,
                            color: v.temperature < 0 ? '#0284C7' : '#EA580C',
                            background: v.temperature < 0 ? '#E0F2FE' : '#FFEDD5',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '0.72rem',
                          }}
                        >
                          {v.temperature.toFixed(1)}°C
                        </span>
                      )}
                      <span style={{ color: statusColor, fontWeight: 600 }}>{statusText}</span>
                    </div>
                  </div>

                  {/* Location & Expand */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', maxWidth: '240px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.location_name || '—'}
                      </span>
                      {v.timestamp && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={10} />
                          <span>{formatDatabaseTime(v.timestamp)}</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTeltonikaVehicle(v);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        padding: '2px 4px',
                      }}
                      title="View Teltonika Telemetry & Transmission Logs"
                    >
                      More
                    </button>
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFreeze(v.device_id, v.reg_number);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                        >
                          <Snowflake size={12} color={frozenMap[v.device_id] ? '#0284C7' : 'inherit'} />
                          <span>{frozenMap[v.device_id] ? 'Defrost' : 'Freeze'}</span>
                        </button>
                        {typeof v.lat === 'number' && typeof v.lng === 'number' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openNearestAmenities(v);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                          >
                            <MapPin size={12} />
                            <span>Nearest</span>
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeltonikaVehicle(v);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{
                          width: '100%',
                          padding: '5px',
                          fontSize: '0.78rem',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <Activity size={13} color="var(--accent)" />
                        <span>Teltonika Telemetry & Device Logs</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/control-panel');
                        }}
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          padding: '5px',
                          fontSize: '0.78rem',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#DC2626',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        <ShieldAlert size={13} />
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

      {/* Find Nearest Amenities Modal (Show Nearest Places) */}
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  Show Nearest Places · {nearestModal.vehicle.reg_number}
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
                  {isLoadingPois ? 'Loading registered places…' : 'No registered places found nearby.'}
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
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{poi.name || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {[poi.category, poi.address].filter(Boolean).join(' • ') || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent)' }}>
                        {poi.distanceKm !== undefined && poi.distanceKm !== null ? `${poi.distanceKm} KM` : '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Find Nearest Vehicle Modal (Screenshot 2 item) */}
      {findNearestVehicleModal.open && (
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
          <div className="card" style={{ width: '100%', maxWidth: '580px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={20} color="var(--accent)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  Find Nearest Vehicle to Site
                </h3>
              </div>
              <button
                onClick={() => setFindNearestVehicleModal({ open: false, targetPoint: '', results: [] })}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                Target Delivery Destination / Landmark:
              </label>
              <input
                type="text"
                list="find-nearest-poi-options"
                value={findNearestVehicleModal.targetPoint}
                onChange={(e) => handleSelectTargetPoint(e.target.value)}
                placeholder={poiOptions.length > 0 ? 'Select a registered place' : 'No registered places'}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                }}
              />
              <datalist id="find-nearest-poi-options">
                {poiOptions.map((poi) => (
                  <option key={poi.id} value={poi.name} />
                ))}
              </datalist>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                {isLoadingPois
                  ? 'Loading registered places…'
                  : poiOptions.length === 0
                  ? 'No places registered. Add locations under Location Manager first.'
                  : 'Distances are measured from the selected registered place.'}
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Top 6 Closest Units in Fleet:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {findNearestVehicleModal.results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '18px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  Select a registered destination to rank the fleet.
                </div>
              ) : (
                findNearestVehicleModal.results.map((v, idx) => (
                  <div
                    key={v.device_id}
                    style={{
                      padding: '10px 14px',
                      background: idx === 0 ? 'rgba(47, 111, 109, 0.08)' : 'var(--bg-subtle)',
                      border: idx === 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {v.reg_number || '—'}
                        </span>
                        {idx === 0 && <span className="badge badge-good" style={{ fontSize: '0.72rem' }}>Closest Unit</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {v.name || '—'} · Driver: {v.driver_name || '—'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent)' }}>
                        {v.distKm} KM
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {v.etaMin !== undefined ? `~${v.etaMin} min ETA` : '—'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setFindNearestVehicleModal({ open: false, targetPoint: '', results: [] })}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teltonika Device Telemetry & Transmission Logs Modal */}
      {selectedTeltonikaVehicle && (
        <TeltonikaDetailsModal
          vehicle={selectedTeltonikaVehicle}
          onClose={() => setSelectedTeltonikaVehicle(null)}
        />
      )}

      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 9999,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default LiveTrackingPage;
