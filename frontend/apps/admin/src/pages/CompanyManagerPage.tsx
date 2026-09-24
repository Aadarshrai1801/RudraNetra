import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Users,
  Sliders,
  Shield,
  Key,
  X,
  Check,
  Search,
  Copy,
} from 'lucide-react';

export interface TenantCompany {
  id: number;
  name: string;
  code: string;
  devices: number;
  maxDevices: number;
  users: number;
  maxUsers: number;
  status: 'Active' | 'Suspended';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  dbShard: string;
  siraRelay: boolean;
  apiKey: string;
  createdAt: string;
}

const initialCompanies: TenantCompany[] = [
  {
    id: 1,
    name: 'VAVE Logistics UAE',
    code: 'VAVE_UAE',
    devices: 142,
    maxDevices: 200,
    users: 18,
    maxUsers: 25,
    status: 'Active',
    contactPerson: 'Sanjay Kumar',
    contactEmail: 'sanjay@vaveuae.ae',
    contactPhone: '+971-50-1234567',
    dbShard: 'pg_shard_uae_01',
    siraRelay: true,
    apiKey: 'RN-DEV-KEY-VAVE-01',
    createdAt: '2026-01-15',
  },
  {
    id: 2,
    name: 'Maruti Transport Corp',
    code: 'MARUTI_TR',
    devices: 85,
    maxDevices: 120,
    users: 9,
    maxUsers: 15,
    status: 'Active',
    contactPerson: 'Vikram Patel',
    contactEmail: 'ops@marutitransport.ae',
    contactPhone: '+971-52-9876543',
    dbShard: 'pg_shard_uae_01',
    siraRelay: true,
    apiKey: 'RN-DEV-KEY-MARUTI-02',
    createdAt: '2026-03-02',
  },
  {
    id: 3,
    name: 'Apex Cold Chain Ltd',
    code: 'APEX_COLD',
    devices: 34,
    maxDevices: 50,
    users: 4,
    maxUsers: 10,
    status: 'Active',
    contactPerson: 'Tariq Al-Mansoor',
    contactEmail: 'tariq@apexcold.ae',
    contactPhone: '+971-55-4567890',
    dbShard: 'pg_shard_uae_02',
    siraRelay: false,
    apiKey: 'RN-DEV-KEY-APEX-03',
    createdAt: '2026-05-18',
  },
];

