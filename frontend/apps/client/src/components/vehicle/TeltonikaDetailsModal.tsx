import React, { useState, useMemo } from 'react';
import {
  X,
  Gauge,
  Thermometer,
  Fuel,
  BatteryCharging,
  Cpu,
  Radio,
  Satellite,
  Download,
  Clock,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Shield,
  Search,
} from 'lucide-react';

interface TeltonikaDetailsModalProps {
  vehicle: any | null;
  onClose: () => void;
  initialTab?: 'logs' | 'parameters';
}

interface MinuteLogRecord {
  id: number;
  timeStr: string;
  dateStr: string;
  speed: number;
  temp: number;
  fuelPct: number;
  fuelLiters: number;
  extBattery: number;
  backupBattery: number;
  ignition: 'ON' | 'OFF';
  door: 'Closed' | 'Open';
  lat: number;
  lng: number;
  trigger: string;
  status: 'normal' | 'warning' | 'alert';
}

export const TeltonikaDetailsModal: React.FC<TeltonikaDetailsModalProps> = ({
  vehicle,
  onClose,
  initialTab = 'logs',
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'parameters'>(initialTab);
  const [logFilterQuery, setLogFilterQuery] = useState('');
  const [selectedIntervalRange, setSelectedIntervalRange] = useState<15 | 30 | 60>(60);
  const [liveStreamActive, setLiveStreamActive] = useState(true);

  // Generate 60 minute-by-minute records for the last 60 minutes
  const logs = useMemo<MinuteLogRecord[]>(() => {
    if (!vehicle) return [];

    const now = Date.now();
    const isMoving = vehicle.status === 'moving';
    const isIdle = vehicle.status === 'idle';
    const baseSpeed = typeof vehicle.speed === 'number' ? vehicle.speed : isMoving ? 55 : 0;
    const baseTemp =
      vehicle.temperature !== undefined && vehicle.temperature !== null
        ? vehicle.temperature
        : -18.2;
    const baseLat = vehicle.lat || 25.2048;
    const baseLng = vehicle.lng || 55.2708;
    const baseFuel = 74.5;

    const records: MinuteLogRecord[] = [];

    for (let i = 0; i < 60; i++) {
      const recordTime = new Date(now - i * 60 * 1000);
      const hours = String(recordTime.getHours()).padStart(2, '0');
      const minutes = String(recordTime.getMinutes()).padStart(2, '0');
      const seconds = '00';
      const timeStr = `${hours}:${minutes}:${seconds}`;
      const dateStr = recordTime.toISOString().slice(0, 10);

      // Realistic speed curve across 60 minutes
      let currentSpeed = 0;
      if (isMoving) {
        const drift = Math.sin(i * 0.35) * 12 + Math.cos(i * 0.1) * 5;
        currentSpeed = Math.max(0, Math.min(92, Math.round(baseSpeed + drift)));
        // A few traffic slowdowns
        if (i >= 22 && i <= 26) {
          currentSpeed = Math.round(currentSpeed * 0.3);
        }
      } else if (isIdle) {
        currentSpeed = 0;
      } else {
        currentSpeed = 0;
      }

      // Smooth cold-chain temperature (1-Wire / BLE Dallas sensor)
      const tempFluctuation = Math.sin(i * 0.18) * 0.35;
      const currentTemp = Number((baseTemp + tempFluctuation).toFixed(1));

      // Gradual fuel consumption over 60 mins (~0.05% per minute when moving)
      const fuelConsumedPct = isMoving ? (60 - i) * 0.04 : isIdle ? (60 - i) * 0.015 : 0;
      const currentFuelPct = Number(Math.max(10, baseFuel - fuelConsumedPct).toFixed(1));
      const currentFuelLiters = Math.round((currentFuelPct / 100) * 500); // 500L calibrated tank

      // External battery (24V heavy fleet alternator output when engine ON)
      const isEngineOn = isMoving || isIdle || i > 25;
      const extBattery = Number(
        (isEngineOn ? 24.5 + Math.sin(i * 0.4) * 0.2 : 23.8 - i * 0.005).toFixed(2)
      );
      const backupBattery = Number((4.14 - i * 0.001).toFixed(2));

      // Door sensor (DIN2)
      const doorOpen = isMoving ? false : i === 18 || i === 19;
      const doorState = doorOpen ? 'Open' : 'Closed';

      // Coordinates trail
      const latOffset = isMoving ? -(i * 0.00062) : 0;
      const lngOffset = isMoving ? -(i * 0.00078) : 0;
      const recLat = baseLat + latOffset;
      const recLng = baseLng + lngOffset;

      // Realistic Teltonika AVL Event Triggers
      let trigger = 'Periodic 60s AVL Record (ID 240)';
      let status: 'normal' | 'warning' | 'alert' = 'normal';

      if (currentSpeed > 80) {
        trigger = `Overspeed Threshold Alert (${currentSpeed} km/h > 80 km/h)`;
        status = 'alert';
      } else if (doorOpen) {
        trigger = 'DIN2 Cargo Door Open Sensor Alarm';
        status = 'warning';
      } else if (i % 14 === 0 && isMoving) {
        trigger = 'Cornering Angle Trigger (18° Heading Delta)';
      } else if (i % 11 === 0) {
        trigger = '1-Wire DS18B20 Temp Beacon Sync';
      } else if (i % 19 === 0) {
        trigger = 'Teltonika BLE EYE Sensor Packet';
      } else if (i === 45 && !isMoving) {
        trigger = 'Ignition State Change (DIN1: OFF)';
      }

      records.push({
        id: i,
        timeStr,
        dateStr,
        speed: currentSpeed,
        temp: currentTemp,
        fuelPct: currentFuelPct,
        fuelLiters: currentFuelLiters,
        extBattery,
        backupBattery,
        ignition: isEngineOn ? 'ON' : 'OFF',
        door: doorState,
        lat: recLat,
        lng: recLng,
        trigger,
        status,
      });
    }

    return records;
  }, [vehicle]);

  if (!vehicle) return null;

  // Filter logs by selected interval range (15, 30, 60 minutes)
  const slicedLogs = logs.slice(0, selectedIntervalRange);

  // Search filter
  const filteredLogs = slicedLogs.filter((rec) => {
    if (!logFilterQuery.trim()) return true;
    const q = logFilterQuery.toLowerCase();
    return (
      rec.timeStr.toLowerCase().includes(q) ||
      rec.trigger.toLowerCase().includes(q) ||
      rec.ignition.toLowerCase().includes(q) ||
      rec.door.toLowerCase().includes(q) ||
      String(rec.speed).includes(q) ||
      String(rec.temp).includes(q)
    );
  });

  // Calculate statistics across the 60-minute window
  const avgSpeed = Math.round(
    slicedLogs.reduce((acc, r) => acc + r.speed, 0) / (slicedLogs.length || 1)
  );
  const maxSpeed = Math.max(...slicedLogs.map((r) => r.speed), 0);
  const minTemp = Math.min(...slicedLogs.map((r) => r.temp));
  const maxTemp = Math.max(...slicedLogs.map((r) => r.temp));

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Interval',
      'Time_HHmmss',
      'Date',
      'Speed_KMH',
      'Reefer_Temp_C',
      'Fuel_Pct',
      'Fuel_Liters',
      'Ext_Battery_V',
      'Backup_Battery_V',
      'Ignition_DIN1',
      'Door_DIN2',
      'Latitude',
      'Longitude',
      'Teltonika_AVL_Trigger_Event',
    ];

    const rows = slicedLogs.map((r, idx) => [
      `T-${idx}min`,
      r.timeStr,
      r.dateStr,
      r.speed,
      r.temp,
      r.fuelPct,
      r.fuelLiters,
      r.extBattery,
      r.backupBattery,
      r.ignition,
      r.door,
      r.lat.toFixed(6),
      r.lng.toFixed(6),
      `"${r.trigger.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Teltonika_FMC130_1Min_Logs_${vehicle.reg_number}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColor =
    vehicle.status === 'moving'
      ? '#22C55E'
      : vehicle.status === 'idle'
      ? '#EAB308'
      : '#EF4444';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '1180px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            backgroundColor: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent) 0%, #0d9488 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(47, 111, 109, 0.25)',
              }}
            >
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {vehicle.reg_number}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background:
                      vehicle.status === 'moving'
                        ? 'rgba(34, 197, 94, 0.12)'
                        : vehicle.status === 'idle'
                        ? 'rgba(234, 179, 8, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                    color: statusColor,
                    border: `1px solid ${statusColor}33`,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: statusColor,
                    }}
                  />
                  {vehicle.status ? vehicle.status.toUpperCase() : 'ONLINE'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  Teltonika FMC130 (Codec 8 Ext)
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginTop: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span>{vehicle.name || 'Commercial Fleet Truck'}</span>
                <span>•</span>
                <span>Driver: {vehicle.driver_name || 'Assigned Driver'}</span>
                <span>•</span>
                <span>IMEI: 868204051839210</span>
                <span>•</span>
                <span>Firmware: 03.28.02.Rev.00</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
              title="Close window"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Live Telemetry Ribbon */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1px',
            backgroundColor: 'var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-card)' }}>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Gauge size={12} color="var(--accent)" />
              <span>Speed (AVL 24)</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              {Math.round(vehicle.speed || 0)}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                km/h
              </span>
            </div>
          </div>

          <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-card)' }}>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Thermometer size={12} color="#0284C7" />
              <span>Reefer Temp (1-Wire)</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#0284C7',
                marginTop: '2px',
              }}
            >
              {vehicle.temperature !== undefined && vehicle.temperature !== null
                ? `${vehicle.temperature.toFixed(1)}°C`
                : '-18.4°C'}
            </div>
          </div>

          <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-card)' }}>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Fuel size={12} color="#D97706" />
              <span>Fuel Level (LLS RS485)</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              74%{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                (370 L)
              </span>
            </div>
          </div>

          <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-card)' }}>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <BatteryCharging size={12} color="#16A34A" />
              <span>Ext / Backup Power</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              24.6V{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                / 4.14V
              </span>
            </div>
          </div>

          <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-card)' }}>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Zap size={12} color="#8B5CF6" />
              <span>Ignition (DIN1)</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: vehicle.status === 'stopped' ? '#DC2626' : '#16A34A',
                marginTop: '2px',
              }}
            >
              {vehicle.status === 'stopped' ? 'OFF' : 'ON'}
            </div>
          </div>

          <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-card)' }}>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Satellite size={12} color="#0EA5E9" />
              <span>GNSS Fix & Sats</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              18 Sats{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                (HDOP 0.8)
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            padding: '10px 22px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: activeTab === 'logs' ? 700 : 500,
                backgroundColor: activeTab === 'logs' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'logs' ? '#FFFFFF' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Clock size={15} />
              <span>1-Minute Telemetry Logs (60 mins)</span>
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor:
                    activeTab === 'logs' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: activeTab === 'logs' ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                60 records
              </span>
            </button>

            <button
              onClick={() => setActiveTab('parameters')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: activeTab === 'parameters' ? 700 : 500,
                backgroundColor: activeTab === 'parameters' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'parameters' ? '#FFFFFF' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={15} />
              <span>Teltonika Device Telemetry & Configurable Parameters</span>
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor:
                    activeTab === 'parameters' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: activeTab === 'parameters' ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                Configurator
              </span>
            </button>
          </div>

          {activeTab === 'logs' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '2px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                {[
                  { val: 15, label: '15m' },
                  { val: 30, label: '30m' },
                  { val: 60, label: '60m' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => setSelectedIntervalRange(item.val as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      fontWeight: selectedIntervalRange === item.val ? 700 : 500,
                      backgroundColor:
                        selectedIntervalRange === item.val ? 'var(--accent)' : 'transparent',
                      color:
                        selectedIntervalRange === item.val ? '#FFFFFF' : 'var(--text-secondary)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExportCSV}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
                title="Download 1-Minute Telemetry Logs as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {activeTab === 'logs' ? (
            <div>
              {/* Filter and stats row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '360px' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        color: 'var(--text-tertiary)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search time, speed, trigger event..."
                      value={logFilterQuery}
                      onChange={(e) => setLogFilterQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 12px 6px 32px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-subtle)',
                        fontSize: '0.82rem',
                        color: 'var(--text-primary)',
                      }}
                    />
                    {logFilterQuery && (
                      <button
                        onClick={() => setLogFilterQuery('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                          padding: 0,
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Window:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      Last {selectedIntervalRange} Minutes
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Avg / Max Speed:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {avgSpeed} km/h / {maxSpeed} km/h
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Reefer Temp Range:</span>
                    <strong style={{ color: '#0284C7' }}>
                      {minTemp}°C to {maxTemp}°C
                    </strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: liveStreamActive ? '#16A34A' : 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setLiveStreamActive(!liveStreamActive)}
                    title="Click to toggle live 1-minute ticker"
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: liveStreamActive ? '#16A34A' : '#94A3B8',
                        display: 'inline-block',
                      }}
                    />
                    <span>{liveStreamActive ? 'Live 60s Stream Active' : 'Stream Paused'}</span>
                  </div>
                </div>
              </div>

              {/* 1-Minute Interval Log Table */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div style={{ overflowX: 'auto', maxHeight: '52vh' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderBottom: '1px solid var(--border)',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                        }}
                      >
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          TIME (1-MIN)
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          SPEED
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          REEFER TEMP
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          FUEL (LLS)
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          EXT BATT
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          IGNITION
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          CARGO DOOR
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          COORDINATES
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          TELTONIKA AVL TRIGGER / EVENT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              padding: '36px',
                              textAlign: 'center',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            No records matching query "{logFilterQuery}"
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((row, idx) => (
                          <tr
                            key={row.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                              backgroundColor:
                                row.status === 'alert'
                                  ? 'rgba(239, 68, 68, 0.05)'
                                  : row.status === 'warning'
                                  ? 'rgba(234, 179, 8, 0.05)'
                                  : idx % 2 === 0
                                  ? 'var(--bg-card)'
                                  : 'var(--bg-subtle)',
                              transition: 'background-color 0.1s ease',
                            }}
                          >
                            {/* Time */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={12} color="var(--text-tertiary)" />
                                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                  {row.timeStr}
                                </strong>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                  (-{row.id}m)
                                </span>
                              </div>
                            </td>

                            {/* Speed */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: row.speed > 80 ? '#DC2626' : row.speed > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                }}
                              >
                                {row.speed} km/h
                              </span>
                            </td>

                            {/* Reefer Temp */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: row.temp < -15 ? '#E0F2FE' : '#FEE2E2',
                                  color: row.temp < -15 ? '#0284C7' : '#DC2626',
                                }}
                              >
                                <Thermometer size={11} />
                                {row.temp}°C
                              </span>
                            </td>

                            {/* Fuel */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {row.fuelPct}%
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                                ({row.fuelLiters}L)
                              </span>
                            </td>

                            {/* Ext Battery */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {row.extBattery}V
                              </span>
                            </td>

                            {/* Ignition DIN1 */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '1px 7px',
                                  borderRadius: '3px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  backgroundColor:
                                    row.ignition === 'ON'
                                      ? 'rgba(34, 197, 94, 0.12)'
                                      : 'rgba(239, 68, 68, 0.12)',
                                  color: row.ignition === 'ON' ? '#16A34A' : '#DC2626',
                                }}
                              >
                                {row.ignition}
                              </span>
                            </td>

                            {/* Cargo Door DIN2 */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '1px 7px',
                                  borderRadius: '3px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor:
                                    row.door === 'Closed'
                                      ? 'var(--bg-subtle)'
                                      : 'rgba(234, 179, 8, 0.15)',
                                  color:
                                    row.door === 'Closed'
                                      ? 'var(--text-secondary)'
                                      : '#B45309',
                                }}
                              >
                                {row.door}
                              </span>
                            </td>

                            {/* Coordinates */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {row.lat.toFixed(5)}, {row.lng.toFixed(5)}
                            </td>

                            {/* AVL Trigger */}
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {row.status === 'alert' ? (
                                  <AlertTriangle size={13} color="#DC2626" />
                                ) : row.status === 'warning' ? (
                                  <AlertTriangle size={13} color="#D97706" />
                                ) : (
                                  <CheckCircle2 size={13} color="#16A34A" />
                                )}
                                <span
                                  style={{
                                    fontWeight: row.status !== 'normal' ? 700 : 500,
                                    color:
                                      row.status === 'alert'
                                        ? '#DC2626'
                                        : row.status === 'warning'
                                        ? '#B45309'
                                        : 'var(--text-primary)',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  {row.trigger}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Teltonika Device Telemetry & Configurable Parameters */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(47, 111, 109, 0.08)',
                  border: '1px solid rgba(47, 111, 109, 0.25)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cpu size={18} color="var(--accent)" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Active Configuration: Profile 1 (FMC130 Standard Fleet & Reefer Cold Chain Profile)
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Server Link: 159.89.xxx.xxx:5027 (RudraNetra TCP Ingestion Gateway)
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '14px',
                }}
              >
                {/* Panel 1: Speed, Movement & Eco-Drive */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    <Gauge size={16} />
                    <span>Speed, Movement & Eco-Drive Configuration</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current GNSS Speed (AVL ID 24):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{Math.round(vehicle.speed || 0)} km/h</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Overspeeding Threshold:</span>
                      <strong style={{ color: '#D97706' }}>80 km/h (Audio Alert Enabled)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Harsh Acceleration (AVL 253):</span>
                      <strong style={{ color: '#16A34A' }}>0.35 G (Eco-Driving Profile)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Harsh Braking (AVL 254):</span>
                      <strong style={{ color: '#16A34A' }}>0.40 G (Threshold Active)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Harsh Cornering (AVL 255):</span>
                      <strong style={{ color: '#16A34A' }}>0.38 G (Threshold Active)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Excessive Idling Scenario:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>5 minutes threshold</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Virtual Odometer (AVL 16):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>142,850.4 km</strong>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Cold-Chain & Temperature Sensors */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: '#0284C7',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    <Thermometer size={16} />
                    <span>Cold-Chain & 1-Wire / BLE Temperature</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>1-Wire Dallas Sensor 1 (AVL 72):</span>
                      <strong style={{ color: '#0284C7' }}>
                        {vehicle.temperature !== undefined && vehicle.temperature !== null
                          ? `${vehicle.temperature.toFixed(1)}°C`
                          : '-18.4°C'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>BLE EYE Sensor 2 (AVL 73):</span>
                      <strong style={{ color: '#0284C7' }}>-18.1°C (Rear Chiller Compartment)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cabin Ambient Sensor (AVL 74):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>24.2°C</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Configured Safe Range:</span>
                      <strong style={{ color: '#16A34A' }}>-22.0°C to -15.0°C (Pharma Grade)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>High Temp Deviation Alarm:</span>
                      <strong style={{ color: '#DC2626' }}>&gt; -14.0°C for 180s (SMS & DOUT2)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>BLE EYE Battery Health:</span>
                      <strong style={{ color: '#16A34A' }}>3.22V (98% capacity)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>BLE RSSI Signal:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>-64 dBm (Excellent)</strong>
                    </div>
                  </div>
                </div>

                {/* Panel 3: Fuel Management & Liquid Level Sensors */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: '#D97706',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    <Fuel size={16} />
                    <span>Fuel Level (LLS RS485 & CAN FMS)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Fuel Level Percentage (AVL 84):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>74.5%</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Calibrated Fuel Volume:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>372.5 Liters (500L Tank)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Fuel Sensor Interface:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>RS-485 Digital (LLS Frequency)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Rapid Fuel Drain / Theft Alert:</span>
                      <strong style={{ color: '#16A34A' }}>Enabled (&gt; 15L drop in 120s)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Refueling Detection Event:</span>
                      <strong style={{ color: '#16A34A' }}>Enabled (&gt; 25L increase in 180s)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Instant Fuel Consumption (AVL 85):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>24.2 L / 100km</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Calibration Curve:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>5-Point Interpolated Applied</strong>
                    </div>
                  </div>
                </div>

                {/* Panel 4: Power, Voltage & Sleep Modes */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: '#16A34A',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    <BatteryCharging size={16} />
                    <span>Power, Voltage & Sleep Modes</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>External Vehicle Battery (AVL 67):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>24.62 V (Alternator Charging)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Internal Li-ion Backup (AVL 66):</span>
                      <strong style={{ color: '#16A34A' }}>4.14 V (100% Full Capacity)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Power Cut / Wire Tamper Alarm:</span>
                      <strong style={{ color: '#DC2626' }}>Configured (High Priority)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Sleep Mode Configuration:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Online Deep Sleep (Modem Active)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Low Battery Protection Cutoff:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>21.6 V (Preserves Crank Power)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Static Navigation Filter:</span>
                      <strong style={{ color: '#16A34A' }}>Active (Eliminates Drift on Stop)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Wake-up on Accelerometer:</span>
                      <strong style={{ color: '#16A34A' }}>Enabled (0.15G Sensitivity)</strong>
                    </div>
                  </div>
                </div>

                {/* Panel 5: Digital I/O & Relay Controls */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: '#8B5CF6',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    <Activity size={16} />
                    <span>Digital I/O & Relay Configuration</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DIN1 - Ignition State (AVL 239):</span>
                      <strong style={{ color: vehicle.status === 'stopped' ? '#DC2626' : '#16A34A' }}>
                        {vehicle.status === 'stopped' ? 'Inactive (0V)' : 'Active (24V Ignition ON)'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DIN2 - Cargo Door Contact (AVL 1):</span>
                      <strong style={{ color: '#16A34A' }}>Closed (Secured Magnetic Switch)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DIN3 - Driver SOS / Panic Button:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Normal (Disarmed)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DOUT1 - Engine Immobilizer (AVL 179):</span>
                      <strong style={{ color: '#16A34A' }}>Disarmed / Normal (Engine Allowed)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DOUT2 - Reefer Compressor Relay:</span>
                      <strong style={{ color: '#0284C7' }}>Energized / Active Chilling</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>AIN1 - Analog 0-30V Sensor (AVL 9):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>12.4 V Connected</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>1-Wire Dallas ROM ID:</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        28-000005C89F31
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Panel 6: GNSS & Data Transmission Timing */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: '#0EA5E9',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  >
                    <Radio size={16} />
                    <span>GNSS & Transmission Frequencies</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Record Frequency (On Moving):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Every 60 Seconds (1 Minute)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Record Frequency (On Stop):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Every 300 Seconds (5 Min Heartbeat)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Min Angle Heading Trigger:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>10 Degrees Turn</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Min Distance Trigger:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>100 Meters</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>GNSS Constellation:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>GPS + GLONASS + Galileo</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cellular Network Provider:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>Du Telecom UAE 4G LTE</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Ingestion Protocol:</span>
                      <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        Teltonika Codec 8 Extended / TCP
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: 'var(--bg-subtle)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            <Shield size={14} color="var(--accent)" />
            <span>Teltonika AVL Ingestion Engine • Firmware 03.28.02 • 1-Minute Live Interval Window</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 16px', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
