import React, { useState } from 'react';
import { Cpu, Plus, ShieldCheck, Wifi, Link2 } from 'lucide-react';

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
    imei: '352093088642068',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981240',
    port: 5040,
    assignedVehicle: 'DXB-A-98124',
    status: 'active',
    warrantyEnd: '2027-12-31',
  },
  {
    id: 102,
    imei: '352093088642069',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981241',
    port: 5040,
    assignedVehicle: 'DXB-B-43210',
    status: 'active',
    warrantyEnd: '2027-12-31',
  },
  {
    id: 103,
    imei: '352093088642070',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981242',
    port: 5040,
    assignedVehicle: 'AUH-C-11029',
    status: 'active',
    warrantyEnd: '2027-12-31',
  },
  {
    id: 104,
    imei: '352093088642071',
    protocol: 'TELTONIKA_FMB920',
    simNo: '+971501981243',
    port: 5040,
    assignedVehicle: 'SHJ-D-77123',
    status: 'active',
    warrantyEnd: '2027-12-31',
  },
];

export const DevicesPage: React.FC = () => {
  const [devices] = useState<DeviceItem[]>(initialDevices);
  const [searchTerm, setSearchTerm] = useState('');

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
            Hardware provision registry replacing legacy Devices.ashx & ControlPanel.ashx.
          </p>
        </div>
        <button className="btn btn-primary" style={{ gap: '8px' }}>
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
    </div>
  );
};
