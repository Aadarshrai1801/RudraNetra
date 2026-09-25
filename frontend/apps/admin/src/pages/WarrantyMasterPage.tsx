import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Phone
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

export const WarrantyMasterPage: React.FC = () => {
  const [records, setRecords] = useState<WarrantyRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={24} color="var(--accent)" />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Hardware Warranty & Annual Maintenance (AMC)
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
          Tracker factory replacement warranties, EU manufacturer warranty windows, and Annual Maintenance Contracts.
        </p>
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
                    {r.deviceImei}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.deviceModel}</td>
                  <td style={{ padding: '12px 16px' }}>{r.companyName}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{r.purchaseDate}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.warrantyEnd}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.amcEndDate}</td>
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
                      <span>{r.vendorContact}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WarrantyMasterPage;
