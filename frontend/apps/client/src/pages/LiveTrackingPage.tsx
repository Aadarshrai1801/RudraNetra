import React, { useEffect, useMemo, useState } from 'react';
import { LiveMap } from '../components/map/LiveMap';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';
import {
  Search,
  Phone,
  X,
} from 'lucide-react';

export const LiveTrackingPage: React.FC = () => {
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);
  const updatePosition = useVehicleStore((state) => state.updatePosition);
  const filterStatus = useVehicleStore((state) => state.filterStatus);
  const setFilterStatus = useVehicleStore((state) => state.setFilterStatus);
  const searchQuery = useVehicleStore((state) => state.searchQuery);
  const setSearchQuery = useVehicleStore((state) => state.setSearchQuery);

  const [expandedDetailsId, setExpandedDetailsId] = useState<number | null>(null);

  // Seed sample Dubai fleet vehicles with friendly plain-language attributes
  useEffect(() => {
    if (vehiclesMap.size === 0) {
      const demoVehicles: VehiclePosition[] = [
        {
          device_id: 101,
          reg_number: 'DXB-A-98124',
          name: 'Mercedes-Benz Actros',
          driver_name: 'Mohammed Imran',
          driver_phone: '+971 50 9988771',
          location_name: 'Sheikh Zayed Rd, near Downtown Dubai',
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
          name: 'Volvo FH16 Tractor',
          driver_name: 'Harpreet Singh',
          driver_phone: '+971 55 4433221',
          location_name: 'Al Quoz Industrial Area 3',
          lat: 25.1972,
          lng: 55.2744,
          speed: 0,
          heading: 180,
          ignition: true,
          status: 'idle',
          idle_duration_min: 25,
          timestamp: new Date().toISOString(),
          odometer: 89340,
          temperature: 22.0,
        },
        {
          device_id: 103,
          reg_number: 'AUH-C-11029',
          name: 'Isuzu Reefer Van',
          driver_name: 'Ahmed Al-Falasi',
          driver_phone: '+971 52 1122334',
          location_name: 'E11 Highway towards Abu Dhabi Mina',
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
          name: 'Toyota Hilux 4x4',
          driver_name: 'Rajesh Patel',
          driver_phone: '+971 55 9876543',
          location_name: 'Sharjah Depot Yard',
          lat: 25.2697,
          lng: 55.3095,
          speed: 0,
          heading: 0,
          ignition: false,
          status: 'stopped',
          parked_duration_min: 120,
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
      total: vehiclesMap.size || 4,
      moving: moving || 2,
      waiting: waiting || 1,
      parked: parked || 1,
    };
  }, [vehiclesMap]);

  return (
    <div className="map-view-container">
      {/* Floating Left Drawer for Dispatchers & Fleet Owners */}
      <div className="vehicle-drawer">
        {/* Drawer Header */}
        <div style={{ padding: '20px 20px 16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Your vehicles ({counts.total})
            </h2>
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
    </div>
  );
};
