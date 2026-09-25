import React, { useState, useEffect } from 'react';
import { 
  Radio, Plus, X, CheckCircle2, Search, Filter, 
  Building2, Car
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface DeviceItem {
  id: number;
  imei: string;
  simCardNo: string;
  operator: string;
  model: string;
  protocol: string;
  firmware: string;
  assignedTenant: string;
  vehicleReg: string;
  lastPing: string;
  status: 'Online' | 'Offline' | 'Unassigned';
}

export const DeviceMasterPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newDevice, setNewDevice] = useState({
    imei: '',
    simCardNo: '',
    operator: 'e& (Etisalat UAE)',
    model: 'Teltonika FMB920',
    protocol: 'TCP/5040',
    firmware: '03.28.07.Rev.00',
    companyName: 'Emirates Trans Logistics L.L.C',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/devices');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDevices(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load device inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.imei || !newDevice.simCardNo) {
      showToast('IMEI and SIM Card Number are required');
      return;
    }

    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice),
      });

      if (res.ok) {
        showToast('Tracker provisioned into hardware inventory');
        setIsModalOpen(false);
        setNewDevice({
          imei: '',
          simCardNo: '',
          operator: 'e& (Etisalat UAE)',
          model: 'Teltonika FMB920',
          protocol: 'TCP/5040',
          firmware: '03.28.07.Rev.00',
          companyName: 'Emirates Trans Logistics L.L.C',
        });
        loadDevices();
      }
    } catch (err) {
      showToast('Failed to provision device');
    }
  };

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.imei.includes(search) ||
      d.simCardNo.includes(search) ||
      d.vehicleReg.toLowerCase().includes(search.toLowerCase()) ||
      d.assignedTenant.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || d.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const onlineCount = devices.filter((d) => d.status === 'Online').length;
  const unassignedCount = devices.filter((d) => d.status === 'Unassigned').length;

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Device & SIM Inventory Master
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Central inventory for GPS hardware trackers, SIM ICCID allocations, firmware revisions, and tenant vehicle assignments.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Provision New Tracker</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Trackers</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{devices.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Teltonika & Concox Units</div>
        </div>

        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Online & Streaming</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--good)', marginTop: '4px' }}>{onlineCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Active socket pings</div>
        </div>

        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Depot / Stock</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--attention)', marginTop: '4px' }}>{unassignedCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Unassigned trackers</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '280px' }}>
            <Search size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by IMEI, SIM, plate, or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Showing {filteredDevices.length} trackers
        </div>
      </div>

      {/* Devices Inventory Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Device IMEI</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>SIM Card & Telco</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Model & Port</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Tenant</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle Plate</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Ping</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading hardware inventory...
                </td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No hardware devices found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredDevices.map((dev) => (
                <tr key={dev.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)' }}>{dev.imei}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>FW: {dev.firmware}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{dev.simCardNo}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{dev.operator}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{dev.model}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>{dev.protocol}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={14} color="var(--text-tertiary)" />
                      <span>{dev.assignedTenant}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Car size={14} color="var(--accent)" />
                      <span style={{ fontWeight: 600 }}>{dev.vehicleReg}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {dev.lastPing}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: dev.status === 'Online' ? 'var(--good-bg)' : dev.status === 'Offline' ? '#FEE2E2' : 'var(--bg-subtle)',
                        color: dev.status === 'Online' ? 'var(--good)' : dev.status === 'Offline' ? '#DC2626' : 'var(--text-secondary)',
                      }}
                    >
                      {dev.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Provision Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Provision GPS Tracker</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Hardware IMEI # (15 digits)</label>
                <input type="text" placeholder="e.g. 867829048192025" value={newDevice.imei} onChange={(e) => setNewDevice({ ...newDevice, imei: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontFamily: 'monospace' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>SIM Card Phone Number</label>
                  <input type="text" placeholder="+971 50 1234567" value={newDevice.simCardNo} onChange={(e) => setNewDevice({ ...newDevice, simCardNo: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Telco Operator</label>
                  <select value={newDevice.operator} onChange={(e) => setNewDevice({ ...newDevice, operator: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="e& (Etisalat UAE)">e& (Etisalat UAE)</option>
                    <option value="du Telecom">du Telecom</option>
                    <option value="Airtel M2M">Airtel M2M</option>
                    <option value="Vodafone IoT">Vodafone IoT</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Device Model</label>
                  <select value={newDevice.model} onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="Teltonika FMB920">Teltonika FMB920 (2G)</option>
                    <option value="Teltonika FMB125">Teltonika FMB125 (Dual SIM)</option>
                    <option value="Teltonika FMC130">Teltonika FMC130 (4G LTE)</option>
                    <option value="Concox GT06N">Concox GT06N</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Socket Protocol Port</label>
                  <input type="text" value={newDevice.protocol} onChange={(e) => setNewDevice({ ...newDevice, protocol: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Initial Tenant Company Assignment</label>
                <input type="text" placeholder="Emirates Trans Logistics L.L.C" value={newDevice.companyName} onChange={(e) => setNewDevice({ ...newDevice, companyName: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Provision Tracker</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceMasterPage;
