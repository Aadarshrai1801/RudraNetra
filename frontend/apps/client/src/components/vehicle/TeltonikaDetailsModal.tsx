import React, { useState, useEffect, useCallback } from 'react';
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
  Database,
  RefreshCw,
} from 'lucide-react';
import { fetchWithAuth } from '../../utils/api';
import { useVehicleStore } from '../../store/vehicleStore';

interface TeltonikaDetailsModalProps {
  vehicle: any | null;
  onClose: () => void;
  initialTab?: 'logs' | 'parameters';
}

const DASH = '—';
const LOGS_POLL_MS = 60_000;
// The poll always requests at least the last 60 records, matching the API contract.
const MIN_LOGS_LIMIT = 60;

const numOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const formatIntervalDuration = (sec: number): string => {
  if (sec <= 0) return '0s';
  if (sec < 60) return `+${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s === 0 ? `+${m}m` : `+${m}m ${String(s).padStart(2, '0')}s`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `+${h}h ${String(m).padStart(2, '0')}m`;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return DASH;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatOdometer = (value: number | null): string =>
  value === null ? DASH : `${value.toLocaleString()} km`;

const formatTemperature = (value: number | null): string =>
  value === null ? DASH : `${value}°C`;

const formatVoltage = (value: number | null): string =>
  value === null ? DASH : `${value} V`;

interface TelemetryLogRecord {
  id: number;
  timeStr: string | null;
  dateStr: string | null;
  intervalStr: string | null;
  deltaSeconds: number | null;
  speed: number | null;
  temp: number | null;
  fuelPct: number | null;
  fuelLiters: number | null;
  extBattery: number | null;
  backupBattery: number | null;
  ignition: 'ON' | 'OFF' | null;
  door: string | null;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  satellites: number | null;
  heading: number | null;
  odometer: number | null;
  trigger: string | null;
}

interface LogsVehicleMeta {
  reg_number: string | null;
  make: string | null;
  model: string | null;
  fuel_capacity: number | null;
  max_speed: number | null;
}

interface LogsDeviceMeta {
  id: number | null;
  imei: string | null;
  device_type: string | null;
  sim_no: string | null;
  sim_operator: string | null;
  port: number | string | null;
  firmware: string | null;
  status: string | null;
  last_heartbeat: string | null;
}

interface Thresholds {
  speedThresholdKmh: number | null;
  idleThresholdMinutes: number | null;
}

// Map a single API telemetry row. Missing/NULL fields stay null so the UI can
// render '—' instead of inventing a value.
const mapApiLog = (item: any, idx: number): TelemetryLogRecord => {
  const deltaSeconds = numOrNull(item?.delta_seconds);
  let timeStr = textOrNull(item?.time_str);
  let dateStr = textOrNull(item?.date_str);

  const rawTime = textOrNull(item?.time);
  if (rawTime) {
    const parsed = new Date(rawTime);
    if (!Number.isNaN(parsed.getTime())) {
      if (!timeStr) timeStr = parsed.toISOString().slice(11, 19);
      if (!dateStr) dateStr = parsed.toISOString().slice(0, 10);
    }
  }

  let ignition: 'ON' | 'OFF' | null = null;
  if (item?.ignition === 'ON' || item?.ignition === true) ignition = 'ON';
  else if (item?.ignition === 'OFF' || item?.ignition === false) ignition = 'OFF';

  return {
    id: numOrNull(item?.id) ?? idx,
    timeStr,
    dateStr,
    intervalStr:
      textOrNull(item?.interval_str) ??
      (deltaSeconds !== null ? formatIntervalDuration(deltaSeconds) : null),
    deltaSeconds,
    speed: numOrNull(item?.speed),
    temp: numOrNull(item?.temp),
    fuelPct: numOrNull(item?.fuel_pct),
    fuelLiters: numOrNull(item?.fuel_liters),
    extBattery: numOrNull(item?.ext_battery),
    backupBattery: numOrNull(item?.backup_battery),
    ignition,
    door: textOrNull(item?.door),
    lat: numOrNull(item?.lat),
    lng: numOrNull(item?.lng),
    altitude: numOrNull(item?.altitude),
    satellites: numOrNull(item?.satellites),
    heading: numOrNull(item?.heading),
    odometer: numOrNull(item?.odometer),
    trigger: textOrNull(item?.trigger),
  };
};

const mapLogsVehicle = (raw: any): LogsVehicleMeta => ({
  reg_number: textOrNull(raw?.reg_number),
  make: textOrNull(raw?.make),
  model: textOrNull(raw?.model),
  fuel_capacity: numOrNull(raw?.fuel_capacity),
  max_speed: numOrNull(raw?.max_speed),
});

const mapLogsDevice = (raw: any): LogsDeviceMeta => ({
  id: numOrNull(raw?.id),
  imei: textOrNull(raw?.imei),
  device_type: textOrNull(raw?.device_type),
  sim_no: textOrNull(raw?.sim_no),
  sim_operator: textOrNull(raw?.sim_operator),
  port: raw?.port ?? null,
  firmware: textOrNull(raw?.firmware),
  status: textOrNull(raw?.status),
  last_heartbeat: textOrNull(raw?.last_heartbeat),
});

interface ParamRowProps {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  last?: boolean;
}

const ParamRow: React.FC<ParamRowProps> = ({ label, value, valueColor, last = false }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      paddingBottom: last ? 0 : '6px',
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
    }}
  >
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <strong style={{ color: valueColor || 'var(--text-primary)' }}>{value}</strong>
  </div>
);

export const TeltonikaDetailsModal: React.FC<TeltonikaDetailsModalProps> = ({
  vehicle,
  onClose,
  initialTab = 'logs',
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'parameters'>(initialTab);
  const [logFilterQuery, setLogFilterQuery] = useState('');
  const [selectedIntervalRange, setSelectedIntervalRange] = useState<number>(60);

  const [dbLogs, setDbLogs] = useState<TelemetryLogRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logDataSource, setLogDataSource] = useState<'database' | 'device'>('database');
  const [vehicleMeta, setVehicleMeta] = useState<LogsVehicleMeta | null>(null);
  const [deviceMeta, setDeviceMeta] = useState<LogsDeviceMeta | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>({
    speedThresholdKmh: null,
    idleThresholdMinutes: null,
  });
  const storeVehicles = useVehicleStore((state) => state.vehicles);

  // Fetch real telemetry logs from the backend (PostgreSQL-backed).
  const loadLogsFromDb = useCallback(async () => {
    if (!vehicle) return;
    setIsLoadingLogs(true);
    setLogsError(null);
    const targetId = vehicle.id || vehicle.device_id || vehicle.reg_number;
    const fetchLimit = Math.max(selectedIntervalRange, MIN_LOGS_LIMIT);

    try {
      const res = await fetchWithAuth(`/api/v1/vehicles/${targetId}/logs?limit=${fetchLimit}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.statusText}`);
      }

      const json = await res.json();
      if (!json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || 'Invalid telemetry payload');
      }

      setDbLogs(json.data.map((item: any, idx: number) => mapApiLog(item, idx)));
      setLogDataSource('database');
      setVehicleMeta(json.vehicle ? mapLogsVehicle(json.vehicle) : null);
      setDeviceMeta(json.device ? mapLogsDevice(json.device) : null);
    } catch (err: any) {
      console.error('Failed to load telemetry logs', err);
      setLogsError(err?.message || 'Failed to load telemetry records');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [vehicle, selectedIntervalRange]);

  // Load fleet thresholds once (speed / idle) from the API.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth('/api/v1/settings');
        if (!res.ok) return;
        const json = await res.json();
        const settings = json?.data?.settings;
        if (cancelled || !settings) return;
        setThresholds({
          speedThresholdKmh: numOrNull(settings.speedThresholdKmh),
          idleThresholdMinutes: numOrNull(settings.idleThresholdMinutes),
        });
      } catch (err) {
        console.warn('Failed to load fleet settings thresholds', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll while the modal is open: WebSocket pushes are not guaranteed.
  useEffect(() => {
    loadLogsFromDb();
    const timer = window.setInterval(() => {
      loadLogsFromDb();
    }, LOGS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadLogsFromDb]);

  // Append live WebSocket telemetry when the store has a real payload.
  useEffect(() => {
    const deviceId = vehicle?.device_id;
    if (!deviceId) return;
    const liveVeh = storeVehicles.get(deviceId);
    if (!liveVeh?.timestamp) return;
    const liveDt = new Date(liveVeh.timestamp);
    if (Number.isNaN(liveDt.getTime())) return;

    setDbLogs((prev) => {
      const hours = String(liveDt.getUTCHours()).padStart(2, '0');
      const minutes = String(liveDt.getUTCMinutes()).padStart(2, '0');
      const seconds = String(liveDt.getUTCSeconds()).padStart(2, '0');
      const liveTimeStr = `${hours}:${minutes}:${seconds}`;
      const liveDateStr = liveDt.toISOString().slice(0, 10);

      const latest = prev[0];
      if (latest && latest.timeStr === liveTimeStr && latest.dateStr === liveDateStr) {
        return prev;
      }

      let deltaSeconds: number | null = null;
      if (latest?.timeStr && latest?.dateStr) {
        const prevMs = new Date(`${latest.dateStr}T${latest.timeStr}Z`).getTime();
        if (Number.isFinite(prevMs)) {
          deltaSeconds = Math.max(0, Math.round((liveDt.getTime() - prevMs) / 1000));
        }
      }

      const liveSpeed = numOrNull(liveVeh.speed);
      const liveIgnition =
        typeof liveVeh.ignition === 'boolean' ? (liveVeh.ignition ? 'ON' : 'OFF') : null;

      const newRec: TelemetryLogRecord = {
        id: Date.now(),
        timeStr: liveTimeStr,
        dateStr: liveDateStr,
        intervalStr: deltaSeconds !== null ? formatIntervalDuration(deltaSeconds) : null,
        deltaSeconds,
        speed: liveSpeed,
        temp: numOrNull(liveVeh.temperature),
        fuelPct: null,
        fuelLiters: null,
        extBattery: null,
        backupBattery: null,
        ignition: liveIgnition,
        door: null,
        lat: numOrNull(liveVeh.lat),
        lng: numOrNull(liveVeh.lng),
        altitude: null,
        satellites: null,
        heading: numOrNull(liveVeh.heading),
        odometer: numOrNull(liveVeh.odometer),
        trigger: null,
      };
      return [newRec, ...prev].slice(0, 200);
    });
    setLogDataSource('device');
  }, [storeVehicles, vehicle?.device_id]);

  if (!vehicle) return null;

  const speedThreshold = thresholds.speedThresholdKmh;
  const slicedLogs = dbLogs.slice(0, selectedIntervalRange);
  const latestRecord = slicedLogs[0] ?? null;

  // Live ribbon values come from the latest fetched record; the tracking store
  // only fills the live speed/temperature/ignition when no record exists yet.
  const latestSpeed = latestRecord?.speed ?? numOrNull(vehicle.speed);
  const latestTemp = latestRecord?.temp ?? numOrNull(vehicle.temperature);
  const latestIgnition =
    latestRecord?.ignition ??
    (typeof vehicle.ignition === 'boolean' ? (vehicle.ignition ? 'ON' : 'OFF') : null);
  const latestFuelPct = latestRecord?.fuelPct ?? null;
  const latestFuelLiters = latestRecord?.fuelLiters ?? null;
  const latestExtBattery = latestRecord?.extBattery ?? null;
  const latestBackupBattery = latestRecord?.backupBattery ?? null;
  const latestSatellites = latestRecord?.satellites ?? null;
  const latestOdometer = latestRecord?.odometer ?? null;

  const isOverspeed = (speed: number | null): boolean =>
    speed !== null && speedThreshold !== null && speed > speedThreshold;

  // Search filter
  const filteredLogs = slicedLogs.filter((rec) => {
    if (!logFilterQuery.trim()) return true;
    const q = logFilterQuery.toLowerCase();
    const haystack: (string | null)[] = [
      rec.timeStr,
      rec.dateStr,
      rec.intervalStr,
      rec.trigger,
      rec.ignition,
      rec.door,
      rec.speed !== null ? String(rec.speed) : null,
      rec.temp !== null ? String(rec.temp) : null,
    ];
    return haystack.some((field) => field !== null && field.toLowerCase().includes(q));
  });

  // Calculate statistics across the fetched rows only.
  const speeds = slicedLogs
    .map((r) => r.speed)
    .filter((value): value is number => value !== null);
  const avgSpeed = speeds.length
    ? Math.round(speeds.reduce((acc, value) => acc + value, 0) / speeds.length)
    : null;
  const maxSpeed = speeds.length ? Math.max(...speeds) : null;

  const temps = slicedLogs.map((r) => r.temp).filter((value): value is number => value !== null);
  const minTemp = temps.length ? Math.min(...temps) : null;
  const maxTemp = temps.length ? Math.max(...temps) : null;

  const deltas = slicedLogs
    .map((r) => r.deltaSeconds)
    .filter((value): value is number => value !== null && value > 0);
  const avgDeltaSec = deltas.length
    ? Math.round(deltas.reduce((acc, value) => acc + value, 0) / deltas.length)
    : null;

  const extBatteries = slicedLogs
    .map((r) => r.extBattery)
    .filter((value): value is number => value !== null);
  const minExtBattery = extBatteries.length ? Math.min(...extBatteries) : null;
  const maxExtBattery = extBatteries.length ? Math.max(...extBatteries) : null;

  const ignitionOnCount = slicedLogs.filter((r) => r.ignition === 'ON').length;

  const vehicleName =
    [vehicleMeta?.make, vehicleMeta?.model].filter(Boolean).join(' ') || vehicle.name || DASH;
  const deviceType = deviceMeta?.device_type ?? DASH;
  const devicePort =
    deviceMeta && deviceMeta.port !== null && deviceMeta.port !== undefined
      ? String(deviceMeta.port)
      : DASH;

  // CSV Export handler — exports only the fetched API rows currently displayed.
  const handleExportCSV = () => {
    const csvCell = (value: string | number | null): string => {
      if (value === null) return DASH;
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

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

    const rows = slicedLogs.map((r) => [
      csvCell(r.intervalStr),
      csvCell(r.timeStr),
      csvCell(r.dateStr),
      csvCell(r.speed),
      csvCell(r.temp),
      csvCell(r.fuelPct),
      csvCell(r.fuelLiters),
      csvCell(r.extBattery),
      csvCell(r.backupBattery),
      csvCell(r.ignition),
      csvCell(r.door),
      csvCell(r.lat !== null ? r.lat.toFixed(6) : null),
      csvCell(r.lng !== null ? r.lng.toFixed(6) : null),
      csvCell(r.trigger),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Teltonika_Telemetry_Logs_${vehicle.reg_number || 'vehicle'}_${
        slicedLogs[0]?.dateStr ?? 'export'
      }.csv`
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
                  {vehicle.status ? vehicle.status.toUpperCase() : DASH}
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
                  {deviceType}
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
                  flexWrap: 'wrap',
                }}
              >
                <span>{vehicleName}</span>
                <span>•</span>
                <span>Driver: {vehicle.driver_name || DASH}</span>
                <span>•</span>
                <span>IMEI: {deviceMeta?.imei ?? DASH}</span>
                <span>•</span>
                <span>Firmware: {deviceMeta?.firmware ?? DASH}</span>
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
              {latestSpeed !== null ? Math.round(latestSpeed) : DASH}{' '}
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
              <span>Reefer Temp</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#0284C7',
                marginTop: '2px',
              }}
            >
              {formatTemperature(latestTemp)}
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
              {latestFuelPct !== null ? (
                <>
                  {latestFuelPct}%{' '}
                  {latestFuelLiters !== null && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      ({latestFuelLiters} L)
                    </span>
                  )}
                </>
              ) : (
                DASH
              )}
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
              {latestExtBattery === null && latestBackupBattery === null ? (
                DASH
              ) : (
                <>
                  {formatVoltage(latestExtBattery)}{' '}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    / {formatVoltage(latestBackupBattery)}
                  </span>
                </>
              )}
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
                color:
                  latestIgnition === null
                    ? 'var(--text-tertiary)'
                    : latestIgnition === 'OFF'
                    ? '#DC2626'
                    : '#16A34A',
                marginTop: '2px',
              }}
            >
              {latestIgnition ?? DASH}
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
              <span>GNSS Sats</span>
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              {latestSatellites !== null ? `${latestSatellites} Sats` : DASH}
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
              <span>Device Telemetry Logs (Actual DB Intervals)</span>
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
                {slicedLogs.length} records
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
                Telemetry
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
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: 700,
                    marginRight: '2px',
                    marginLeft: '4px',
                  }}
                >
                  LIMIT:
                </span>
                {[
                  { val: 15, label: '15' },
                  { val: 30, label: '30' },
                  { val: 60, label: '60' },
                  { val: 100, label: '100' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => setSelectedIntervalRange(item.val)}
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
                title="Download Telemetry Logs as CSV"
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
              {/* Error banner (kept visible while previously fetched rows remain) */}
              {logsError && slicedLogs.length > 0 && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#DC2626',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {logsError}
                </div>
              )}

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
                      Last {slicedLogs.length} Records
                    </strong>
                  </div>
                  {avgDeltaSec !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Avg Interval:</span>
                      <strong style={{ color: 'var(--accent)' }}>
                        {formatIntervalDuration(avgDeltaSec)}
                      </strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Avg / Max Speed:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {avgSpeed !== null ? `${avgSpeed} km/h` : DASH} /{' '}
                      {maxSpeed !== null ? `${maxSpeed} km/h` : DASH}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Temp Range:</span>
                    <strong style={{ color: '#0284C7' }}>
                      {formatTemperature(minTemp)} to {formatTemperature(maxTemp)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: logDataSource === 'device' ? '#16A34A' : 'var(--accent)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      {logDataSource === 'device' ? (
                        <Radio size={13} color="#16A34A" />
                      ) : (
                        <Database size={13} color="var(--accent)" />
                      )}
                      <span>
                        {logDataSource === 'device' ? 'Live Teltonika Device' : 'PostgreSQL'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                        ({slicedLogs.length} records
                        {latestRecord
                          ? ` · ${latestRecord.dateStr ?? DASH} ${latestRecord.timeStr ?? DASH}`
                          : ''}
                        )
                      </span>
                    </div>

                    <button
                      onClick={loadLogsFromDb}
                      disabled={isLoadingLogs}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Reload telemetry logs from database"
                    >
                      <RefreshCw size={11} className={isLoadingLogs ? 'animate-spin' : ''} />
                      <span>{isLoadingLogs ? 'Loading...' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Telemetry Log Table */}
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
                          TIME & ACTUAL INTERVAL DELTA
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
                      {isLoadingLogs && slicedLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              padding: '36px',
                              textAlign: 'center',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Loading telemetry records...
                          </td>
                        </tr>
                      ) : logsError && slicedLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              padding: '36px',
                              textAlign: 'center',
                              color: '#DC2626',
                              fontWeight: 600,
                            }}
                          >
                            {logsError}
                          </td>
                        </tr>
                      ) : slicedLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              padding: '36px',
                              textAlign: 'center',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            No telemetry records for this vehicle
                          </td>
                        </tr>
                      ) : filteredLogs.length === 0 ? (
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
                        filteredLogs.map((row, idx) => {
                          const rowAlert = isOverspeed(row.speed);
                          const isFirstRow = idx === 0;
                          const isShortInterval =
                            row.deltaSeconds !== null && row.deltaSeconds <= 15;
                          return (
                            <tr
                              key={row.id}
                              style={{
                                borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                                backgroundColor: rowAlert
                                  ? 'rgba(239, 68, 68, 0.05)'
                                  : idx % 2 === 0
                                  ? 'var(--bg-card)'
                                  : 'var(--bg-subtle)',
                                transition: 'background-color 0.1s ease',
                              }}
                            >
                              {/* Time & Actual Interval Delta */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Clock size={13} color="var(--text-tertiary)" />
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                                        {row.timeStr ?? DASH}
                                      </strong>
                                      <span
                                        style={{
                                          fontSize: '0.72rem',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontFamily: 'monospace',
                                          fontWeight: 700,
                                          backgroundColor: isFirstRow
                                            ? 'rgba(34, 197, 94, 0.15)'
                                            : isShortInterval
                                            ? 'rgba(14, 165, 233, 0.15)'
                                            : 'rgba(100, 116, 139, 0.15)',
                                          color: isFirstRow
                                            ? '#16A34A'
                                            : isShortInterval
                                            ? '#0284C7'
                                            : 'var(--text-secondary)',
                                        }}
                                        title={
                                          row.deltaSeconds !== null
                                            ? `Actual database interval: ${row.deltaSeconds}s`
                                            : isFirstRow
                                            ? 'Latest recorded ping'
                                            : 'Interval not reported'
                                        }
                                      >
                                        {row.intervalStr ?? DASH}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                                      {row.dateStr ?? DASH}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Speed */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: rowAlert
                                      ? '#DC2626'
                                      : row.speed !== null && row.speed > 0
                                      ? 'var(--text-primary)'
                                      : 'var(--text-tertiary)',
                                  }}
                                >
                                  {row.speed !== null ? `${Math.round(row.speed)} km/h` : DASH}
                                </span>
                              </td>

                              {/* Reefer Temp */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                {row.temp !== null ? (
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
                                    {formatTemperature(row.temp)}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>{DASH}</span>
                                )}
                              </td>

                              {/* Fuel */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                {row.fuelPct !== null ? (
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {row.fuelPct}%
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>{DASH}</span>
                                )}
                                {row.fuelLiters !== null && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                                    ({row.fuelLiters}L)
                                  </span>
                                )}
                              </td>

                              {/* Ext Battery */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {row.extBattery !== null ? `${row.extBattery}V` : DASH}
                                </span>
                              </td>

                              {/* Ignition DIN1 */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                {row.ignition !== null ? (
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
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>{DASH}</span>
                                )}
                              </td>

                              {/* Cargo Door DIN2 */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                {row.door !== null ? (
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
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>{DASH}</span>
                                )}
                              </td>

                              {/* Coordinates */}
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {row.lat !== null && row.lng !== null
                                  ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
                                  : DASH}
                              </td>

                              {/* AVL Trigger */}
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {rowAlert ? (
                                    <AlertTriangle size={13} color="#DC2626" />
                                  ) : (
                                    <CheckCircle2 size={13} color="#16A34A" />
                                  )}
                                  <span
                                    style={{
                                      fontWeight: rowAlert ? 700 : 500,
                                      color: rowAlert ? '#DC2626' : 'var(--text-primary)',
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    {row.trigger ?? DASH}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
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
                    Device: {deviceType} • IMEI: {deviceMeta?.imei ?? DASH} • Status:{' '}
                    {deviceMeta?.status ?? DASH}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  SIM: {deviceMeta?.sim_no ?? DASH} ({deviceMeta?.sim_operator ?? DASH}) • TCP Port:{' '}
                  {devicePort} • Firmware: {deviceMeta?.firmware ?? DASH}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '14px',
                }}
              >
                {/* Panel 1: Speed, Movement & Thresholds */}
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
                    <span>Speed & Movement</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <ParamRow
                      label="Current GNSS Speed (AVL ID 24):"
                      value={latestSpeed !== null ? `${Math.round(latestSpeed)} km/h` : DASH}
                    />
                    <ParamRow
                      label="Overspeeding Threshold:"
                      value={speedThreshold !== null ? `${speedThreshold} km/h` : DASH}
                      valueColor={speedThreshold !== null ? '#D97706' : undefined}
                    />
                    <ParamRow
                      label="Average Speed (window):"
                      value={avgSpeed !== null ? `${avgSpeed} km/h` : DASH}
                    />
                    <ParamRow
                      label="Maximum Speed (window):"
                      value={maxSpeed !== null ? `${maxSpeed} km/h` : DASH}
                    />
                    <ParamRow
                      label="Configured Max Speed:"
                      value={vehicleMeta?.max_speed !== null && vehicleMeta?.max_speed !== undefined ? `${vehicleMeta.max_speed} km/h` : DASH}
                    />
                    <ParamRow
                      label="Excessive Idling Threshold:"
                      value={
                        thresholds.idleThresholdMinutes !== null
                          ? `${thresholds.idleThresholdMinutes} minutes threshold`
                          : DASH
                      }
                    />
                    <ParamRow
                      label="Total Virtual Odometer (AVL 16):"
                      value={formatOdometer(latestOdometer)}
                      last
                    />
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
                    <span>Cold-Chain & Temperature</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <ParamRow
                      label="Latest Recorded Temperature:"
                      value={formatTemperature(latestTemp)}
                      valueColor="#0284C7"
                    />
                    <ParamRow
                      label="Minimum Temperature (window):"
                      value={formatTemperature(minTemp)}
                      valueColor="#0284C7"
                    />
                    <ParamRow
                      label="Maximum Temperature (window):"
                      value={formatTemperature(maxTemp)}
                      valueColor="#0284C7"
                    />
                    <ParamRow
                      label="Temperature Readings (window):"
                      value={String(temps.length)}
                      last
                    />
                  </div>
                </div>

                {/* Panel 3: Fuel Management */}
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
                    <span>Fuel Level (LLS RS485)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <ParamRow
                      label="Fuel Level Percentage (latest record):"
                      value={latestFuelPct !== null ? `${latestFuelPct}%` : DASH}
                    />
                    <ParamRow
                      label="Fuel Volume (latest record):"
                      value={latestFuelLiters !== null ? `${latestFuelLiters} L` : DASH}
                    />
                    <ParamRow
                      label="Configured Tank Capacity:"
                      value={
                        vehicleMeta?.fuel_capacity !== null && vehicleMeta?.fuel_capacity !== undefined
                          ? `${vehicleMeta.fuel_capacity} L`
                          : DASH
                      }
                      last
                    />
                  </div>
                </div>

                {/* Panel 4: Power & Voltage */}
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
                    <span>Power & Voltage</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <ParamRow
                      label="External Vehicle Battery (latest record):"
                      value={formatVoltage(latestExtBattery)}
                    />
                    <ParamRow
                      label="Internal Backup Battery (latest record):"
                      value={formatVoltage(latestBackupBattery)}
                      valueColor="#16A34A"
                    />
                    <ParamRow
                      label="External Battery Range (window):"
                      value={
                        minExtBattery !== null && maxExtBattery !== null
                          ? `${formatVoltage(minExtBattery)} – ${formatVoltage(maxExtBattery)}`
                          : DASH
                      }
                      last
                    />
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
                    <span>Digital I/O State</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <ParamRow
                      label="DIN1 - Ignition State (latest record):"
                      value={latestRecord?.ignition ?? DASH}
                      valueColor={
                        latestRecord?.ignition === 'OFF'
                          ? '#DC2626'
                          : latestRecord?.ignition === 'ON'
                          ? '#16A34A'
                          : undefined
                      }
                    />
                    <ParamRow
                      label="DIN2 - Cargo Door Contact (latest record):"
                      value={latestRecord?.door ?? DASH}
                      valueColor={
                        latestRecord?.door && latestRecord.door !== 'Closed'
                          ? '#B45309'
                          : undefined
                      }
                    />
                    <ParamRow
                      label="Records with Ignition ON (window):"
                      value={
                        slicedLogs.length > 0
                          ? `${ignitionOnCount} of ${slicedLogs.length}`
                          : DASH
                      }
                      last
                    />
                  </div>
                </div>

                {/* Panel 6: GNSS & Uplink */}
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
                    <span>GNSS & Uplink</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <ParamRow
                      label="Satellites (latest record):"
                      value={latestSatellites !== null ? String(latestSatellites) : DASH}
                    />
                    <ParamRow
                      label="GNSS Heading (latest record):"
                      value={
                        latestRecord?.heading !== null && latestRecord?.heading !== undefined
                          ? `${latestRecord.heading}°`
                          : DASH
                      }
                    />
                    <ParamRow
                      label="Altitude (latest record):"
                      value={
                        latestRecord?.altitude !== null && latestRecord?.altitude !== undefined
                          ? `${latestRecord.altitude} m`
                          : DASH
                      }
                    />
                    <ParamRow
                      label="Latest Transmission Interval:"
                      value={latestRecord?.intervalStr ?? DASH}
                    />
                    <ParamRow
                      label="Last Heartbeat:"
                      value={formatDateTime(deviceMeta?.last_heartbeat)}
                    />
                    <ParamRow
                      label="Records in Window:"
                      value={String(slicedLogs.length)}
                      last
                    />
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
            <span>
              Device Telemetry • Firmware {deviceMeta?.firmware ?? DASH} • Last Heartbeat{' '}
              {formatDateTime(deviceMeta?.last_heartbeat)}
            </span>
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
