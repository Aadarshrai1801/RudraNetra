import React, { useState, useEffect } from 'react';
import { 
  Database, Plus, X, CheckCircle2
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface MasterItem {
  id: number;
  type: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export const MastersPage: React.FC = () => {
  const [activeType, setActiveType] = useState('tyre-brands');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [form, setForm] = useState({ code: '', name: '' });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadMasters = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth(`/api/v1/admin/masters/${activeType}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setItems(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, [activeType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAdminAuth(`/api/v1/admin/masters/${activeType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        showToast('Master lookup entry created');
        setIsModalOpen(false);
        setForm({ code: '', name: '' });
        loadMasters();
      }
    } catch (err) {
      showToast('Failed to add master record');
    }
  };

  const masterTabs = [
    { key: 'tyre-brands', label: 'Tyre Brands' },
    { key: 'axle-positions', label: 'Axle Positions' },
    { key: 'voucher-categories', label: 'Expense Categories' },
    { key: 'complaint-categories', label: 'Support Categories' },
    { key: 'device-models', label: 'Tracker Device Models' },
  ];

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
            <Database size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              System Lookup Masters
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Configure global dropdown lookup dictionaries used throughout the fleet management ecosystem.
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} />
          <span>Add Lookup Value</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {masterTabs.map((t) => {
          const isActive = activeType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveType(t.key)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Lookup Code</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Display Value / Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Default Setting</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading lookup dictionary...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No lookup values defined for this category.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>#{it.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>{it.code}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>{it.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {it.isDefault ? (
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '0.76rem', fontWeight: 700 }}>
                        Default Choice
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Standard</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add Lookup Value</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Code / Identifier</label>
                <input type="text" placeholder="e.g. BS" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Display Label</label>
                <input type="text" placeholder="e.g. Bridgestone" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Lookup</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MastersPage;
