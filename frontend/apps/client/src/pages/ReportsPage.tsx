import React, { useState } from 'react';
import { Download } from 'lucide-react';

interface DistanceRow {
  deviceId: number;
  regNumber: string;
  driver: string;
  startOdo: number;
  endOdo: number;
  distanceKm: number;
  maxSpeed: number;
  avgSpeed: number;
  runningMin: number;
  idleMin: number;
  stopMin: number;
}

const mockDistanceData: DistanceRow[] = [
  {
    deviceId: 101,
    regNumber: 'DXB-A-98124',
    driver: 'Mohammed Imran',
    startOdo: 142410,
    endOdo: 142580,
    distanceKm: 170.0,
    maxSpeed: 84.5,
    avgSpeed: 62.1,
    runningMin: 164,
    idleMin: 22,
    stopMin: 45,
  },
  {
    deviceId: 102,
    regNumber: 'DXB-B-43210',
    driver: 'Harpreet Singh',
    startOdo: 89120,
    endOdo: 89340,
    distanceKm: 220.0,
    maxSpeed: 78.0,
    avgSpeed: 58.4,
    runningMin: 226,
    idleMin: 14,
    stopMin: 60,
  },
  {
    deviceId: 103,
    regNumber: 'AUH-C-11029',
    driver: 'Ahmed Al-Falasi',
    startOdo: 210650,
    endOdo: 210940,
    distanceKm: 290.0,
    maxSpeed: 89.2,
    avgSpeed: 71.0,
    runningMin: 245,
    idleMin: 30,
    stopMin: 35,
  },
  {
    deviceId: 104,
    regNumber: 'SHJ-D-77123',
    driver: 'Rashid Khan',
    startOdo: 64080,
    endOdo: 64120,
    distanceKm: 40.0,
    maxSpeed: 65.0,
    avgSpeed: 42.0,
    runningMin: 57,
    idleMin: 12,
    stopMin: 180,
  },
];

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('distance');
  const [dateRange, setDateRange] = useState('today');
  const [selectedVehicle, setSelectedVehicle] = useState('all');

  const filteredData = mockDistanceData.filter(
    (row) => selectedVehicle === 'all' || row.regNumber === selectedVehicle
  );

  const totalDistance = filteredData.reduce((acc, row) => acc + row.distanceKm, 0);

  const handleExportCSV = () => {
    const headers = 'Device ID,Plate Number,Driver,Start Odometer,End Odometer,Distance (km),Max Speed (km/h),Avg Speed (km/h),Running (min),Idle (min),Stopped (min)\n';
    const csvContent =
      headers +
      filteredData
        .map(
          (r) =>
            `${r.deviceId},${r.regNumber},"${r.driver}",${r.startOdo},${r.endOdo},${r.distanceKm},${r.maxSpeed},${r.avgSpeed},${r.runningMin},${r.idleMin},${r.stopMin}`
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rudra_distance_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Fleet Telematics Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            High-speed telemetry analytics, trip logs, and compliance export engine.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn btn-primary"
          style={{ gap: '8px', fontSize: '0.85rem' }}
        >
          <Download size={16} />
          Export Spreadsheet (.csv)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="distance">Distance & Runtime Summary</option>
              <option value="speed">Overspeed Violations</option>
              <option value="stoppage">Stationary / Stoppage Log</option>
              <option value="trip">Trip Route Breakdown</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="today">Today (Live)</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="month">Current Month</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Filter Vehicle
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="all">All Vehicles (4)</option>
              <option value="DXB-A-98124">DXB-A-98124 (Actros)</option>
              <option value="DXB-B-43210">DXB-B-43210 (Volvo FH)</option>
              <option value="AUH-C-11029">AUH-C-11029 (Isuzu)</option>
              <option value="SHJ-D-77123">SHJ-D-77123 (Hilux)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <span>Total Distance:</span>
          <span style={{ fontWeight: 800, color: 'var(--cyan-accent)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
            {totalDistance.toFixed(1)} km
          </span>
        </div>
      </div>

      {/* Main Report Table */}
      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 10px' }}>Vehicle Plate</th>
              <th style={{ padding: '12px 10px' }}>Assigned Driver</th>
              <th style={{ padding: '12px 10px' }}>Start Odo</th>
              <th style={{ padding: '12px 10px' }}>End Odo</th>
              <th style={{ padding: '12px 10px' }}>Distance</th>
              <th style={{ padding: '12px 10px' }}>Max Speed</th>
              <th style={{ padding: '12px 10px' }}>Avg Speed</th>
              <th style={{ padding: '12px 10px' }}>Running Time</th>
              <th style={{ padding: '12px 10px' }}>Idle Time</th>
              <th style={{ padding: '12px 10px' }}>Stops</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr key={row.deviceId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '14px 10px', fontWeight: 700, color: '#fff' }}>
                  {row.regNumber}
                </td>
                <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>
                  {row.driver}
                </td>
                <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>
                  {row.startOdo.toLocaleString()} km
                </td>
                <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>
                  {row.endOdo.toLocaleString()} km
                </td>
                <td style={{ padding: '14px 10px', fontWeight: 700, color: 'var(--cyan-accent)', fontFamily: 'var(--font-mono)' }}>
                  {row.distanceKm.toFixed(1)} km
                </td>
                <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>
                  {row.maxSpeed.toFixed(1)} km/h
                </td>
                <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>
                  {row.avgSpeed.toFixed(1)} km/h
                </td>
                <td style={{ padding: '14px 10px', color: '#10b981' }}>
                  {Math.floor(row.runningMin / 60)}h {row.runningMin % 60}m
                </td>
                <td style={{ padding: '14px 10px', color: '#f59e0b' }}>
                  {row.idleMin} min
                </td>
                <td style={{ padding: '14px 10px', color: '#64748b' }}>
                  {row.stopMin} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
