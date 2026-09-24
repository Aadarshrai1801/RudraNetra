import React, { useState } from 'react';
import { Plus, X, CheckCircle2 } from 'lucide-react';

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

const mockGatePasses: GatePass[] = [
  { passNo: 'GP-2026-0901', vehicle: 'DXB-A-98124', driver: 'Mohammed Imran', destination: 'Jebel Ali Port Terminal 2', issuedAt: '08:30 am', status: 'In Transit' },
  { passNo: 'GP-2026-0902', vehicle: 'DXB-B-43210', driver: 'Harpreet Singh', destination: 'Sharjah Industrial Zone 4', issuedAt: '09:15 am', status: 'In Transit' },
  { passNo: 'GP-2026-0903', vehicle: 'AUH-C-11029', driver: 'Ahmed Al-Falasi', destination: 'Abu Dhabi Mina Free Port', issuedAt: '07:45 am', status: 'In Transit' },
];

const mockLRs: LoadingReceipt[] = [
  { lrNo: 'LR-88410', party: 'Emirates Global Aluminium', vehicle: 'DXB-A-98124', weightKg: 24500, freightAmt: 3200, advanceAmt: 1000, status: 'Completed' },
  { lrNo: 'LR-88411', party: 'Al Marai Cold Logistics', vehicle: 'AUH-C-11029', weightKg: 8200, freightAmt: 1850, advanceAmt: 500, status: 'Completed' },
  { lrNo: 'LR-88412', party: 'Danube Building Materials', vehicle: 'DXB-B-43210', weightKg: 28000, freightAmt: 4100, advanceAmt: 1500, status: 'Pending' },
];

const mockDrivers: Driver[] = [
  { id: 1, name: 'Mohammed Imran', phone: '+971 50 998 8771', licenseNo: 'DXB-HV-884102', assignedVehicle: 'DXB-A-98124', status: 'Active' },
  { id: 2, name: 'Harpreet Singh', phone: '+971 55 443 3221', licenseNo: 'DXB-HV-993214', assignedVehicle: 'DXB-B-43210', status: 'Active' },
  { id: 3, name: 'Ahmed Al-Falasi', phone: '+971 52 112 2334', licenseNo: 'AUH-LC-442198', assignedVehicle: 'AUH-C-11029', status: 'Active' },
];

export const FleetPage: React.FC = () => {
  const [gatePasses, setGatePasses] = useState<GatePass[]>(mockGatePasses);
  const [activeTab, setActiveTab] = useState<'gatepasses' | 'lr' | 'drivers'>('gatepasses');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newPass, setNewPass] = useState({
    vehicle: 'DXB-A-98124',
    driver: 'Mohammed Imran',
    destination: 'Jebel Ali Freezone Gate 7',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreatePass = (e: React.FormEvent) => {
    e.preventDefault();
    const created: GatePass = {
      passNo: `GP-${Date.now().toString().slice(-4)}`,
      vehicle: newPass.vehicle,
      driver: newPass.driver,
      destination: newPass.destination,
      issuedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'In Transit',
    };
    setGatePasses([created, ...gatePasses]);
    setIsIssueModalOpen(false);
    showToast(`Gate pass ${created.passNo} issued for ${created.vehicle}`);
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
          Delivery receipts ({mockLRs.length})
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={activeTab === 'drivers' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Drivers ({mockDrivers.length})
        </button>
      </div>

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
              {mockLRs.map((lr) => (
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
              {mockDrivers.map((d) => (
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
                  onChange={(e) => setNewPass({ ...newPass, vehicle: e.target.value })}
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
                  <option value="DXB-A-98124">DXB-A-98124 (Mercedes Actros)</option>
                  <option value="DXB-B-43210">DXB-B-43210 (Volvo FH16)</option>
                  <option value="AUH-C-11029">AUH-C-11029 (Isuzu Reefer)</option>
                  <option value="SHJ-D-77123">SHJ-D-77123 (Toyota Hilux)</option>
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
                  <option value="Mohammed Imran">Mohammed Imran</option>
                  <option value="Harpreet Singh">Harpreet Singh</option>
                  <option value="Ahmed Al-Falasi">Ahmed Al-Falasi</option>
                  <option value="Rajesh Patel">Rajesh Patel</option>
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
