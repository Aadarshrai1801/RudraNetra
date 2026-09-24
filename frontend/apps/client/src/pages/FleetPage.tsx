import React, { useState, useEffect } from 'react';
import { Plus, X, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface GatePass {
  passNo: string;
  vehicle: string;
  driver: string;
  destination: string;
  issuedAt: string;
  status: 'In Transit' | 'Returned' | 'Issued';
}

interface LoadingReceipt {
  lrNo: string;
  party: string;
  vehicle: string;
  weightKg: number;
  freightAmt: number;
  advanceAmt: number;
  status: 'Completed' | 'Pending';
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  licenseNo: string;
  assignedVehicle: string;
  status: 'Active' | 'On Leave';
}

export const FleetPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [lrs, setLRs] = useState<LoadingReceipt[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'gatepasses' | 'lr' | 'drivers'>('gatepasses');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newPass, setNewPass] = useState({
    vehicle: '',
    driver: '',
    destination: 'Jebel Ali Freezone Gate 7',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [gpRes, lrRes, drvRes] = await Promise.all([
        fetchWithAuth('/api/v1/fleet/gate-passes'),
        fetchWithAuth('/api/v1/fleet/lr'),
        fetchWithAuth('/api/v1/drivers'),
      ]);

      if (gpRes.ok) {
        const json = await gpRes.json();
        if (json.success && Array.isArray(json.data)) {
          setGatePasses(json.data);
        }
      }

      if (lrRes.ok) {
        const json = await lrRes.json();
        if (json.success && Array.isArray(json.data)) {
          setLRs(json.data);
        }
      }

      if (drvRes.ok) {
        const json = await drvRes.json();
        if (json.success && Array.isArray(json.data)) {
          setDrivers(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load fleet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

  useEffect(() => {
    if (vehicleList.length > 0 && !newPass.vehicle) {
      setNewPass((prev) => ({
        ...prev,
        vehicle: vehicleList[0].reg_number,
        driver: vehicleList[0].driver_name || '',
      }));
    }
  }, [vehicleList]);

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/v1/fleet/gate-passes', {
        method: 'POST',
        body: JSON.stringify(newPass),
      });

      if (res.ok) {
        const json = await res.json();
        showToast(`Gate pass ${json.passNo || 'issued'} for ${newPass.vehicle} recorded in database.`);
        setIsIssueModalOpen(false);
        loadData();
      } else {
        showToast('Failed to create gate pass.');
      }
    } catch (err) {
      showToast('Error issuing gate pass.');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1060px' }}>
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

      {/* Screen Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Fleet operations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Manage delivery gate passes, cargo receipts, and driver assignments.
          </p>
        </div>
        <button
          onClick={() => setIsIssueModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>Issue gate pass</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('gatepasses')}
          className={activeTab === 'gatepasses' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Active gate passes ({gatePasses.length})
        </button>
        <button
          onClick={() => setActiveTab('lr')}
          className={activeTab === 'lr' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Delivery receipts ({lrs.length})
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={activeTab === 'drivers' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Drivers ({drivers.length})
        </button>
      </div>

      {loading && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading records from database...
        </div>
      )}

      {/* Gate Passes Tab */}
      {activeTab === 'gatepasses' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pass number</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vehicle</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Driver</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Destination</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Issued at</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gatePasses.map((gp) => (
                <tr key={gp.passNo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--accent)' }}>
                    {gp.passNo}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {gp.vehicle}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{gp.driver}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>{gp.destination}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{gp.issuedAt}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className="badge badge-good">
                      <span className="status-dot status-dot-good" />
                      <span>{gp.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading Receipts Tab */}
      {activeTab === 'lr' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Receipt #</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client party</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vehicle</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cargo weight</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Freight</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lrs.map((lr) => (
                <tr key={lr.lrNo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--accent)' }}>
                    {lr.lrNo}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {lr.party}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{lr.vehicle}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>
                    <span className="tabular-num">{(lr.weightKg / 1000).toFixed(1)}</span> tons
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    AED <span className="tabular-num">{lr.freightAmt.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className={lr.status === 'Completed' ? 'badge badge-good' : 'badge badge-attention'}>
                      <span>{lr.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Driver name</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone number</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Driving license</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned vehicle</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {d.name}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--accent)' }}>
                    <a href={`tel:${d.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {d.phone}
                    </a>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{d.licenseNo}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {d.assignedVehicle}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className="badge badge-good">
                      <span className="status-dot status-dot-good" />
                      <span>{d.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Gate Pass Modal */}
      {isIssueModalOpen && (
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
                Issue a delivery gate pass
              </h3>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePass} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Select vehicle
                </label>
                <select
                  value={newPass.vehicle}
                  onChange={(e) => {
                    const selVeh = vehicleList.find(v => v.reg_number === e.target.value);
                    setNewPass({
                      ...newPass,
                      vehicle: e.target.value,
                      driver: selVeh?.driver_name || newPass.driver || (drivers[0]?.name || '')
                    });
                  }}
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
                  {vehicleList.length === 0 ? (
                    <option value="">No vehicles found</option>
                  ) : (
                    vehicleList.map((v) => (
                      <option key={v.device_id || v.reg_number} value={v.reg_number}>
                        {v.reg_number} ({v.name || 'Vehicle'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Driver
                </label>
                <select
                  value={newPass.driver}
                  onChange={(e) => setNewPass({ ...newPass, driver: e.target.value })}
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
                  {drivers.length === 0 ? (
                    <option value="">No drivers found</option>
                  ) : (
                    drivers.map((d) => (
                      <option key={d.id || d.name} value={d.name}>
                        {d.name} {d.phone ? `(${d.phone})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Destination
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jebel Ali Port Terminal 2"
                  value={newPass.destination}
                  onChange={(e) => setNewPass({ ...newPass, destination: e.target.value })}
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
                  onClick={() => setIsIssueModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Issue pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
