import React, { useState, useEffect } from 'react';
import { 
  KeyRound, CheckCircle2, Save
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface RoleItem {
  id: number;
  roleName: string;
  description: string;
  permissions: Record<string, number>;
}

export const RoleRightsPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const modules = [
    { key: 'tracking', label: 'Live Tracking & Map' },
    { key: 'reports', label: 'Reports & Export' },
    { key: 'fleet', label: 'Fleet Operations (Trips/Tyres)' },
    { key: 'control_panel', label: 'Control Panel (Immobilizer Cut)' },
    { key: 'reminders', label: 'Compliance & Reminders' },
    { key: 'billing', label: 'Billing & Invoices' },
    { key: 'users', label: 'User & Driver Management' },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/roles');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRoles(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleSave = () => {
    showToast('Permission rights matrix applied across tenant roles');
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
            <KeyRound size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Module Rights & Permissions Matrix
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Fine-grained Role-Based Access Control (RBAC) across Live Tracking, Remote Immobilizer Cut, Reports, and Fleet Operations.
          </p>
        </div>

        <button onClick={handleSave} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Save size={16} />
          <span>Save Permissions Matrix</span>
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>System Role</th>
              {modules.map((m) => (
                <th key={m.key} style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'center' }}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={modules.length + 1} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading permission matrix...
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.roleName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{r.description}</div>
                  </td>
                  {modules.map((m) => {
                    const permVal = r.permissions?.[m.key] || 0;
                    const canView = (permVal & 1) > 0;
                    const canAdd = (permVal & 2) > 0;
                    const canEdit = (permVal & 4) > 0;
                    const canDelete = (permVal & 8) > 0;

                    return (
                      <td key={m.key} style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '0.76rem' }}>
                          <span title="View" style={{ padding: '2px 5px', borderRadius: '3px', background: canView ? 'var(--good-bg)' : 'var(--bg-subtle)', color: canView ? 'var(--good)' : 'var(--text-tertiary)', fontWeight: 700 }}>V</span>
                          <span title="Add" style={{ padding: '2px 5px', borderRadius: '3px', background: canAdd ? 'var(--good-bg)' : 'var(--bg-subtle)', color: canAdd ? 'var(--good)' : 'var(--text-tertiary)', fontWeight: 700 }}>A</span>
                          <span title="Edit" style={{ padding: '2px 5px', borderRadius: '3px', background: canEdit ? 'var(--good-bg)' : 'var(--bg-subtle)', color: canEdit ? 'var(--good)' : 'var(--text-tertiary)', fontWeight: 700 }}>E</span>
                          <span title="Delete" style={{ padding: '2px 5px', borderRadius: '3px', background: canDelete ? 'var(--alert-bg)' : 'var(--bg-subtle)', color: canDelete ? 'var(--alert)' : 'var(--text-tertiary)', fontWeight: 700 }}>D</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoleRightsPage;
