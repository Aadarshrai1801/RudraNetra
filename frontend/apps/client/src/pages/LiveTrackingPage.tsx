import React, { useEffect, useMemo } from 'react';
import { LiveMap } from '../components/map/LiveMap';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';

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
    return {
      total: vehiclesMap.size || 4,
      moving: moving || 2,
      idle: idle || 1,
      stopped: stopped || 1,
    };
  }, [vehiclesMap]);

  return (
    <div className="map-view-container">
      {/* Fleet Operations Left Drawer */}
      <div className="vehicle-drawer">
        {/* Panel Header */}
        <div style={{ padding: '12px 14px 0 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Active Telemetry
            </span>
            <span className="mono-num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {counts.total.toString().padStart(2, '0')} UNITS
            </span>
          </div>

          {/* Underline-style Filter Tabs (No rounded pills) */}
          <div style={{ display: 'flex', gap: '14px', borderBottom: '1px solid var(--line)', marginBottom: '8px' }}>
            {[
              { id: 'all', label: 'ALL', count: counts.total },
              { id: 'moving', label: 'MOVING', count: counts.moving },
              { id: 'idle', label: 'IDLE', count: counts.idle },
              { id: 'stopped', label: 'STOP', count: counts.stopped },
            ].map((tab) => {
              const active = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id as any)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--signal-amber)' : '2px solid transparent',
                    padding: '4px 0 6px 0',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="mono-num" style={{ fontSize: '0.68rem', color: active ? 'var(--signal-amber)' : 'var(--text-muted)' }}>
                    [{tab.count.toString().padStart(2, '0')}]
                  </span>
                </button>
              );
            })}
          </div>

          {/* Flush Inline Search Input */}
          <div style={{ padding: '4px 0 10px 0' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter plate or ID..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--line)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                padding: '4px 0',
              }}
            />
          </div>
        </div>

        {/* Dense Vehicle Rows with Mini-Column Layout */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {vehicleList.map((v) => {
            const isSelected = selectedDeviceId === v.device_id;
            const statusColor =
              v.status === 'moving'
                ? 'var(--signal-green)'
                : v.status === 'idle'
                ? 'var(--signal-blue)'
                : 'var(--signal-red)';

            const statusGlyph =
              v.status === 'moving' ? '▲' : v.status === 'idle' ? '❚❚' : '■';

            return (
              <div
                key={v.device_id}
                onClick={() => selectVehicle(v.device_id)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--line)',
                  borderLeft: isSelected ? '2px solid var(--signal-amber)' : '2px solid transparent',
                  background: isSelected ? 'var(--bg-raised)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s ease',
                }}
              >
                {/* Top Row: Plate & Speed */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      letterSpacing: '-0.01em',
                      color: isSelected ? 'var(--signal-amber)' : 'var(--text-primary)',
                    }}
                  >
                    {v.reg_number}
                  </span>
                  <span
                    className="mono-num-right"
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: v.speed > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {v.speed.toFixed(1)} km/h
                  </span>
                </div>

                {/* Bottom Row: Redundant Status (Glyph + Label + Desaturated Color) & Ignition / Timestamp */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Status: Icon Glyph + Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '9px', color: statusColor }}>
                      {statusGlyph}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: statusColor,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {v.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Telemetry Mini-Columns: Monospace right-aligned */}
                  <div
                    className="mono-num-right"
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <span style={{ color: v.ignition ? 'var(--signal-green)' : 'var(--text-muted)' }}>
                      {v.ignition ? 'IGN:ON' : 'IGN:OFF'}
                    </span>
                    <span>
                      {new Date(v.timestamp).toLocaleTimeString('en-GB', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Bleed Operations Canvas */}
      <LiveMap />
    </div>
  );
};
