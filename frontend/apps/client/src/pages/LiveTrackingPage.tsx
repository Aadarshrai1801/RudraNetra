import React, { useEffect, useMemo } from 'react';
import { LiveMap } from '../components/map/LiveMap';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';
import { Gauge, Zap, Clock } from 'lucide-react';

export const LiveTrackingPage: React.FC = () => {
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);
  const updatePosition = useVehicleStore((state) => state.updatePosition);
  const filterStatus = useVehicleStore((state) => state.filterStatus);
  const setFilterStatus = useVehicleStore((state) => state.setFilterStatus);
  const searchQuery = useVehicleStore((state) => state.searchQuery);
  const setSearchQuery = useVehicleStore((state) => state.setSearchQuery);

  // Seed sample Dubai fleet vehicles if empty for immediate live demo
  useEffect(() => {
    if (vehiclesMap.size === 0) {
      const demoVehicles: VehiclePosition[] = [
        {
          device_id: 101,
          reg_number: 'DXB-A-98124',
          lat: 25.2048,
          lng: 55.2708,
          speed: 68.4,
          heading: 45,
          ignition: true,
          status: 'moving',
          timestamp: new Date().toISOString(),
          odometer: 142580,
          temperature: 24.5,
        },
        {
          device_id: 102,
          reg_number: 'DXB-B-43210',
          lat: 25.1972,
          lng: 55.2744,
          speed: 0,
          heading: 180,
          ignition: true,
          status: 'idle',
          timestamp: new Date().toISOString(),
          odometer: 89340,
          temperature: 22.0,
        },
        {
          device_id: 103,
          reg_number: 'AUH-C-11029',
          lat: 25.2285,
          lng: 55.3273,
          speed: 84.1,
          heading: 90,
          ignition: true,
          status: 'moving',
          timestamp: new Date().toISOString(),
          odometer: 210940,
          temperature: 26.2,
        },
        {
          device_id: 104,
          reg_number: 'SHJ-D-77123',
          lat: 25.2697,
          lng: 55.3095,
          speed: 0,
          heading: 0,
          ignition: false,
          status: 'stopped',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          odometer: 64120,
          temperature: 28.0,
        },
      ];

      demoVehicles.forEach((v) => updatePosition(v));
    }
  }, [vehiclesMap.size, updatePosition]);

  const vehicleList = useMemo(() => {
    const list = Array.from(vehiclesMap.values());
    return list.filter((v) => {
      const matchesFilter = filterStatus === 'all' || v.status === filterStatus;
      const matchesSearch =
        v.reg_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.device_id.toString().includes(searchQuery);
      return matchesFilter && matchesSearch;
    });
  }, [vehiclesMap, filterStatus, searchQuery]);

  const counts = useMemo(() => {
    let moving = 0;
    let idle = 0;
    let stopped = 0;
    vehiclesMap.forEach((v) => {
      if (v.status === 'moving') moving++;
      else if (v.status === 'idle') idle++;
      else stopped++;
    });
    return { total: vehiclesMap.size, moving, idle, stopped };
  }, [vehiclesMap]);

  return (
    <div className="map-view-container">
      {/* Floating Left Drawer */}
      <div className="glass-panel vehicle-drawer">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Fleet Tracking</h3>
            <span className="brand-badge">{counts.total} Vehicles</span>
          </div>

          {/* Quick status filter pills */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button
              onClick={() => setFilterStatus('all')}
              className="btn"
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: '0.72rem',
                backgroundColor: filterStatus === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
              }}
            >
              All ({counts.total})
            </button>
            <button
              onClick={() => setFilterStatus('moving')}
              className="btn"
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: '0.72rem',
                backgroundColor: filterStatus === 'moving' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                color: '#10b981',
                border: filterStatus === 'moving' ? '1px solid #10b981' : 'none',
              }}
            >
              Moving ({counts.moving})
            </button>
            <button
              onClick={() => setFilterStatus('idle')}
              className="btn"
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: '0.72rem',
                backgroundColor: filterStatus === 'idle' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.05)',
                color: '#f59e0b',
                border: filterStatus === 'idle' ? '1px solid #f59e0b' : 'none',
              }}
            >
              Idle ({counts.idle})
            </button>
            <button
              onClick={() => setFilterStatus('stopped')}
              className="btn"
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: '0.72rem',
                backgroundColor: filterStatus === 'stopped' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.05)',
                color: '#ef4444',
                border: filterStatus === 'stopped' ? '1px solid #ef4444' : 'none',
              }}
            >
              Stop ({counts.stopped})
            </button>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by plate number or ID..."
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {vehicleList.map((v) => {
            const isSelected = selectedDeviceId === v.device_id;
            return (
              <div
                key={v.device_id}
                onClick={() => selectVehicle(v.device_id)}
                style={{
                  background: isSelected
                    ? 'linear-gradient(90deg, rgba(2, 132, 199, 0.35) 0%, rgba(0, 242, 254, 0.15) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? 'var(--cyan-accent)' : '#fff' }}>
                    {v.reg_number}
                  </span>
                  <div className="status-indicator">
                    <span className={`dot ${v.status}`} />
                    <span style={{ color: v.status === 'moving' ? '#10b981' : v.status === 'idle' ? '#f59e0b' : '#ef4444' }}>
                      {v.status}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Gauge size={13} color="var(--text-muted)" />
                    <span>{v.speed.toFixed(1)} km/h</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={13} color={v.ignition ? '#10b981' : '#64748b'} />
                    <span>{v.ignition ? 'IGN ON' : 'IGN OFF'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} color="var(--text-muted)" />
                    <span>{new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Map */}
      <LiveMap />
    </div>
  );
};
