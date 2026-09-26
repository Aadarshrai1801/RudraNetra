import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Plus, X, CheckCircle2, 
  Building2
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface BillingRecord {
  id: number;
  invoiceNo: string;
  companyName: string;
  billingPlan: string;
  deviceCount: number;
  subTotal: number;
  taxVat: number;
  totalAmount: number;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  dueDate: string;
  paidAt?: string;
}

interface CompanyOption {
  id: number;
  name: string;
}

export const BillingMasterPage: React.FC = () => {
  const [invoices, setInvoices] = useState<BillingRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newInvoice, setNewInvoice] = useState({
    companyId: 0,
    billingPlan: '',
    deviceCount: '' as string,
    ratePerDevice: '' as string,
    dueDate: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadBilling = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/billing');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setInvoices(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/companies');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCompanies(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBilling();
    loadCompanies();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.companyId) {
      showToast('Please select a client organization.');
      return;
    }
    const deviceCount = Number(newInvoice.deviceCount);
    const ratePerDevice = Number(newInvoice.ratePerDevice);
    if (!Number.isFinite(deviceCount) || deviceCount <= 0 || !Number.isFinite(ratePerDevice) || ratePerDevice <= 0) {
      showToast('Device count and rate per device must be greater than zero.');
      return;
    }
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: newInvoice.companyId,
          billingPlan: newInvoice.billingPlan,
          deviceCount,
          ratePerDevice,
          dueDate: newInvoice.dueDate,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.invoiceNo ? `Tax invoice ${json.invoiceNo} generated.` : 'Tax invoice generated.');
        setIsModalOpen(false);
        setNewInvoice({ companyId: 0, billingPlan: '', deviceCount: '', ratePerDevice: '', dueDate: '' });
        loadBilling();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Failed to generate tax invoice');
      }
    } catch (err) {
      showToast('Failed to generate tax invoice');
    }
  };

  const totalBilled = invoices.reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'Paid').reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0);
  const totalUnpaid = invoices.filter((i) => i.status !== 'Paid').reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0);

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
            <CreditCard size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Billing & Tax Invoicing Master
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Multi-tenant SaaS invoicing, per-device subscription rates, VAT calculated from each tenant's billing settings, and payment status tracking.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Generate Tax Invoice</span>
        </button>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Invoiced (AED)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            AED {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Gross billings to date</div>
        </div>

        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Collected Revenue</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--good)', marginTop: '4px' }}>
            AED {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Cleared via Wire / Cheque</div>
        </div>

        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Outstanding Receivables</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            AED {totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Awaiting payment receipt</div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Invoice #</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Organization</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subscription Plan</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Trackers</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subtotal (AED)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>VAT</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total (AED)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading invoices...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No billing invoices issued yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)' }}>
                    {inv.invoiceNo}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={15} color="var(--text-secondary)" />
                      <span style={{ fontWeight: 600 }}>{inv.companyName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {inv.billingPlan || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {inv.deviceCount ?? '—'} units
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    AED {(Number(inv.subTotal) || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>
                    AED {(Number(inv.taxVat) || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    AED {(Number(inv.totalAmount) || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: inv.status === 'Paid' ? 'var(--good-bg)' : '#FEE2E2',
                        color: inv.status === 'Paid' ? 'var(--good)' : '#DC2626',
                      }}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {inv.dueDate || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Generate Invoice Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Issue Tax Invoice</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Client Organization</label>
                <select value={newInvoice.companyId} onChange={(e) => setNewInvoice({ ...newInvoice, companyId: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required>
                  <option value={0}>{companies.length === 0 ? 'No organizations available' : 'Select organization'}</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Plan Description</label>
                <input type="text" placeholder="Enter subscription plan" value={newInvoice.billingPlan} onChange={(e) => setNewInvoice({ ...newInvoice, billingPlan: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Device Count</label>
                  <input type="number" min={1} value={newInvoice.deviceCount} onChange={(e) => setNewInvoice({ ...newInvoice, deviceCount: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Rate / Device (AED)</label>
                  <input type="number" min={0} step="0.01" value={newInvoice.ratePerDevice} onChange={(e) => setNewInvoice({ ...newInvoice, ratePerDevice: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Payment Due Date</label>
                <input type="date" value={newInvoice.dueDate} onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingMasterPage;
