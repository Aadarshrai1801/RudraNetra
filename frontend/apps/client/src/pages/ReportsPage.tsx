import React, { useState, useEffect } from 'react';
import { 
  Download, Calendar, Car, Clock, 
  Fuel, Thermometer, ShieldAlert, Zap, MapPin, Users
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface ReportColumn {
  key: string;
  label: string;
}

type ReportRow = Record<string, unknown>;

interface ReportMeta {
  title: string;
  desc: string;
  icon: React.ElementType;
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const ReportsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());
  const [reportType, setReportType] = useState('distance');
  const [dateRange, setDateRange] = useState('today');
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);

  // Report catalog metadata. Table headers/cells always come from the API
  // response `columns`/`data` — never from this map.
  const reportMetadata: Record<string, ReportMeta> = {
    distance: {
      title: 'Daily Distance Summary',
      desc: 'Start & end odometer readings, total KM traversed, driving hours, and waiting times.',
      icon: Car,
    },
    'distance-matrix': {
      title: '31-Day Distance Matrix',
      desc: 'Day-by-day fleet distance ledger for client billing and logbooks.',
      icon: Calendar,
    },
    idling: {
      title: 'Excessive Idling Analysis',
      desc: 'Stationary vehicles with ignition ON, idle start/end times, and idle duration.',
      icon: Clock,
    },
    overspeed: {
      title: 'Overspeed Violations',
      desc: 'Speed threshold breaches with peak speed, configured limit, and exceed amount.',
      icon: ShieldAlert,
    },
    stoppage: {
      title: 'Vehicle Stoppage / Halt Log',
      desc: 'All parking halts with ignition OFF, arrival time, departure time, and halt duration.',
      icon: MapPin,
    },
    ac: {
      title: 'AC Compressor Run',
      desc: 'Report rows for this module as returned by your fleet reporting API.',
      icon: Zap,
    },
    fuel: {
      title: 'Fuel Consumption Log',
      desc: 'Recorded fuel quantities, cost, odometer and receipt counts per vehicle.',
      icon: Fuel,
    },
    temperature: {
      title: 'Cold-Chain Reefer Temperature Log',
      desc: 'Refrigerated reefer compartment temperature readings per vehicle.',
      icon: Thermometer,
    },
    battery: {
      title: 'Battery Disconnect & Powercut',
      desc: 'Report rows for this module as returned by your fleet reporting API.',
      icon: Zap,
    },
    poi: {
      title: 'Point of Interest (POI) Stopovers',
      desc: 'Report rows for this module as returned by your fleet reporting API.',
      icon: MapPin,
    },
    attendance: {
      title: 'Driver Duty & Attendance Log',
      desc: 'Report rows for this module as returned by your fleet reporting API.',
      icon: Users,
    },
    trips: {
      title: 'Fleet Trip Ledger',
      desc: 'Trip numbers, parties, routes, freight, expenses, and trip status.',
      icon: MapPin,
    },
    driver: {
      title: 'Driver Register',
      desc: 'Driver contact, license, assigned vehicle, and trip counts.',
      icon: Users,
    },
    reminders: {
      title: 'Maintenance & Compliance Reminders',
      desc: 'Upcoming vehicle reminders with due dates and remaining days.',
      icon: Clock,
    },
    geofence: {
      title: 'Geofence Activity',
      desc: 'Geofence zones with area and active vehicle counts.',
      icon: MapPin,
    },
    summary: {
      title: 'Fleet Summary',
      desc: 'Aggregated fleet metrics returned by the reporting API.',
      icon: Car,
    },
  };

  const currentMeta = reportMetadata[reportType] || {
    title: 'Fleet Report',
    desc: 'Report rows as returned by your fleet reporting API.',
    icon: Car,
  };
  const IconComponent = currentMeta.icon;

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/api/v1/reports/${reportType}?range=${encodeURIComponent(dateRange)}`);
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load report');
        setColumns(Array.isArray(json.columns) ? json.columns : []);
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        console.error('Failed to load report:', err);
        setColumns([]);
        setRows([]);
        setError('Unable to load this report right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportType, dateRange, user?.company_id]);

  const visibleRows =
    selectedVehicle === 'all'
      ? rows
      : rows.filter((row) =>
          Object.values(row).some((value) => typeof value === 'string' && value === selectedVehicle)
        );

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetchWithAuth(
        `/api/v1/reports/export/${reportType}?range=${encodeURIComponent(dateRange)}`
      );
      if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rudra_report_${reportType}_${dateRange}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export report:', err);
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const colSpan = Math.max(columns.length, 1);

  return (
    <div className="page-container" style={{ maxWidth: '1240px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconComponent size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Report
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            {currentMeta.desc}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn btn-primary"
          disabled={loading || exporting || visibleRows.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Download size={16} />
          <span>{exporting ? 'Exporting…' : 'Export Excel / CSV'}</span>
        </button>
      </div>

      {/* Report Type Selector Grid */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>
          Select Report Catalog
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'distance', label: 'Distance Summary' },
            { id: 'distance-matrix', label: '31-Day Distance Matrix' },
            { id: 'idling', label: 'Excessive Idling' },
            { id: 'overspeed', label: 'Overspeed Violations' },
            { id: 'stoppage', label: 'Stoppage & Halts' },
            { id: 'ac', label: 'AC Compressor Run' },
            { id: 'fuel', label: 'Fuel Consumption' },
            { id: 'temperature', label: 'Reefer Temperature' },
            { id: 'battery', label: 'Battery Disconnect' },
            { id: 'poi', label: 'POI Stopovers' },
            { id: 'attendance', label: 'Driver Attendance' },
            { id: 'trips', label: 'Trip Ledger' },
            { id: 'driver', label: 'Driver Register' },
            { id: 'reminders', label: 'Maintenance Reminders' },
            { id: 'geofence', label: 'Geofence Activity' },
            { id: 'summary', label: 'Fleet Summary' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setReportType(item.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: reportType === item.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: reportType === item.id ? 'var(--accent)' : 'var(--bg-card)',
                color: reportType === item.id ? '#FFFFFF' : 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: reportType === item.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Vehicle Filters */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <Calendar size={15} />
            <span>Time Window:</span>
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Current Month (31 Days)</option>
          </select>

          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="all">All Vehicles In Fleet ({vehicleList.length})</option>
            {vehicleList.map((v) => (
              <option key={v.device_id} value={v.reg_number}>
                {v.reg_number} {v.name ? `· ${v.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Active Module: <strong>{currentMeta.title}</strong>
        </div>
      </div>

      {/* Report Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {columns.length > 0 ? (
                  columns.map((col) => (
                    <th key={col.key} style={{ padding: '12px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {col.label}
                    </th>
                  ))
                ) : (
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Report</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    Loading report data…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    {error}
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    No rows returned for this report in the selected period.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '12px 16px',
                          fontWeight: colIdx === 0 ? 600 : 400,
                          color: colIdx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
