import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Phone, Plus, X, CheckCircle2
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface WarrantyRecord {
  id: number;
  deviceImei: string;
  deviceModel: string;
  companyName: string;
  purchaseDate: string;
  warrantyEnd: string;
  amcStartDate: string;
  amcEndDate: string;
  amcStatus: 'Under Warranty' | 'Active AMC' | 'Expired AMC';
  vendorContact: string;
}

interface CompanyOption {
  id: number;
  name: string;
}

interface DeviceOption {
  id: number;
  imei: string;
  assignedTenant: string;
}

export const WarrantyMasterPage: React.FC = () => {
  const [records, setRecords] = useState<WarrantyRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    deviceId: 0,
    companyId: 0,
    warrantyPeriod: '',
    vendorName: '',
    startDate: '',
    endDate: '',
    amcActive: false,
    amcExpiry: '',
    remarks: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/warranty');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRecords(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [companiesRes, devicesRes] = await Promise.all([
        fetchWithAdminAuth('/api/v1/admin/companies'),
        fetchWithAdminAuth('/api/v1/admin/devices'),
      ]);
      if (companiesRes.ok) {
        const json = await companiesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setCompanies(json.data);
        }
      }
      if (devicesRes.ok) {
        const json = await devicesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setDevices(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    loadOptions();
  }, []);

  const handleDeviceChange = (deviceId: number) => {
    const selected = devices.find((d) => d.id === deviceId);
    const matchedCompany = selected
      ? companies.find((company) => company.name === selected.assignedTenant)
      : undefined;
    setForm((prev) => ({
      ...prev,
      deviceId,
      companyId: matchedCompany ? matchedCompany.id : prev.companyId,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceId) {
      showToast('Please select a device.');
      return;
    }
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/warranty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: form.deviceId,
          companyId: form.companyId,
          warrantyPeriod: form.warrantyPeriod,
          vendorName: form.vendorName,
          startDate: form.startDate,
          endDate: form.endDate,
          amcActive: form.amcActive,
          amcExpiry: form.amcExpiry,
          remarks: form.remarks,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.message || 'Hardware warranty & AMC contract registered');
        setIsModalOpen(false);
        setForm({
          deviceId: 0,
          companyId: 0,
          warrantyPeriod: '',
          vendorName: '',
          startDate: '',
          endDate: '',
          amcActive: false,
          amcExpiry: '',
          remarks: '',
        });
        loadData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Failed to register warranty record');
      }
    } catch (err) {
      showToast('Failed to register warranty record');
    }
  };

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Hardware Warranty & Annual Maintenance (AMC)
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Tracker factory replacement warranties, manufacturer warranty windows, and Annual Maintenance Contracts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Register Warranty / AMC</span>
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Device IMEI</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Model</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Client Organization</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Purchase Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Factory Warranty End</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMC Expiry</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Contract Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vendor / Desk Contact</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading warranty & AMC records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No warranty records found.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)' }}>
                    {r.deviceImei || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.deviceModel || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{r.companyName || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{r.purchaseDate || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.warrantyEnd || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.amcEndDate || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: r.amcStatus === 'Under Warranty' ? 'var(--good-bg)' : r.amcStatus === 'Active AMC' ? 'var(--accent-light)' : '#FEE2E2',
                        color: r.amcStatus === 'Under Warranty' ? 'var(--good)' : r.amcStatus === 'Active AMC' ? 'var(--accent)' : '#DC2626',
                      }}
                    >
                      {r.amcStatus}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={13} color="var(--text-tertiary)" />
                      <span>{r.vendorContact || '—'}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Register Warranty / AMC Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Register Warranty / AMC Contract</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Device</label>
                <select value={form.deviceId} onChange={(e) => handleDeviceChange(Number(e.target.value))} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required>
                  <option value={0}>{devices.length === 0 ? 'No devices available' : 'Select device by IMEI'}</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>{device.imei}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Client Organization</label>
                <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <option value={0}>Resolve from device tenant</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Warranty Period</label>
                  <input type="text" placeholder="e.g. 1 Year" value={form.warrantyPeriod} onChange={(e) => setForm({ ...form, warrantyPeriod: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Vendor Name</label>
                  <input type="text" placeholder="Enter vendor name" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>AMC Expiry</label>
                  <input type="date" value={form.amcExpiry} onChange={(e) => setForm({ ...form, amcExpiry: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer', paddingBottom: '9px' }}>
                  <input type="checkbox" checked={form.amcActive} onChange={(e) => setForm({ ...form, amcActive: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                  <span>AMC active</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Remarks</label>
                <input type="text" placeholder="Enter contract remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Warranty Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarrantyMasterPage;
