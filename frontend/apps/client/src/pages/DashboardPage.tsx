import React, { useCallback, useEffect, useState } from 'react';
import { useVehicleStore } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import {
  Download,
  Plus,
  X,
  Phone,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface DashboardSummary {
  totalVehicles: number;
  online: number;
  moving: number;
  idle: number;
  stopped: number;
  offline: number;
  unacknowledgedAlerts: number;
}

interface FleetAlert {
  id: number;
  type: string;
  severity: string;
  vehicle: string;
  driver: string;
  driverPhone: string;
  message: string;
  time: string;
  timestamp: string;
  acknowledged: boolean;
}

interface GatePass {
  id: number;
  passNo: string;
  vehicle: string;
  driver: string;
  destination: string;
  issuedAt: string;
  status: string;
}

const statusLabel = (status?: string): string => {
  switch (status) {
    case 'moving':
      return 'Moving';
    case 'idle':
      return 'Waiting';
    case 'stopped':
      return 'Parked';
    case 'offline':
      return 'Offline';
    default:
      return status || '—';
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
};

export const DashboardPage: React.FC = () => {
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);
  const fetchVehicles = useVehicleStore((state) => state.fetchVehicles);

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    vehicle: '',
    destination: '',
    purpose: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/dashboard/summary');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/alerts');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAlerts(json.data);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }, []);

  const loadGatePasses = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/fleet/gate-passes');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setGatePasses(json.data);
      }
    } catch (err) {
      console.error('Failed to load gate passes:', err);
    }
  }, []);

  // Fetch real organization fleet vehicles, dashboard summary, alerts and gate passes
  useEffect(() => {
    fetchVehicles(token || undefined, user?.company_id);
    loadSummary();
    loadAlerts();
    loadGatePasses();
  }, [token, user?.company_id, fetchVehicles, loadSummary, loadAlerts, loadGatePasses]);

  const vehicleList = Array.from(vehiclesMap.values());
  const movingCount = summary?.moving ?? vehicleList.filter((v) => v.status === 'moving').length;
  const waitingCount = summary?.idle ?? vehicleList.filter((v) => v.status === 'idle').length;
  const parkedCount = summary
    ? summary.stopped + summary.offline
    : vehicleList.filter((v) => v.status === 'stopped' || v.status === 'offline').length;
  const totalCount = summary?.totalVehicles ?? vehicleList.length;

  const attentionAlerts = alerts.filter(
    (a) => !a.acknowledged && (a.severity === 'critical' || a.severity === 'warning')
  );

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/v1/alerts/${id}/acknowledge`, { method: 'PUT' });
      if (!res.ok) {
        showToast('Failed to acknowledge alert.');
        return;
      }
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
      showToast('Alert acknowledged.');
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      showToast('Failed to acknowledge alert.');
    }
  };

  const handleExportSummary = () => {
    const csvHeader = 'Vehicle Plate,Vehicle Model,Driver,Status,Speed,Current Location,Total Distance (km),Last Checked\n';
    const csvRows = vehicleList
      .map(
        (v) =>
          `"${v.reg_number}","${v.name || '—'}","${v.driver_name || '—'}","${statusLabel(v.status)}",${
            v.speed !== undefined && v.speed !== null ? `${Math.round(v.speed)} km/h` : '—'
          },"${v.location_name || '—'}",${v.odometer !== undefined && v.odometer !== null ? v.odometer : '—'},"${formatDateTime(v.timestamp)}"`
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fleet_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Fleet trip summary downloaded (.csv)');
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchForm.vehicle) {
      showToast('Select a vehicle first.');
      return;
    }
    const selected = vehicleList.find((v) => v.reg_number === dispatchForm.vehicle);
    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/v1/fleet/gate-passes', {
        method: 'POST',
        body: JSON.stringify({
          vehicle: dispatchForm.vehicle,
          driver: selected?.driver_name || '',
          destination: dispatchForm.destination,
          purpose: dispatchForm.purpose,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        showToast(json?.error || 'Failed to create gate pass.');
        return;
      }
      setIsDispatchModalOpen(false);
      showToast(`Gate pass created for ${dispatchForm.vehicle} to ${dispatchForm.destination}`);
      setDispatchForm({ vehicle: '', destination: '', purpose: '' });
      loadGatePasses();
    } catch (err) {
      console.error('Failed to create gate pass:', err);
      showToast('Failed to create gate pass.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1120px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} color="var(--good)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Title & Top Actions */}
      <div
        style={{
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Your fleet today{user?.company_name ? ` · ${user.company_name}` : ''}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Live status of your {totalCount} vehicles.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportSummary} className="btn btn-secondary">
            <Download size={16} />
            <span>Download trip summary</span>
          </button>
          <button onClick={() => setIsDispatchModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>New delivery route</span>
          </button>
        </div>
      </div>

      {/* Top Headline Summary Banner */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--good)',
                display: 'inline-block',
              }}
            />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {movingCount} of {totalCount} vehicles are moving right now
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.5 }}>
            {waitingCount} waiting with engine on · {parkedCount} parked or offline.
          </p>
        </div>

        <Link
          to="/live"
          className="btn btn-secondary"
          style={{ textDecoration: 'none', gap: '8px' }}
        >
          <span>Track all on map</span>
        </Link>
      </div>

      {/* 3 Simple, Calm Status Counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Moving */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Moving
            </span>
            <span className="badge badge-good">
              <span className="status-dot status-dot-good" />
              <span>Live</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="tabular-num" style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {movingCount}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              vehicles on the road
            </span>
          </div>
        </div>

        {/* Waiting */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Waiting
            </span>
            <span className="badge badge-attention">
              <span className="status-dot status-dot-attention" />
              <span>Engine on</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="tabular-num" style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {waitingCount}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              vehicle stopped with engine on
            </span>
          </div>
        </div>

        {/* Parked */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Parked
            </span>
            <span className="badge badge-neutral">
              <span className="status-dot status-dot-neutral" />
              <span>Engine off</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="tabular-num" style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {parkedCount}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              vehicle parked at depot
            </span>
          </div>
        </div>
      </div>

      {/* Unacknowledged critical / warning alerts from GET /api/v1/alerts */}
      {attentionAlerts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Needs your attention
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {attentionAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                style={{
                  background: 'var(--attention-bg)',
                  border: '1px solid var(--attention-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: '#FFFFFF',
                      border: '1px solid var(--attention-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: alert.severity === 'critical' ? '#DC2626' : 'var(--attention)',
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {alert.vehicle || '—'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: alert.severity === 'critical' ? '#FEE2E2' : '#FEF3C7',
                          color: alert.severity === 'critical' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {alert.severity || '—'}
                      </span>
                      {alert.driver && (
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                          Driver: {alert.driver}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {alert.message || '—'}
                    </p>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {alert.time || alert.timestamp || '—'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {alert.driverPhone && (
                    <a
                      href={`tel:${alert.driverPhone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      <Phone size={14} />
                      <span>Call driver</span>
                    </a>
                  )}
                  <Link
                    to="/live"
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    <span>View on map</span>
                  </Link>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="btn btn-primary btn-sm"
                  >
                    <span>Acknowledge</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {attentionAlerts.length > 5 && (
            <Link
              to="/alerts"
              style={{
                display: 'inline-block',
                marginTop: '10px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              View all {attentionAlerts.length} unacknowledged alerts
            </Link>
          )}
        </div>
      )}

      {/* Vehicle Status Table / List */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              All vehicles
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Where each truck is right now and what it’s doing
            </p>
          </div>
          <Link
            to="/live"
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            Open live map
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 24px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Vehicle & driver
                </th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Status
                </th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Speed
                </th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Current location
                </th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Total distance
                </th>
                <th style={{ padding: '12px 24px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {vehicleList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No vehicles found for this organization.
                  </td>
                </tr>
              ) : (
                vehicleList.map((v) => {
                  const statusBadge =
                    v.status === 'moving' ? (
                      <span className="badge badge-good">
                        <span className="status-dot status-dot-good" />
                        <span>Moving</span>
                      </span>
                    ) : v.status === 'idle' ? (
                      <span className="badge badge-attention">
                        <span className="status-dot status-dot-attention" />
                        <span>Waiting</span>
                      </span>
                    ) : (
                      <span className="badge badge-neutral">
                        <span className="status-dot status-dot-neutral" />
                        <span>{statusLabel(v.status)}</span>
                      </span>
                    );

                  return (
                    <tr
                      key={v.device_id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                    >
                      {/* Vehicle & Driver */}
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {v.reg_number}
                        </div>
                        <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {v.name || '—'} · {v.driver_name || '—'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {statusBadge}
                      </td>

                      {/* Speed */}
                      <td style={{ padding: '16px 20px' }}>
                        <span className="tabular-num" style={{ fontWeight: 600, fontSize: '0.9rem', color: v.speed !== undefined && v.speed > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {v.speed !== undefined && v.speed !== null ? `${Math.round(v.speed)} km/h` : '—'}
                        </span>
                      </td>

                      {/* Current Location */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {v.location_name || '—'}
                        </div>
                        <div style={{ fontSize: '0.775rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {v.status === 'moving'
                            ? 'En route'
                            : v.status === 'idle'
                            ? v.idle_duration_min !== undefined && v.idle_duration_min !== null
                              ? `Idle for ${v.idle_duration_min} min`
                              : 'Idle'
                            : statusLabel(v.status)}
                        </div>
                      </td>

                      {/* Total Distance */}
                      <td style={{ padding: '16px 20px' }}>
                        <span className="tabular-num" style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {v.odometer !== undefined && v.odometer !== null
                            ? `${v.odometer.toLocaleString()} km`
                            : '—'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <Link
                          to="/live"
                          onClick={() => selectVehicle(v.device_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ textDecoration: 'none' }}
                        >
                          Track
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gate Passes — loaded from GET /api/v1/fleet/gate-passes */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Recent gate passes
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Gate passes issued by your organization
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 24px', fontSize: '0.8rem', fontWeight: 600 }}>Pass No</th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600 }}>Vehicle</th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600 }}>Driver</th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600 }}>Destination</th>
                <th style={{ padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600 }}>Issued At</th>
                <th style={{ padding: '12px 24px', fontSize: '0.8rem', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gatePasses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No gate passes issued yet.
                  </td>
                </tr>
              ) : (
                gatePasses.map((pass) => (
                  <tr key={pass.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {pass.passNo || '—'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>{pass.vehicle || '—'}</td>
                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{pass.driver || '—'}</td>
                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{pass.destination || '—'}</td>
                    <td style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                      {pass.issuedAt || '—'}
                    </td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{pass.status || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Delivery Route Modal */}
      {isDispatchModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(30, 37, 33, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              width: '100%',
              maxWidth: '480px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Create a delivery route
              </h3>
              <button
                onClick={() => setIsDispatchModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Select vehicle
                </label>
                <select
                  required
                  value={dispatchForm.vehicle}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-family)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="" disabled>
                    Select a vehicle
                  </option>
                  {vehicleList.map((v) => (
                    <option key={v.device_id} value={v.reg_number}>
                      {v.reg_number} — {v.name || '—'} {v.driver_name ? `(${v.driver_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Destination address
                </label>
                <input
                  type="text"
                  required
                  value={dispatchForm.destination}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
                  placeholder="e.g. Jebel Ali Port Terminal 2"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-family)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Delivery notes
                </label>
                <input
                  type="text"
                  value={dispatchForm.purpose}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, purpose: e.target.value })}
                  placeholder="e.g. Refrigerated cargo, deliver before 3pm"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-family)',
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Start route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
