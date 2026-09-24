import React, { useState, useEffect } from 'react';
import { Cpu, Plus, ShieldCheck, Wifi, Link2, X, Check } from 'lucide-react';

interface DeviceItem {
  id: number;
  imei: string;
  protocol: string;
  simNo: string;
  port: number;
  assignedVehicle: string;
  status: 'active' | 'offline';
  warrantyEnd: string;
}

const initialDevices: DeviceItem[] = [
  {
    id: 101,
    imei: '866907059076488',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981240',
    port: 5040,
    assignedVehicle: '95321',
    status: 'active',
    warrantyEnd: '2028-12-31',
  },
  {
    id: 102,
    imei: '866907059452911',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981241',
    port: 5040,
    assignedVehicle: '82561',
    status: 'active',
    warrantyEnd: '2028-12-31',
  },
  {
    id: 106,
    imei: '866907058849653',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981242',
    port: 5040,
    assignedVehicle: '84707',
    status: 'active',
    warrantyEnd: '2028-12-31',
  },
  {
    id: 104,
    imei: '866907059155027',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981243',
    port: 5040,
    assignedVehicle: '99292',
    status: 'active',
    warrantyEnd: '2028-12-31',
  },
  {
    id: 184,
    imei: '866907058443366',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981244',
    port: 5040,
    assignedVehicle: '33566',
    status: 'active',
    warrantyEnd: '2028-12-31',
  },
];

export const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>(() => {
    const saved = localStorage.getItem('rudra_devices');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.warn('Failed to parse saved devices from localStorage', err);
      }
    }
    return initialDevices;
  });

  useEffect(() => {
    localStorage.setItem('rudra_devices', JSON.stringify(devices));
  }, [devices]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newTracker, setNewTracker] = useState({
    imei: '',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+97150',
    port: 5040,
    assignedVehicle: 'DXB-E-55102',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTracker.imei) return;

    const created: DeviceItem = {
      id: 100 + devices.length + 1,
      imei: newTracker.imei,
      protocol: newTracker.protocol,
      simNo: newTracker.simNo,
      port: Number(newTracker.port) || 5040,
      assignedVehicle: newTracker.assignedVehicle,
      status: 'active',
      warrantyEnd: '2028-12-31',
    };

    setDevices((prev) => [...prev, created]);
    setIsRegisterModalOpen(false);
    setNewTracker({
      imei: '',
      protocol: 'TELTONIKA_FMB920',
      simNo: '+97150',
      port: 5040,
      assignedVehicle: '',
    });
    showToast(`Tracker IMEI ${created.imei} provisioned on TCP :5040.`);
  };

  const filtered = devices.filter(
    (d) =>
      d.imei.includes(searchTerm) ||
      d.assignedVehicle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>GPS Hardware & Devices</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Hardware telemetry registry, sensor calibration, and protocol provisioning.
          </p>
        </div>
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="btn btn-primary"
          style={{ gap: '8px' }}
        >
          <Plus size={16} />
          Register Tracker
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Hardware Units</span>
            <Cpu size={18} color="var(--cyan-accent)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px' }}>{devices.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>All assigned to active fleet</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Ingestion Port</span>
            <Wifi size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px' }}>TCP :5040</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>rudra-ingest listener active</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Protocol Support</span>
            <ShieldCheck size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '8px' }}>Teltonika Codec 8</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>FMB920, FMB120, FMC130</div>
        </div>
      </div>

      {/* Device Table */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Provisioned Devices</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search IMEI or Plate..."
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#fff',
              fontSize: '0.8rem',
            }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>Device ID</th>
                <th style={{ padding: '12px 10px' }}>IMEI Number</th>
                <th style={{ padding: '12px 10px' }}>Protocol</th>
                <th style={{ padding: '12px 10px' }}>SIM Card</th>
                <th style={{ padding: '12px 10px' }}>TCP Port</th>
                <th style={{ padding: '12px 10px' }}>Linked Vehicle</th>
                <th style={{ padding: '12px 10px' }}>Status</th>
                <th style={{ padding: '12px 10px' }}>Warranty</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 10px', fontWeight: 600 }}>{d.id}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)', fontWeight: 600 }}>
                    {d.imei}
                  </td>
                  <td style={{ padding: '14px 10px' }}>{d.protocol}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>{d.simNo}</td>
                  <td style={{ padding: '14px 10px', fontFamily: 'var(--font-mono)' }}>:{d.port}</td>
                  <td style={{ padding: '14px 10px', fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Link2 size={14} color="#10b981" />
                      {d.assignedVehicle}
                    </div>
                  </td>
                  <td style={{ padding: '14px 10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
                      }}
                    >
                      {d.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 10px', color: 'var(--text-muted)' }}>{d.warrantyEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* Register Tracker Modal */}
      {isRegisterModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRegisterModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(500px, 95vw)',
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
                <Cpu size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                  Register Telematics Tracker
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    15-Digit IMEI Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 869234051284999"
                    value={newTracker.imei}
                    onChange={(e) => setNewTracker((prev) => ({ ...prev, imei: e.target.value }))}
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
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Protocol / Hardware Model
                    </label>
                    <select
                      value={newTracker.protocol}
                      onChange={(e) => setNewTracker((prev) => ({ ...prev, protocol: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    >
                      <option value="TELTONIKA_FMB920">Teltonika FMB920 (Codec 8)</option>
                      <option value="TELTONIKA_FMB120">Teltonika FMB120</option>
                      <option value="TELTONIKA_FMC130">Teltonika FMC130 (4G Cat1)</option>
                      <option value="GPS103_TCP">GPS103 Protocol</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      TCP Listener Port
                    </label>
                    <input
                      type="number"
                      value={newTracker.port}
                      onChange={(e) => setNewTracker((prev) => ({ ...prev, port: Number(e.target.value) }))}
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
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      M2M SIM Card Number
                    </label>
                    <input
                      type="text"
                      value={newTracker.simNo}
                      onChange={(e) => setNewTracker((prev) => ({ ...prev, simNo: e.target.value }))}
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
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Assigned Vehicle Plate
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DXB-E-55102"
                      value={newTracker.assignedVehicle}
                      onChange={(e) => setNewTracker((prev) => ({ ...prev, assignedVehicle: e.target.value }))}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="btn btn-ghost" style={{ padding: '6px 14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 18px', gap: '6px' }}>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Provision Unit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
