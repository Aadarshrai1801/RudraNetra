import React, { useState } from 'react';
import { Download } from 'lucide-react';

interface DistanceRow {
  deviceId: number;
  regNumber: string;
  driver: string;
  vehicleName: string;
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
    regNumber: '95321',
    vehicleName: 'Volvo FH400',
    driver: 'Yog Raj Sharma',
    startOdo: 1424100,
    endOdo: 1425800,
    distanceKm: 170.0,
    maxSpeed: 84.5,
    avgSpeed: 62.1,
    runningMin: 164,
    idleMin: 22,
    stopMin: 45,
  },
  {
    deviceId: 102,
    regNumber: '82561',
    vehicleName: 'Volvo FH400',
    driver: 'Abdul Jelil',
    startOdo: 457310,
    endOdo: 457530,
    distanceKm: 220.0,
    maxSpeed: 78.0,
    avgSpeed: 58.4,
    runningMin: 226,
    idleMin: 25,
    stopMin: 60,
  },
  {
    deviceId: 106,
    regNumber: '84707',
    vehicleName: 'Volvo FH400',
    driver: 'Muhammad Rizwan',
    startOdo: 555410,
    endOdo: 555700,
    distanceKm: 290.0,
    maxSpeed: 90.0,
    avgSpeed: 71.0,
    runningMin: 245,
    idleMin: 30,
    stopMin: 35,
  },
  {
    deviceId: 104,
    regNumber: '99292',
    vehicleName: 'Volvo FH400',
    driver: 'Abu Taleb Baker',
    startOdo: 4256510,
    endOdo: 4256550,
    distanceKm: 40.0,
    maxSpeed: 65.0,
    avgSpeed: 42.0,
    runningMin: 57,
    idleMin: 12,
    stopMin: 180,
  },
  {
    deviceId: 184,
    regNumber: '33566',
    vehicleName: 'Mercedes-Benz 1843',
    driver: 'Salman Moufid',
    startOdo: 1783510,
    endOdo: 1783790,
    distanceKm: 280.0,
    maxSpeed: 82.0,
    avgSpeed: 64.0,
    runningMin: 260,
    idleMin: 18,
    stopMin: 50,
  },
];

export const ReportsPage: React.FC = () => {
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  const filteredData = mockDistanceData.filter(
    (row) => selectedVehicle === 'all' || row.regNumber === selectedVehicle
  );

  const totalDistance = filteredData.reduce((acc, row) => acc + row.distanceKm, 0);

  const handleExportCSV = () => {
    const headers = 'Vehicle,Model,Driver,Distance (km),Driving Time,Waiting Time,Top Speed (km/h)\n';
    const csvContent =
      headers +
      filteredData
        .map(
          (r) =>
            `"${r.regNumber}","${r.vehicleName}","${r.driver}",${r.distanceKm},"${Math.floor(r.runningMin / 60)}h ${r.runningMin % 60}m","${r.idleMin}m",${r.maxSpeed}`
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fleet_distance_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container" style={{ maxWidth: '1060px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Reports
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Download mileage, driving time, and waiting time summaries for your fleet.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn btn-primary"
        >
          <Download size={16} />
          <span>Download spreadsheet (.csv)</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
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
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
              Time period
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-family)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 days</option>
              <option value="thismonth">This month</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
              Filter by vehicle
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              style={{
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-family)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All vehicles ({mockDistanceData.length})</option>
              {mockDistanceData.map((d) => (
                <option key={d.deviceId} value={d.regNumber}>
                  {d.regNumber} ({d.driver})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Total distance callout */}
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>
            Total fleet distance
          </span>
          <span className="tabular-num" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>
            {totalDistance.toFixed(1)} km
          </span>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vehicle & driver</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Distance</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Driving time</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Waiting time</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Top speed</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr key={row.deviceId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.regNumber}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {row.vehicleName} · {row.driver}
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span className="tabular-num" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {row.distanceKm.toFixed(1)} km
                  </span>
                </td>
                <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                  {Math.floor(row.runningMin / 60)}h {row.runningMin % 60}m
                </td>
                <td style={{ padding: '16px 20px', color: row.idleMin > 20 ? 'var(--attention)' : 'var(--text-secondary)' }}>
                  {row.idleMin} min
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span className="tabular-num" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {row.maxSpeed.toFixed(1)} km/h
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
