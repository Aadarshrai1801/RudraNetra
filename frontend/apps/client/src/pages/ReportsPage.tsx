import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

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

export const ReportsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [reportData, setReportData] = useState<DistanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/api/v1/reports/distance?range=${dateRange}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setReportData(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [user?.company_id, dateRange]);

  const filteredData = reportData.filter(
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
          disabled={loading || filteredData.length === 0}
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
              <option value="all">All vehicles ({reportData.length})</option>
              {reportData.map((d) => (
                <option key={d.deviceId || d.regNumber} value={d.regNumber}>
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
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading report data from database...
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No vehicle report records found for this period.
          </div>
        ) : (
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
                <tr key={row.deviceId || row.regNumber} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
        )}
      </div>
    </div>
  );
};
