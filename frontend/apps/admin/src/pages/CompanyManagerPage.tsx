import React from 'react';
import { Building2, Plus, Users, Cpu, ArrowUpRight } from 'lucide-react';

export const CompanyManagerPage: React.FC = () => {
  const sampleCompanies = [
    { id: 1, name: 'VAVE Logistics UAE', code: 'VAVE_UAE', devices: 142, users: 18, status: 'Active' },
    { id: 2, name: 'Maruti Transport Corp', code: 'MARUTI_TR', devices: 85, users: 9, status: 'Active' },
    { id: 3, name: 'Apex Cold Chain Ltd', code: 'APEX_COLD', devices: 34, users: 4, status: 'Active' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Tenant & Company Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Multi-tenant organization registry replacing legacy Admin.uae database switcher.
          </p>
        </div>
        <button
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <Plus size={18} />
          Create Tenant
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {sampleCompanies.map((c) => (
          <div key={c.id} className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.2)' }}>
                  <Building2 size={22} color="var(--accent)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {c.code}</span>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  fontWeight: 700,
                }}
              >
                {c.status}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Cpu size={16} />
                <span>{c.devices} Trackers</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Users size={16} />
                <span>{c.users} Users</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                <span>Manage</span>
                <ArrowUpRight size={15} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
