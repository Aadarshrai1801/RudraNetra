import React, { useState } from 'react';
import { Plus, X, Check, Truck } from 'lucide-react';

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
  rfidTag: string;
  assignedVehicle: string;
  status: 'Active' | 'On Leave';
}

const mockGatePasses: GatePass[] = [
  { passNo: 'GP-2026-0901', vehicle: 'DXB-A-98124', driver: 'Mohammed Imran', destination: 'Jebel Ali Port Terminal 2', issuedAt: '08:30 AM', status: 'In Transit' },
  { passNo: 'GP-2026-0902', vehicle: 'DXB-B-43210', driver: 'Harpreet Singh', destination: 'Sharjah Industrial Zone 4', issuedAt: '09:15 AM', status: 'In Transit' },
  { passNo: 'GP-2026-0903', vehicle: 'AUH-C-11029', driver: 'Ahmed Al-Falasi', destination: 'Abu Dhabi Mina Free Port', issuedAt: '07:45 AM', status: 'In Transit' },
];

const mockLRs: LoadingReceipt[] = [
  { lrNo: 'LR-88410', party: 'Emirates Global Aluminium', vehicle: 'DXB-A-98124', weightKg: 24500, freightAmt: 3200, advanceAmt: 1000, status: 'Completed' },
  { lrNo: 'LR-88411', party: 'Al Marai Cold Logistics', vehicle: 'AUH-C-11029', weightKg: 8200, freightAmt: 1850, advanceAmt: 500, status: 'Completed' },
  { lrNo: 'LR-88412', party: 'Danube Building Materials', vehicle: 'DXB-B-43210', weightKg: 28000, freightAmt: 4100, advanceAmt: 1500, status: 'Pending' },
];