export const CompanyManagerPage: React.FC = () => {
  const [companies, setCompanies] = useState<TenantCompany[]>(initialCompanies);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Suspended'>('ALL');

  // Modals state
  const [selectedCompany, setSelectedCompany] = useState<TenantCompany | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<TenantCompany>>({});

  // New company form state
  const [newCompany, setNewCompany] = useState<Partial<TenantCompany>>({
    name: '',
    code: '',
    maxDevices: 100,
    maxUsers: 10,
    status: 'Active',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    dbShard: 'pg_shard_uae_01',
    siraRelay: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenManage = (company: TenantCompany) => {
    setSelectedCompany(company);
    setEditForm({ ...company });
    setIsEditModalOpen(true);
  };

  const handleSaveManage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    setCompanies((prev) =>
      prev.map((c) => (c.id === selectedCompany.id ? ({ ...c, ...editForm } as TenantCompany) : c))
    );
    setIsEditModalOpen(false);
    showToast(`Tenant "${editForm.name || selectedCompany.name}" updated successfully.`);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name || !newCompany.code) {
      alert('Please enter both Company Name and Tenant Code.');
      return;
    }

    const created: TenantCompany = {
      id: Date.now(),
      name: newCompany.name,
      code: newCompany.code.toUpperCase().replace(/\s+/g, '_'),
      devices: 0,
      maxDevices: Number(newCompany.maxDevices) || 50,
      users: 1,
      maxUsers: Number(newCompany.maxUsers) || 10,
      status: (newCompany.status as 'Active' | 'Suspended') || 'Active',
      contactPerson: newCompany.contactPerson || 'System Administrator',
      contactEmail: newCompany.contactEmail || `admin@${newCompany.code.toLowerCase()}.ae`,
      contactPhone: newCompany.contactPhone || '+971-4-0000000',
      dbShard: newCompany.dbShard || 'pg_shard_uae_01',
      siraRelay: Boolean(newCompany.siraRelay),
      apiKey: `RN-DEV-KEY-${newCompany.code.toUpperCase()}-001`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setCompanies((prev) => [...prev, created]);
    setIsCreateModalOpen(false);
    setNewCompany({
      name: '',
      code: '',
      maxDevices: 100,
      maxUsers: 10,
      status: 'Active',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      dbShard: 'pg_shard_uae_01',
      siraRelay: true,
    });
    showToast(`Tenant "${created.name}" created and provisioned.`);
  };

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = () => {
    if (!selectedCompany) return;
    const freshKey = `RN-DEV-KEY-${selectedCompany.code.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setEditForm((prev) => ({ ...prev, apiKey: freshKey }));
    showToast('Generated new development API key. Save to persist.');
  };

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregated metrics
  const totalTrackers = companies.reduce((acc, c) => acc + c.devices, 0);
  const totalMaxTrackers = companies.reduce((acc, c) => acc + c.maxDevices, 0);
  const totalUsers = companies.reduce((acc, c) => acc + c.users, 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '56px',
            right: '32px',
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

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                backgroundColor: 'var(--signal-amber)',
                display: 'inline-block',
              }}
            />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Tenant & Organization Registry
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
            Multi-tenant routing, device allocations, SIRA compliance relays, and database sharding.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          style={{ padding: '8px 16px', gap: '8px' }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>+ Create Tenant</span>
        </button>
      </div>

      {/* Industrial Operational Metrics Strip */}
      <div
        className="ops-panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          marginBottom: '24px',
          border: '1px solid var(--line)',
        }}
      >
        {/* Metric 1: Total Tenants */}
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--line)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Registered Tenants
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {companies.length}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--signal-green)' }}>
              100% Online
            </span>
          </div>
        </div>

        {/* Metric 2: Allocated Trackers */}
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--line)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Allocated Trackers / Cap
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--signal-amber)' }}>
              {totalTrackers}
            </span>
            <span className="mono-num" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              / {totalMaxTrackers} ({Math.round((totalTrackers / (totalMaxTrackers || 1)) * 100)}%)
            </span>
          </div>
        </div>

        {/* Metric 3: Active Operators */}
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--line)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Operator User Seats
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {totalUsers}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Assigned across tenants
            </span>
          </div>
        </div>

        {/* Metric 4: Telemetry Load */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cluster Telemetry Ingest
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--signal-green)' }}>
              1,420
            </span>
            <span className="mono-num" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              msgs/sec &middot; TCP:5040
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Field */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            padding: '6px 12px',
            flex: '1',
            maxWidth: '380px',
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search tenant name, code, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              outline: 'none',
              width: '100%',
              fontFamily: 'var(--font-ui)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0', border: '1px solid var(--line)' }}>
          {(['ALL', 'Active', 'Suspended'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                background: statusFilter === filter ? 'var(--bg-raised)' : 'var(--bg-surface)',
                color: statusFilter === filter ? 'var(--signal-amber)' : 'var(--text-muted)',
                border: 'none',
                borderRight: '1px solid var(--line)',
                padding: '6px 14px',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {filter.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        {filteredCompanies.map((c) => {
          const usagePercent = Math.min(100, Math.round((c.devices / (c.maxDevices || 1)) * 100));

          return (
            <div
              key={c.id}
              className="ops-panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Top Row: Organization Identity & Status */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div
                      style={{
                        padding: '8px',
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Building2 size={20} color="var(--signal-amber)" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '0.98rem', fontWeight: 700, letterSpacing: '0.01em', margin: 0 }}>
                          {c.name}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        <span
                          className="mono-num"
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-raised)',
                            padding: '1px 5px',
                            border: '1px solid var(--line)',
                          }}
                        >
                          {c.code}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          Shard: <span className="mono-num" style={{ color: 'var(--text-primary)' }}>{c.dbShard}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      background: 'var(--bg-raised)',
                      border: `1px solid ${c.status === 'Active' ? 'var(--line)' : 'var(--signal-red)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        backgroundColor: c.status === 'Active' ? 'var(--signal-green)' : 'var(--signal-red)',
                        display: 'inline-block',
                      }}
                    />
                    <span
                      className="mono-num"
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: c.status === 'Active' ? 'var(--signal-green)' : 'var(--signal-red)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Device Allocation Gauge */}
                <div style={{ margin: '14px 0', background: 'var(--bg-raised)', padding: '10px 12px', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Trackers Allocated</span>
                    <span className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {c.devices} / {c.maxDevices} <span style={{ color: 'var(--text-muted)' }}>({usagePercent}%)</span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${usagePercent}%`,
                        height: '100%',
                        background: usagePercent > 90 ? 'var(--signal-red)' : 'var(--signal-amber)',
                      }}
                    />
                  </div>
                </div>

                {/* Tenant Meta Info Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} color="var(--text-muted)" />
                    <span>Users: <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>{c.users} / {c.maxUsers}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={13} color={c.siraRelay ? 'var(--signal-green)' : 'var(--text-muted)'} />
                    <span>SIRA: <strong style={{ color: c.siraRelay ? 'var(--signal-green)' : 'var(--text-muted)' }}>{c.siraRelay ? 'Enabled' : 'Disabled'}</strong></span>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Contact:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{c.contactPerson}</span>
                    <span style={{ color: 'var(--text-muted)' }}>({c.contactEmail})</span>
                  </div>
                </div>
              </div>

              {/* Action Bar with FIXED WORKING MANAGE BUTTON */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <span className="mono-num" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  EST: {c.createdAt}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenManage(c)}
                  className="btn btn-primary"
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.72rem',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
                  id={`manage-tenant-${c.id}`}
                >
                  <Sliders size={13} strokeWidth={2.2} />
                  <span>Manage Tenant</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          TENANT MANAGEMENT MODAL (DRAWER CONSOLE)
          Triggered by clicking "Manage Tenant"
          ========================================================================= */}
      {isEditModalOpen && selectedCompany && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(640px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sliders size={16} color="var(--signal-amber)" />
                <div>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    Tenant Provisioning: {selectedCompany.name}
                  </h2>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ID: {selectedCompany.id} &middot; CODE: {selectedCompany.code}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveManage} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* General Tenant Identity */}
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--signal-amber)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                    1. Organization Identity & Status
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Company / Organization Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Tenant Status
                      </label>
                      <select
                        value={editForm.status || 'Active'}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as 'Active' | 'Suspended' }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          outline: 'none',
                        }}
                      >
                        <option value="Active">Active (Live Telemetry Routing)</option>
                        <option value="Suspended">Suspended (Ingest Throttled)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Hardware & User Limits */}
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--signal-amber)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                    2. Hardware Quotas & User Allocations
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Max Device / Tracker Limit
                      </label>
                      <input
                        type="number"
                        min={selectedCompany.devices}
                        value={editForm.maxDevices || 100}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, maxDevices: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Currently active: {selectedCompany.devices} devices
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Max User Dispatcher Seats
                      </label>
                      <input
                        type="number"
                        min={selectedCompany.users}
                        value={editForm.maxUsers || 10}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, maxUsers: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Currently active: {selectedCompany.users} users
                      </span>
                    </div>
                  </div>
                </div>

                {/* Database Routing & Shard */}
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--signal-amber)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                    3. Database Partition & Compliance Relays
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        TimescaleDB Routing Shard
                      </label>
                      <select
                        value={editForm.dbShard || 'pg_shard_uae_01'}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, dbShard: e.target.value }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          outline: 'none',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <option value="pg_shard_uae_01">pg_shard_uae_01 (Dubai DC)</option>
                        <option value="pg_shard_uae_02">pg_shard_uae_02 (Abu Dhabi DC)</option>
                        <option value="pg_shard_isolated">pg_shard_isolated (Dedicated Hypertable)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        SIRA UAE Compliance Forwarder
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '34px' }}>
                        <input
                          type="checkbox"
                          id="siraRelayCheck"
                          checked={Boolean(editForm.siraRelay)}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, siraRelay: e.target.checked }))}
                          style={{ cursor: 'pointer', accentColor: 'var(--signal-amber)' }}
                        />
                        <label htmlFor="siraRelayCheck" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                          Enable SIRA-V4 Telematics Relay
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Contact Person */}
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--signal-amber)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                    4. Dispatch Contact Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={editForm.contactPerson || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={editForm.contactEmail || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Phone
                      </label>
                      <input
                        type="text"
                        value={editForm.contactPhone || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                        style={{
                          width: '100%',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--line)',
                          color: 'var(--text-primary)',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* API Key Management */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--signal-amber)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
                    5. Tenant Master API Secret
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={editForm.apiKey || ''}
                      className="mono-num"
                      style={{
                        flex: 1,
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-muted)',
                        padding: '7px 10px',
                        fontSize: '0.75rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyApiKey(editForm.apiKey || '')}
                      className="btn btn-ghost"
                      style={{ padding: '7px 12px', fontSize: '0.72rem', gap: '4px' }}
                      title="Copy Key"
                    >
                      {copiedKey ? <Check size={14} color="var(--signal-green)" /> : <Copy size={14} />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateKey}
                      className="btn btn-ghost"
                      style={{ padding: '7px 12px', fontSize: '0.72rem', gap: '4px' }}
                      title="Regenerate Key"
                    >
                      <Key size={14} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', gap: '6px' }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE TENANT MODAL
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(580px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} color="var(--signal-amber)" strokeWidth={2.5} />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Provision New Tenant
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCompany} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Company Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Emirates Express Cargo"
                      value={newCompany.name || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, name: e.target.value }))}
                      required
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Tenant Code * (Unique)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EMIRATES_EXP"
                      value={newCompany.code || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, code: e.target.value }))}
                      required
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Tracker Limit Quota
                    </label>
                    <input
                      type="number"
                      value={newCompany.maxDevices || 100}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, maxDevices: Number(e.target.value) }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Assigned Database Shard
                    </label>
                    <select
                      value={newCompany.dbShard || 'pg_shard_uae_01'}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, dbShard: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <option value="pg_shard_uae_01">pg_shard_uae_01 (Dubai DC)</option>
                      <option value="pg_shard_uae_02">pg_shard_uae_02 (Abu Dhabi DC)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Primary Dispatch Email
                    </label>
                    <input
                      type="email"
                      placeholder="admin@tenant.ae"
                      value={newCompany.contactEmail || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Operations Director"
                      value={newCompany.contactPerson || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, contactPerson: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    id="newSiraCheck"
                    checked={Boolean(newCompany.siraRelay)}
                    onChange={(e) => setNewCompany((prev) => ({ ...prev, siraRelay: e.target.checked }))}
                    style={{ cursor: 'pointer', accentColor: 'var(--signal-amber)' }}
                  />
                  <label htmlFor="newSiraCheck" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                    Enable SIRA UAE Security Telematics Relay for this tenant
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', gap: '6px' }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Provision Tenant</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagerPage;
