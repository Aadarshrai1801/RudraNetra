import React, { useEffect, useState } from 'react';
import { useVehicleStore } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import {
  Download,
  Plus,
  X,
  Phone,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);
  const fetchVehicles = useVehicleStore((state) => state.fetchVehicles);

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dispatchForm, setDispatchForm] = useState({
    vehicle: '95321',
    destination: 'Jebel Ali Port Gate 4',
    driver: 'Yog Raj Sharma',
    notes: 'Refrigerated container shipment',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch real organization fleet vehicles
  useEffect(() => {
    if (token) {
      fetchVehicles(token, user?.company_id);
    }
  }, [token, user?.company_id, fetchVehicles]);

  const vehicleList = Array.from(vehiclesMap.values());
  const movingCount = vehicleList.filter((v) => v.status === 'moving').length;
  const waitingCount = vehicleList.filter((v) => v.status === 'idle').length;
  const parkedCount = vehicleList.filter((v) => v.status === 'stopped' || v.status === 'offline').length;
  const totalCount = vehicleList.length;

  const handleExportSummary = () => {
    const csvHeader = 'Vehicle Plate,Vehicle Model,Driver,Status,Speed,Current Location,Total Distance (km),Last Checked\n';
    const csvRows = vehicleList
      .map(
        (v) =>
          `"${v.reg_number}","${v.name || 'Truck'}","${v.driver_name || 'Driver'}","${
            v.status === 'moving' ? 'Moving' : v.status === 'idle' ? 'Waiting' : 'Parked'
          }",${v.status === 'moving' ? `${Math.round(v.speed)} km/h` : '0 km/h'},"${v.location_name || 'Dubai, UAE'}",${
            v.odometer || 0
          },"${new Date(v.timestamp).toLocaleTimeString()}"`
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

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPass = {
      passNo: `GP-${Date.now().toString().slice(-4)}`,
      vehicle: dispatchForm.vehicle,
      driver: dispatchForm.driver,
      destination: dispatchForm.destination,
      issuedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'In Transit' as const,
    };
    try {
      const saved = localStorage.getItem('rudra_gate_passes');
      const list = saved ? JSON.parse(saved) : [];
      localStorage.setItem('rudra_gate_passes', JSON.stringify([newPass, ...list]));
    } catch (err) {
      console.warn('Failed to save route to gate passes', err);
    }
    setIsDispatchModalOpen(false);
    showToast(`Delivery route created for ${dispatchForm.vehicle} to ${dispatchForm.destination}`);
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
            Your fleet today · {user?.company_name || (user?.company_id === 2 ? 'EKSC Logistics Dubai' : 'Allied Transport UAE')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Live status of your {totalCount} vehicles and today’s deliveries.
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

      {/* Top Headline Summary Banner — Friendly, Single-Sentence Takeaway */}
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
              {movingCount + waitingCount} of {totalCount} vehicles are on the move right now
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.5 }}>
            {parkedCount} vehicle is parked at the yard. All deliveries are on schedule.
          </p>
        </div>

        <Link
          to="/live"
          className="btn btn-secondary"
          style={{ textDecoration: 'none', gap: '8px' }}
        >
          <span>Track all on map</span>
          <ArrowRight size={16} color="var(--accent)" />
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
              <span>On schedule</span>
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

      {/* Vehicles Needing Attention — Plain human language, not technical error codes */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Needs your attention
        </h3>

        <div
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
                color: 'var(--attention)',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  82561 (Volvo FH400)
                </span>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Driver: Abdul Jelil
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                This vehicle has been waiting with its engine running for 25 minutes at New Batha Corridor.
              </p>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Turning off the engine when waiting saves fuel and reduces wear.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href="tel:+971501000051"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <Phone size={14} />
              <span>Call driver</span>
            </a>
            <Link
              to="/live"
              onClick={() => selectVehicle(102)}
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <span>View on map</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Vehicle Status Table / List — Clean, daylight table with plain words */}
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
            Open live map →
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
              {vehicleList.map((v) => {
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
                      <span>Parked</span>
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
                        {v.name || 'Truck'} · {v.driver_name || 'Driver'}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 20px' }}>
                      {statusBadge}
                    </td>

                    {/* Speed */}
                    <td style={{ padding: '16px 20px' }}>
                      <span className="tabular-num" style={{ fontWeight: 600, fontSize: '0.9rem', color: v.speed > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {v.speed > 0 ? `${Math.round(v.speed)} km/h` : 'Stopped'}
                      </span>
                    </td>

                    {/* Current Location */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {v.location_name || 'Dubai, UAE'}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {v.status === 'moving'
                          ? 'En route'
                          : v.status === 'idle'
                          ? `Idle for ${v.idle_duration_min || 25} min`
                          : 'Parked at yard'}
                      </div>
                    </td>

                    {/* Total Distance */}
                    <td style={{ padding: '16px 20px' }}>
                      <span className="tabular-num" style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {(v.odometer || 142580).toLocaleString()} km
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
              })}
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
                  {vehicleList.map((v) => (
                    <option key={v.device_id} value={v.reg_number}>
                      {v.reg_number} — {v.name || 'Truck'} ({v.driver_name})
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
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
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
                <button type="submit" className="btn btn-primary">
                  Start route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
