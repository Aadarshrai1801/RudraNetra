import React, { useState, useEffect } from 'react';
import { 
  CalendarClock, Plus, X, CheckCircle2, Building2
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface ExtensionRecord {
  id: number;
  companyId: number;
  companyName: string;
  deviceId?: number;
  deviceImei?: string;
  extensionType: string;
  oldExpiryDate: string;
  newExpiryDate: string;
  extendedBy: string;
  reason: string;
  amountPaid: number;
  createdAt: string;
}

export const ExtensionManagerPage: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyId: 1,
    extensionType: 'Company Subscription',
    months: 12,
    reason: 'Annual Contract Renewal',
    amountPaid: 14400,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadExtensions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/extensions');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setExtensions(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const json = await res.json();
        showToast(json.message || 'Subscription extended successfully');
        setIsModalOpen(false);
        loadExtensions();
      }
    } catch (err) {
      showToast('Failed to extend subscription');
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarClock size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Subscription & License Extensions
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Manage SaaS contract validity, device tracking license renewals, SIRA Gateway relay subscriptions, and renewal audit logs.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Extend Tenant Validity</span>
        </button>
      </div>

      {/* Extensions Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Organization</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Scope / Target</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Extension Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Previous Expiry</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>New Valid Until</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Authorized By</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fee Collected</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading validity extension ledger...
                </td>
              </tr>
            ) : extensions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No subscription extension logs found.
                </td>
              </tr>
            ) : (
              extensions.map((ext) => (
                <tr key={ext.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={15} color="var(--accent)" />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ext.companyName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {ext.deviceImei || 'All Fleet Units'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', fontSize: '0.78rem', fontWeight: 600 }}>
                      {ext.extensionType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {ext.oldExpiryDate}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong style={{ color: 'var(--good)' }}>{ext.newExpiryDate}</strong>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {ext.extendedBy}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    AED {ext.amountPaid.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Extend Subscription Validity</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Organization</label>
                <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <option value={1}>Emirates Trans Logistics L.L.C</option>
                  <option value={2}>Gulf Cold Chain Express</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Extension Term</label>
                  <select value={form.months} onChange={(e) => setForm({ ...form, months: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months (1 Year)</option>
                    <option value={24}>24 Months (2 Years)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Amount Paid (AED)</label>
                  <input type="number" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Extension Scope</label>
                <select value={form.extensionType} onChange={(e) => setForm({ ...form, extensionType: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <option value="Company Subscription">Company Subscription (All Fleet)</option>
                  <option value="Device License">Single Device License</option>
                  <option value="SIRA Gateway Relay">SIRA Secure Relay Compliance</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Contract Remarks / Reason</label>
                <input type="text" placeholder="e.g. Annual renewal cheque #99210" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Extension</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtensionManagerPage;