const mockDrivers: Driver[] = [
  { id: 1, name: 'Mohammed Imran', phone: '+971-50-9988771', licenseNo: 'DXB-HV-884102', rfidTag: 'RFID-TAG-001', assignedVehicle: 'DXB-A-98124', status: 'Active' },
  { id: 2, name: 'Harpreet Singh', phone: '+971-55-4433221', licenseNo: 'DXB-HV-993214', rfidTag: 'RFID-TAG-002', assignedVehicle: 'DXB-B-43210', status: 'Active' },
  { id: 3, name: 'Ahmed Al-Falasi', phone: '+971-52-1122334', licenseNo: 'AUH-LC-442198', rfidTag: 'RFID-TAG-003', assignedVehicle: 'AUH-C-11029', status: 'Active' },
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

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created: GatePass = {
      passNo: `GP-2026-090${gatePasses.length + 1}`,
      vehicle: newPass.vehicle,
      driver: newPass.driver,
      destination: newPass.destination,
      issuedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Issued',
    };
    setGatePasses((prev) => [created, ...prev]);
    setIsIssueModalOpen(false);
    showToast(`Gate Pass ${created.passNo} issued for ${created.vehicle}.`);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Fleet Operations & Dispatch</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Operations registry for vehicle assignments, gate passes, and driver credentials.
          </p>
        </div>
        <button
          onClick={() => setIsIssueModalOpen(true)}
          className="btn btn-primary"
          style={{ gap: '8px' }}
        >
          <Plus size={16} />
          Issue New Pass / LR
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('gatepasses')}
          className="btn"
          style={{
            background: activeTab === 'gatepasses' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Gate Passes ({gatePasses.length})
        </button>
        <button
          onClick={() => setActiveTab('lr')}
          className="btn"
          style={{
            background: activeTab === 'lr' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Loading Receipts / LR ({mockLRs.length})
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className="btn"
          style={{
            background: activeTab === 'drivers' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Driver Roster ({mockDrivers.length})
        </button>
      </div>

      {/* Gate Passes Table */}
      {activeTab === 'gatepasses' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>Pass #</th>
                <th style={{ padding: '12px 10px' }}>Vehicle</th>
                <th style={{ padding: '12px 10px' }}>Driver</th>
                <th style={{ padding: '12px 10px' }}>Destination</th>
                <th style={{ padding: '12px 10px' }}>Issued At</th>
                <th style={{ padding: '12px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gatePasses.map((gp) => (
                <tr key={gp.passNo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan-accent)' }}>
                    {gp.passNo}
                  </td>
                  <td style={{ padding: '14px 10px', fontWeight: 600, color: '#fff' }}>{gp.vehicle}</td>
                  <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>{gp.driver}</td>
                  <td style={{ padding: '14px 10px' }}>{gp.destination}</td>
                  <td style={{ padding: '14px 10px', color: 'var(--text-muted)' }}>{gp.issuedAt}</td>
                  <td style={{ padding: '14px 10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: 'rgba(2,132,199,0.2)',
                        color: 'var(--cyan-accent)',
                      }}
                    >
                      {gp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* LR Table */}
      {activeTab === 'lr' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>LR Number</th>
                <th style={{ padding: '12px 10px' }}>Transport Party</th>
                <th style={{ padding: '12px 10px' }}>Vehicle</th>
                <th style={{ padding: '12px 10px' }}>Cargo Weight</th>
                <th style={{ padding: '12px 10px' }}>Freight (AED)</th>
                <th style={{ padding: '12px 10px' }}>Advance (AED)</th>
                <th style={{ padding: '12px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockLRs.map((lr) => (
                <tr key={lr.lrNo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan-accent)' }}>
                    {lr.lrNo}
                  </td>
                  <td style={{ padding: '14px 10px', fontWeight: 600, color: '#fff' }}>{lr.party}</td>
                  <td style={{ padding: '14px 10px' }}>{lr.vehicle}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>{lr.weightKg.toLocaleString()} kg</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>AED {lr.freightAmt.toLocaleString()}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)', color: '#10b981' }}>AED {lr.advanceAmt.toLocaleString()}</td>
                  <td style={{ padding: '14px 10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: lr.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: lr.status === 'Completed' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {lr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drivers Roster */}
      {activeTab === 'drivers' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>Driver Name</th>
                <th style={{ padding: '12px 10px' }}>Phone Number</th>
                <th style={{ padding: '12px 10px' }}>License Number</th>
                <th style={{ padding: '12px 10px' }}>Assigned RFID Tag</th>
                <th style={{ padding: '12px 10px' }}>Assigned Vehicle</th>
                <th style={{ padding: '12px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockDrivers.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 10px', fontWeight: 700, color: '#fff' }}>{d.name}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>{d.phone}</td>
                  <td style={{ padding: '14px 10px' }}>{d.licenseNo}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>{d.rfidTag}</td>
                  <td style={{ padding: '14px 10px', fontWeight: 600 }}>{d.assignedVehicle}</td>
                  <td style={{ padding: '14px 10px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {/* Issue Pass Modal */}
      {isIssueModalOpen && (
        <div className="modal-overlay" onClick={() => setIsIssueModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(480px, 95vw)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                <Truck size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                  Issue Fleet Gate Pass / LR
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleIssueSubmit} style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Select Vehicle Plate
                  </label>
                  <select
                    value={newPass.vehicle}
                    onChange={(e) => setNewPass((prev) => ({ ...prev, vehicle: e.target.value }))}
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
                    <option value="DXB-A-98124">DXB-A-98124 (Actros Heavy)</option>
                    <option value="DXB-B-43210">DXB-B-43210 (Volvo FH16)</option>
                    <option value="AUH-C-11029">AUH-C-11029 (Isuzu Reefer)</option>
                    <option value="SHJ-D-77123">SHJ-D-77123 (MAN TGX)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Driver Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newPass.driver}
                    onChange={(e) => setNewPass((prev) => ({ ...prev, driver: e.target.value }))}
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
                    Destination Facility / Zone
                  </label>
                  <input
                    type="text"
                    required
                    value={newPass.destination}
                    onChange={(e) => setNewPass((prev) => ({ ...prev, destination: e.target.value }))}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                <button type="button" onClick={() => setIsIssueModalOpen(false)} className="btn btn-ghost" style={{ padding: '6px 14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 18px', gap: '6px' }}>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Issue Pass</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
