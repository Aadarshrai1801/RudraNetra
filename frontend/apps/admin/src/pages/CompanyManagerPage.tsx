import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Users,
  Sliders,
  ShieldCheck,
  Key,
  X,
  Check,
  Search,
  Copy,
  Radio,
  Activity,
  Mail,
  Calendar,
  Database,
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

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
  city: string;
  address: string;
  siraRelay: boolean;
  apiKey: string;
  createdAt: string;
}

interface AdminStats {
  totalTenants: number;
  activeVehicles: number;
  systemUsers: number;
  siraRelayActive: number;
}

interface AdminDashboard {
  totalTenants: number;
  totalDevices: number;
  onlineDevices: number;
  totalVehicles: number;
  systemUsers: number;
  unacknowledgedAlerts: number;
  activeTrips: number;
  totalInvoices: number;
  positionsLast24h: number;
}

export const CompanyManagerPage: React.FC = () => {
  const [companies, setCompanies] = useState<TenantCompany[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const [companiesRes, statsRes, dashboardRes] = await Promise.all([
        fetchWithAdminAuth('/api/v1/admin/companies'),
        fetchWithAdminAuth('/api/v1/admin/stats'),
        fetchWithAdminAuth('/api/v1/admin/dashboard'),
      ]);

      if (companiesRes.ok) {
        const json = await companiesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setCompanies(json.data);
        }
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      }
      if (dashboardRes.ok) {
        const json = await dashboardRes.json();
        if (json.success && json.data) {
          setDashboard(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load companies from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

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
    maxDevices: undefined,
    maxUsers: undefined,
    status: 'Active',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    dbShard: 'pg_shard_uae_01',
    city: '',
    address: '',
    siraRelay: false,
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

  const handleSaveManage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const res = await fetchWithAdminAuth(`/api/v1/admin/companies/${selectedCompany.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          code: editForm.code,
          contactPerson: editForm.contactPerson,
          contactEmail: editForm.contactEmail,
          contactPhone: editForm.contactPhone,
          dbShard: editForm.dbShard,
          status: editForm.status,
          maxDevices: Number(editForm.maxDevices) || 0,
          maxUsers: Number(editForm.maxUsers) || 0,
          siraRelay: Boolean(editForm.siraRelay),
          city: editForm.city,
          address: editForm.address,
        }),
      });

      if (res.ok) {
        showToast(`Organization "${editForm.name || selectedCompany.name}" updated in database.`);
        setIsEditModalOpen(false);
        loadCompanies();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Failed to update organization in database.');
      }
    } catch (err) {
      showToast('Network error updating organization.');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name || !newCompany.code) {
      alert('Please enter both Company Name and Tenant Code.');
      return;
    }

    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: newCompany.name,
          code: newCompany.code.toUpperCase().replace(/\s+/g, '_'),
          contactPerson: newCompany.contactPerson || '',
          contactEmail: newCompany.contactEmail || '',
          contactPhone: newCompany.contactPhone || '',
          dbShard: newCompany.dbShard || '',
          status: newCompany.status || 'Active',
          maxDevices: Number(newCompany.maxDevices) || 0,
          maxUsers: Number(newCompany.maxUsers) || 0,
          siraRelay: Boolean(newCompany.siraRelay),
          city: newCompany.city || '',
          address: newCompany.address || '',
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(
          json.apiKey
            ? `Organization "${newCompany.name}" provisioned. API key: ${json.apiKey}`
            : `Organization "${newCompany.name}" provisioned in PostgreSQL database.`
        );
        setIsCreateModalOpen(false);
        setNewCompany({
          name: '',
          code: '',
          maxDevices: undefined,
          maxUsers: undefined,
          status: 'Active',
          contactPerson: '',
          contactEmail: '',
          contactPhone: '',
          dbShard: 'pg_shard_uae_01',
          city: '',
          address: '',
          siraRelay: false,
        });
        loadCompanies();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Failed to create organization in database.');
      }
    } catch (err) {
      showToast('Network error provisioning organization.');
    }
  };

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!selectedCompany) return;
    try {
      const res = await fetchWithAdminAuth(`/api/v1/admin/companies/${selectedCompany.id}`, {
        method: 'PUT',
        body: JSON.stringify({ regenerateKey: true }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Failed to regenerate API key.');
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (json.apiKey) {
        setEditForm((prev) => ({ ...prev, apiKey: json.apiKey }));
        showToast('API key regenerated and stored in the database.');
        loadCompanies();
      } else {
        showToast('API key regeneration did not return a key.');
      }
    } catch (err) {
      showToast('Network error regenerating API key.');
    }
  };

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (c.name || '').toLowerCase().includes(query) ||
      (c.code || '').toLowerCase().includes(query) ||
      (c.contactPerson || '').toLowerCase().includes(query) ||
      (c.contactEmail || '').toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregated metrics — every value here is returned by /admin/stats or /admin/dashboard.
  const totalTrackers = dashboard?.totalDevices ?? companies.reduce((acc, c) => acc + (c.devices || 0), 0);
  const totalMaxTrackers = companies.reduce((acc, c) => acc + (c.maxDevices || 0), 0);
  const totalUsers = dashboard?.systemUsers ?? stats?.systemUsers ?? companies.reduce((acc, c) => acc + (c.users || 0), 0);
  const totalTenants = stats?.totalTenants ?? dashboard?.totalTenants ?? companies.length;
  const capacityPercent = totalMaxTrackers > 0 ? Math.round((totalTrackers / totalMaxTrackers) * 100) : null;

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '32px',
            zIndex: 1100,
            background: 'var(--bg-card)',
            border: '1px solid var(--good-border)',
            borderLeft: '4px solid var(--good)',
            color: 'var(--text-primary)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            fontWeight: 500,
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--good-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={13} color="var(--good)" strokeWidth={2.5} />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Organization & Tenant Registry
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '6px' }}>
            Multi-tenant routing, hardware device allocations, and SIRA compliance relays across Dubai and the UAE.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          style={{ padding: '10px 18px', gap: '8px', fontSize: '0.88rem' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Provision Organization</span>
        </button>
      </div>

      {/* 4 Daylight Operational Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '18px',
          marginBottom: '28px',
        }}
      >
        {/* Metric 1: Total Tenants */}
        <div className="admin-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Registered Organizations
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={18} color="var(--accent)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span className="mono-num" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totalTenants}
            </span>
            {stats && (
              <span className="badge badge-subtle" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                {stats.siraRelayActive} SIRA relays
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
            Tenants provisioned in PostgreSQL
          </div>
        </div>

        {/* Metric 2: Allocated Trackers */}
        <div className="admin-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Registered Trackers
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--attention-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Radio size={18} color="var(--attention)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono-num" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totalTrackers}
            </span>
            {totalMaxTrackers > 0 && (
              <span className="mono-num" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                / {totalMaxTrackers} cap
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
            {capacityPercent !== null
              ? `${capacityPercent}% of configured device capacity used`
              : 'No device capacity configured across tenants'}
          </div>
        </div>

        {/* Metric 3: Active Operator Seats */}
        <div className="admin-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Dispatcher Seats
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} color="var(--text-secondary)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono-num" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totalUsers}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Users
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
            User accounts registered across all tenants
          </div>
        </div>

        {/* Metric 4: Telemetry Positions Ingested */}
        <div className="admin-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Positions Ingested (24h)
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--good-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={18} color="var(--good)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono-num" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {dashboard ? dashboard.positionsLast24h : '—'}
            </span>
            <span className="mono-num" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              positions
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
            Telemetry positions recorded in the last 24 hours
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Field */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            flex: '1',
            maxWidth: '420px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Search size={16} color="var(--text-tertiary)" />
          <input
            type="text"
            placeholder="Search by company name, code, contact or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              width: '100%',
              fontFamily: 'var(--font-family)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Segmented Control */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-subtle)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          {(['ALL', 'Active', 'Suspended'] as const).map((filter) => {
            const isSelected = statusFilter === filter;
            const count =
              filter === 'ALL'
                ? companies.length
                : companies.filter((c) => c.status === filter).length;

            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  background: isSelected ? 'var(--bg-card)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{filter === 'ALL' ? 'All Organizations' : filter}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: isSelected ? 'var(--accent-light)' : 'rgba(0,0,0,0.05)',
                    color: isSelected ? 'var(--accent)' : 'var(--text-tertiary)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tenant Organizations Grid */}
      {loading ? (
        <div className="admin-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Building2 size={36} color="var(--accent)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Loading Organizations from Database...
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
            Retrieving live multi-tenant telemetry profiles from PostgreSQL.
          </p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div
          className="admin-card"
          style={{
            padding: '48px',
            textAlign: 'center',
            marginTop: '20px',
          }}
        >
          <Building2 size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            No Organizations Found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
            No tenants match the search filter "{searchQuery}".
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(430px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredCompanies.map((c) => {
            const hasDeviceCap = c.maxDevices > 0;
            const usagePercent = hasDeviceCap
              ? Math.min(100, Math.round(((c.devices || 0) / c.maxDevices) * 100))
              : 0;

            return (
              <div
                key={c.id}
                className="admin-card"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {/* Organization Identity & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--accent-light)',
                          border: '1px solid rgba(47, 111, 109, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Building2 size={22} color="var(--accent)" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                          {c.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span
                            className="mono-num"
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              background: 'var(--bg-subtle)',
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {c.code}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Database size={12} />
                            <span>{c.dbShard}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <span className={`badge ${c.status === 'Active' ? 'badge-good' : 'badge-alert'}`}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: c.status === 'Active' ? 'var(--good)' : 'var(--alert)',
                          display: 'inline-block',
                        }}
                      />
                      <span>{c.status}</span>
                    </span>
                  </div>

                  {/* Device Allocation Gauge */}
                  <div
                    style={{
                      margin: '16px 0',
                      background: 'var(--bg-subtle)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Trackers Assigned</span>
                      <span className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                        {c.devices} / {hasDeviceCap ? c.maxDevices : '—'}{' '}
                        {hasDeviceCap && (
                          <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>({usagePercent}%)</span>
                        )}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#DCE4DF', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${usagePercent}%`,
                          height: '100%',
                          background: usagePercent > 90 ? 'var(--alert)' : 'var(--accent)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Tenant Meta Info Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Users size={14} color="var(--text-tertiary)" />
                      <span>
                        Seats: <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>{c.users} / {c.maxUsers > 0 ? c.maxUsers : '—'}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <ShieldCheck size={14} color={c.siraRelay ? 'var(--good)' : 'var(--text-tertiary)'} />
                      <span>
                        SIRA:{' '}
                        <strong style={{ color: c.siraRelay ? 'var(--good)' : 'var(--text-tertiary)' }}>
                          {c.siraRelay ? 'Active Relay' : 'Standard'}
                        </strong>
                      </span>
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Mail size={14} color="var(--text-tertiary)" />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {c.contactPerson || '—'}
                        {c.contactEmail ? (
                          <>
                            {' '}&middot;{' '}
                            <span style={{ color: 'var(--text-tertiary)' }}>{c.contactEmail}</span>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Calendar size={13} />
                    <span>Added {c.createdAt}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenManage(c)}
                    className="btn btn-primary"
                    style={{
                      padding: '7px 14px',
                      fontSize: '0.8rem',
                      gap: '6px',
                    }}
                    id={`manage-tenant-${c.id}`}
                  >
                    <Sliders size={14} strokeWidth={2.2} />
                    <span>Manage Organization</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MANAGE ORGANIZATION MODAL
          ========================================================================= */}
      {isEditModalOpen && selectedCompany && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="admin-card"
            style={{
              width: 'min(640px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-page)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sliders size={18} color="var(--accent)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Manage Organization · {selectedCompany.name}
                  </h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    ID: {selectedCompany.id} &middot; Code: <span className="mono-num">{selectedCompany.code}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              >
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveManage} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Section 1: Organization Details */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.03em' }}>
                    1. Identity & Operating Status
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label">Company Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Operational Status</label>
                      <select
                        className="form-select"
                        value={editForm.status || 'Active'}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as 'Active' | 'Suspended' }))}
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginTop: '14px' }}>
                    <div>
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.city || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Address</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Section 2: Quotas & Allocations */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.03em' }}>
                    2. Hardware Quotas & Dispatch Seats
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label">Tracker Limit (Max Devices)</label>
                      <input
                        type="number"
                        className="form-input mono-num"
                        min={0}
                        value={editForm.maxDevices ?? 0}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, maxDevices: Number(e.target.value) }))}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                        Currently assigned: {selectedCompany.devices} trackers
                      </span>
                    </div>

                    <div>
                      <label className="form-label">Dispatcher User Seats</label>
                      <input
                        type="number"
                        className="form-input mono-num"
                        min={0}
                        value={editForm.maxUsers ?? 0}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, maxUsers: Number(e.target.value) }))}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                        Currently active: {selectedCompany.users} operators
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Section 3: Database & Compliance */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.03em' }}>
                    3. Database Partition & SIRA Relay
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label">TimescaleDB Shard</label>
                      <select
                        className="form-select mono-num"
                        value={editForm.dbShard || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, dbShard: e.target.value }))}
                      >
                        <option value="" disabled>Select shard</option>
                        <option value="pg_shard_uae_01">pg_shard_uae_01 (Dubai Datacenter)</option>
                        <option value="pg_shard_uae_02">pg_shard_uae_02 (Abu Dhabi Datacenter)</option>
                        <option value="pg_shard_isolated">pg_shard_isolated (Dedicated Hypertable)</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">SIRA Telematics Relay</label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'var(--bg-subtle)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          marginTop: '2px',
                        }}
                      >
                        <input
                          type="checkbox"
                          id="siraRelayCheck"
                          checked={Boolean(editForm.siraRelay)}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, siraRelay: e.target.checked }))}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                        />
                        <label htmlFor="siraRelayCheck" style={{ fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500 }}>
                          Enable SIRA-V4 UAE Security Relay
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Section 4: Primary Contact */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.03em' }}>
                    4. Dispatch Contact Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label">Contact Person</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.contactPerson || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={editForm.contactEmail || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Phone</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.contactPhone || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)' }} />

                {/* Section 5: API Key */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.03em' }}>
                    5. Tenant Master API Secret
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={editForm.apiKey || ''}
                      className="form-input mono-num"
                      style={{
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyApiKey(editForm.apiKey || '')}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px' }}
                      title="Copy Key"
                    >
                      {copiedKey ? <Check size={14} color="var(--good)" /> : <Copy size={14} />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateKey}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px' }}
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
                  gap: '12px',
                  marginTop: '28px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '9px 22px', gap: '6px' }}
                >
                  <Check size={15} strokeWidth={2.5} />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          PROVISION NEW TENANT MODAL
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="admin-card"
            style={{
              width: 'min(600px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-page)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={18} color="var(--accent)" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Provision New Organization
                  </h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Create dedicated routing, shard allocations, and API keys
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              >
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCompany} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">Organization Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter organization name"
                      value={newCompany.name || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Tenant Code * (Unique)</label>
                    <input
                      type="text"
                      className="form-input mono-num"
                      placeholder="Enter unique tenant code"
                      value={newCompany.code || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, code: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">Tracker Limit (Hardware Quota)</label>
                    <input
                      type="number"
                      className="form-input mono-num"
                      min={0}
                      value={newCompany.maxDevices ?? ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, maxDevices: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Assigned Database Shard</label>
                    <select
                      className="form-select mono-num"
                      value={newCompany.dbShard || 'pg_shard_uae_01'}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, dbShard: e.target.value }))}
                    >
                      <option value="pg_shard_uae_01">pg_shard_uae_01 (Dubai DC)</option>
                      <option value="pg_shard_uae_02">pg_shard_uae_02 (Abu Dhabi DC)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">Dispatcher User Seats</label>
                    <input
                      type="number"
                      className="form-input mono-num"
                      min={0}
                      value={newCompany.maxUsers ?? ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, maxUsers: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +971 4 000 0000"
                      value={newCompany.contactPhone || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, contactPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dubai"
                      value={newCompany.city || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Street, area, emirate"
                      value={newCompany.address || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">Primary Dispatch Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="admin@tenant.ae"
                      value={newCompany.contactEmail || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Operations Director"
                      value={newCompany.contactPerson || ''}
                      onChange={(e) => setNewCompany((prev) => ({ ...prev, contactPerson: e.target.value }))}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'var(--bg-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    marginTop: '4px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="newSiraCheck"
                    checked={Boolean(newCompany.siraRelay)}
                    onChange={(e) => setNewCompany((prev) => ({ ...prev, siraRelay: e.target.checked }))}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                  />
                  <label htmlFor="newSiraCheck" style={{ fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500 }}>
                    Enable SIRA UAE Security Telematics Relay for this tenant
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '9px 22px', gap: '6px' }}
                >
                  <Plus size={15} strokeWidth={2.5} />
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
