import React, { useEffect, useState } from 'react';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';
import { Download, Plus, X, Check, Navigation } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const updatePosition = useVehicleStore((state) => state.updatePosition);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dispatchForm, setDispatchForm] = useState({
    vehicle: 'DXB-A-98124',
    destination: 'Jebel Ali Port Gate 4',
    driver: 'Sanjay Kumar',
    cargo: 'Reefer Container #4812',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportLogs = () => {
    const vehiclesList = Array.from(vehiclesMap.values());
    const csvHeader = 'DeviceID,Registration,Status,SpeedKmH,Ignition,Latitude,Longitude,Timestamp\n';
    const csvRows = vehiclesList
      .map(
        (v) =>
          `${v.device_id},"${v.reg_number}",${v.status},${v.speed},${v.ignition},${v.lat},${v.lng},"${v.timestamp}"`
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rudra_telemetry_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Telemetry event log exported successfully (.csv)');
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDispatchModalOpen(false);
    showToast(`Route dispatched: ${dispatchForm.vehicle} -> ${dispatchForm.destination}`);
  };

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

  const vehicleList = Array.from(vehiclesMap.values());

  const movingCount = vehicleList.filter((v) => v.status === 'moving').length || 2;
  const idleCount = vehicleList.filter((v) => v.status === 'idle').length || 1;
  const stoppedCount = vehicleList.filter((v) => v.status === 'stopped').length || 1;
  const totalCount = vehicleList.length || 4;

  const sampleLogs = [
    { ts: '11:39:15.812', tag: 'TCP:5040', msg: 'RECV Teltonika Codec 8 frame (IMEI: 352893088642868) -> 4 AVL records, CRC: OK', level: 'info' },
    { ts: '11:39:15.824', tag: 'TIMESCALE', msg: 'Hypertable chunk [pos_2026_w39] committed in 1.42ms', level: 'info' },
    { ts: '11:39:15.830', tag: 'POSTGIS', msg: 'ST_Contains(geofence_id=1, DXB-A-98124) -> INSIDE (Jebel Ali Port)', level: 'ok' },
    { ts: '11:39:15.841', tag: 'NATS', msg: 'Published stream "telemetry.positions.vave_uae" -> 2 active subscribers', level: 'info' },
    { ts: '11:39:15.850', tag: 'TELEMETRY', msg: 'DXB-B-43210 speed=0.0 km/h, ign=ON -> Status transitioned to IDLE', level: 'warn' },
    { ts: '11:39:15.862', tag: 'CACHE', msg: 'Redis live spatial cache key "vave:pos:101" refreshed (TTL: 86400s)', level: 'info' },
  ];

  return (
    <div className="page-container">
      {/* Top Operations Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--signal-amber)', display: 'inline-block' }} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              Fleet Operations & Telemetry Console
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Real-time ingestion monitoring, hypertable telemetry store, and spatial state tracking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExportLogs} className="btn btn-ghost" style={{ gap: '6px' }}>
            <Download size={14} />
            <span>EXPORT LOGS</span>
          </button>
          <button onClick={() => setIsDispatchModalOpen(true)} className="btn btn-primary" style={{ gap: '6px' }}>
            <Plus size={14} strokeWidth={2.5} />
            <span>+ DISPATCH ROUTE</span>
          </button>
        </div>
      </div>

      {/* Industrial Horizontal Data Strip (No card chrome, no rounded kit) */}
      <div className="data-strip">
        {/* Cell 1: Total Fleet */}
        <div className="data-strip-cell">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              TOTAL MONITORED
            </span>
            <span className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              DEPOT: UAE-ALL
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1 }}>
              {totalCount.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>units</span>
          </div>
          <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--signal-green)', marginTop: '8px' }}>
            100% INGESTION ONLINE
          </div>
        </div>

        {/* Cell 2: In Transit */}
        <div className="data-strip-cell">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              IN TRANSIT (MOVING)
            </span>
            <span style={{ fontSize: '9px', color: 'var(--signal-green)' }}>▲ ACTIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, color: 'var(--signal-green)' }}>
              {movingCount.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>units</span>
          </div>
          <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            AVG FLEET SPEED: 76.2 KM/H
          </div>
        </div>

        {/* Cell 3: Engine Idle (Flagged Attention in Amber) */}
        <div className="data-strip-cell attention">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--signal-amber)', letterSpacing: '0.06em', fontWeight: 700 }}>
              ENGINE IDLE (FLAGGED)
            </span>
            <span style={{ fontSize: '9px', color: 'var(--signal-amber)' }}>❚❚ ATTENTION</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, color: 'var(--signal-amber)' }}>
              {idleCount.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--signal-amber)' }}>unit</span>
          </div>
          <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--signal-amber)', marginTop: '8px', fontWeight: 600 }}>
            EST. FUEL LOSS: ~1.8 L/HR
          </div>
        </div>

        {/* Cell 4: Stopped */}
        <div className="data-strip-cell">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              PARKED / STOPPED
            </span>
            <span style={{ fontSize: '9px', color: 'var(--signal-red)' }}>■ OFF</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-muted)' }}>
              {stoppedCount.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>unit</span>
          </div>
          <div className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            IGNITION OFF IN DEPOT
          </div>
        </div>
      </div>

      {/* Two-Column Industrial Operations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr', gap: '16px' }}>
        {/* Active Telemetry Table (Real table, right-aligned monospace numbers) */}
        <div className="ops-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Active Vehicle Telemetry Stream
            </span>
            <span className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              TIMESCALEDB POSITIONS
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px', fontWeight: 600 }}>PLATE NO</th>
                  <th style={{ padding: '8px 6px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>SPEED</th>
                  <th style={{ padding: '8px 6px', fontWeight: 600 }}>IGNITION</th>
                  <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>ODOMETER</th>
                  <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>LAST PING</th>
                </tr>
              </thead>
              <tbody>
                {vehicleList.map((v) => {
                  const statusColor =
                    v.status === 'moving'
                      ? 'var(--signal-green)'
                      : v.status === 'idle'
                      ? 'var(--signal-blue)'
                      : 'var(--signal-red)';

                  const statusGlyph =
                    v.status === 'moving' ? '▲' : v.status === 'idle' ? '❚❚' : '■';

                  return (
                    <tr
                      key={v.device_id}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Plate */}
                      <td style={{ padding: '9px 6px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                        {v.reg_number}
                      </td>

                      {/* Status: Redundant glyph + label + desaturated color */}
                      <td style={{ padding: '9px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '9px', color: statusColor }}>{statusGlyph}</span>
                          <span className="mono-num" style={{ fontSize: '0.7rem', fontWeight: 600, color: statusColor }}>
                            {v.status.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Speed: Monospace right-aligned */}
                      <td className="mono-num-right" style={{ padding: '9px 6px', fontWeight: 600, color: v.speed > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {v.speed.toFixed(1)} km/h
                      </td>

                      {/* Ignition */}
                      <td style={{ padding: '9px 6px' }}>
                        <span className="mono-num" style={{ fontSize: '0.7rem', color: v.ignition ? 'var(--signal-green)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {v.ignition ? 'IGN:ON' : 'IGN:OFF'}
                        </span>
                      </td>

                      {/* Odometer: Monospace right-aligned */}
                      <td className="mono-num-right" style={{ padding: '9px 6px', color: 'var(--text-muted)' }}>
                        {v.odometer ? `${v.odometer.toLocaleString()} km` : '142,580 km'}
                      </td>

                      {/* Last Ping: Monospace right-aligned */}
                      <td className="mono-num-right" style={{ padding: '9px 6px', color: 'var(--text-muted)' }}>
                        {new Date(v.timestamp).toLocaleTimeString('en-GB', {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Telemetry Ingest Stream (Live Terminal / Event Ticker) */}
        <div className="ops-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', background: 'var(--signal-green)', display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Telemetry Ingest Stream
              </span>
            </div>
            <span className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              LIVE TCP :5040
            </span>
          </div>

          {/* Terminal Log Feed */}
          <div
            style={{
              flex: 1,
              background: '#0D0C09',
              border: '1px solid var(--line)',
              padding: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              lineHeight: 1.6,
              overflowY: 'auto',
            }}
          >
            {sampleLogs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '6px', display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.ts}</span>
                <span
                  style={{
                    color: log.level === 'ok' ? 'var(--signal-green)' : log.level === 'warn' ? 'var(--signal-amber)' : 'var(--signal-blue)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  [{log.tag}]
                </span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{log.msg}</span>
              </div>
            ))}

            {/* Live Terminal Cursor Line */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--signal-amber)' }}>
              <span>11:39:16.004</span>
              <span>[LISTENER]</span>
              <span style={{ color: 'var(--text-muted)' }}>Awaiting next Teltonika Codec 8 packet</span>
              <span className="cursor-blink" style={{ color: 'var(--signal-amber)', fontWeight: 700 }}>█</span>
            </div>
          </div>
        </div>
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

      {/* Dispatch Fleet Route Modal */}
      {isDispatchModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDispatchModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(520px, 95vw)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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
                <Navigation size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Dispatch Fleet Route
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleDispatchSubmit} style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Select Vehicle Plate
                  </label>
                  <select
                    value={dispatchForm.vehicle}
                    onChange={(e) => setDispatchForm((prev) => ({ ...prev, vehicle: e.target.value }))}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--line)',
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '0.8rem',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  >
                    <option value="DXB-A-98124">DXB-A-98124 (Mercedes Actros Heavy)</option>
                    <option value="DXB-B-43210">DXB-B-43210 (Volvo FH16 Flatbed)</option>
                    <option value="AUH-C-11029">AUH-C-11029 (Isuzu Reefer 4T)</option>
                    <option value="SHJ-D-77123">SHJ-D-77123 (MAN TGX Long-Haul)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Route Destination
                  </label>
                  <input
                    type="text"
                    value={dispatchForm.destination}
                    onChange={(e) => setDispatchForm((prev) => ({ ...prev, destination: e.target.value }))}
                    required
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
                      Assigned Driver
                    </label>
                    <input
                      type="text"
                      value={dispatchForm.driver}
                      onChange={(e) => setDispatchForm((prev) => ({ ...prev, driver: e.target.value }))}
                      required
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

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Manifest / Cargo Details
                    </label>
                    <input
                      type="text"
                      value={dispatchForm.cargo}
                      onChange={(e) => setDispatchForm((prev) => ({ ...prev, cargo: e.target.value }))}
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
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '20px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '6px 18px', gap: '6px' }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>Confirm Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
