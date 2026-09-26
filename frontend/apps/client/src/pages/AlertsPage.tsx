import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Download,
  Search,
  MapPin,
  Printer,
  Check,
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface AlertRow {
  id: number;
  type: string;
  severity: string;
  vehicle: string;
  driver: string;
  driverPhone: string;
  message: string;
  time: string;
  timestamp: string;
  acknowledged: boolean;
  lat: number | null;
  lng: number | null;
}

// Legacy alert catalogue labels and tab order (matches the original RMS page).
const ALERT_TYPE_LABELS: Record<string, string> = {
  overspeed: 'Overspeed',
  over_idle: 'Over Idle',
  thirty_min: '30 Minute Alert',
  immobilizer_release: 'Immobilizer Release',
  sla_alert: 'SLA Alert',
  trip_start: 'Trip Start',
  power_cut: 'Power cut',
  harsh_braking: 'Harsh Breaking',
  harsh_cornering: 'Harsh Cornering',
  temperature: 'Reefer Temperature',
  geofence: 'Geofence',
};
const ALERT_CATEGORY_ORDER = Object.keys(ALERT_TYPE_LABELS);
const alertTypeLabel = (type: string): string => ALERT_TYPE_LABELS[type] || type || 'Alert';

interface AlertRule {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  smsEnabled?: boolean;
  emailEnabled?: boolean;
}

const severityBadgeStyle = (severity: string): React.CSSProperties => {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return { background: '#FEE2E2', color: '#DC2626' };
    case 'warning':
      return { background: '#FEF3C7', color: '#D97706' };
    case 'info':
      return { background: '#DBEAFE', color: '#2563EB' };
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--text-secondary)' };
  }
};

const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const AlertsPage: React.FC<{ initialTab?: 'alarms' | 'rules' }> = ({ initialTab = 'alarms' }) => {
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<'alarms' | 'rules'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertsRes, rulesRes] = await Promise.all([
        fetchWithAuth('/api/v1/alerts'),
        fetchWithAuth('/api/v1/alerts/rules'),
      ]);

      if (alertsRes.ok) {
        const json = await alertsRes.json();
        if (json.success && Array.isArray(json.data)) {
          // Use API alert fields as-is; no fabricated categories, plates or times.
          const formatted: AlertRow[] = json.data.map((item: any) => ({
            id: item.id,
            type: item.type || '',
            severity: item.severity || '',
            vehicle: item.vehicle || '',
            driver: item.driver || '',
            driverPhone: item.driverPhone || '',
            message: item.message || '',
            time: item.time || '',
            timestamp: item.timestamp || '',
            acknowledged: Boolean(item.acknowledged),
            lat: typeof item.lat === 'number' ? item.lat : null,
            lng: typeof item.lng === 'number' ? item.lng : null,
          }));
          setAlerts(formatted);
        }
      }

      if (rulesRes.ok) {
        const json = await rulesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setRules(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load alert records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Silent auto-refresh: reload the alert ledger and rules every 45 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 45000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

  const handleAcknowledge = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/v1/alerts/${id}/acknowledge`, {
        method: 'PUT',
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
        );
        showToast('Alert event marked as acknowledged in database.');
      } else {
        showToast('Failed to acknowledge alert.');
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      showToast('Failed to acknowledge alert.');
    }
  };

  const handleBatchAcknowledge = async () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetchWithAuth(`/api/v1/alerts/${id}/acknowledge`, {
            method: 'PUT',
          });
          return res.ok ? id : null;
        } catch (err) {
          console.error('Failed to acknowledge alert:', err);
          return null;
        }
      })
    );
    const acknowledgedIds = results.filter((id): id is number => id !== null);
    setAlerts((prev) =>
      prev.map((a) => (acknowledgedIds.includes(a.id) ? { ...a, acknowledged: true } : a))
    );
    setSelectedIds([]);
    showToast(`Acknowledged ${acknowledgedIds.length} of ${ids.length} alert events.`);
  };

  const toggleRule = async (id: number, currentActive: boolean) => {
    const nextActive = !currentActive;
    try {
      const res = await fetchWithAuth(`/api/v1/alerts/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: nextActive } : r))
        );
        showToast('Notification rule updated.');
      }
    } catch (err) {
      showToast('Failed to update rule.');
    }
  };

  // Category tabs cover the full legacy alert catalogue; counts come from the
  // alerts actually stored for this tenant (0 when no event of that type).
  const categoryTabs = useMemo(() => {
    const counts = new Map<string, number>();
    alerts.forEach((a) => {
      if (a.type) counts.set(a.type, (counts.get(a.type) || 0) + 1);
    });
    const known = ALERT_CATEGORY_ORDER.map((type) => ({
      type,
      label: alertTypeLabel(type),
      count: counts.get(type) || 0,
    }));
    const extra = Array.from(counts.keys())
      .filter((type) => !ALERT_CATEGORY_ORDER.includes(type))
      .map((type) => ({ type, label: alertTypeLabel(type), count: counts.get(type) || 0 }));
    return [{ type: 'all', label: 'All Alarms', count: alerts.length }, ...known, ...extra];
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (selectedCategory !== 'all' && a.type !== selectedCategory) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.type.toLowerCase().includes(q) ||
          alertTypeLabel(a.type).toLowerCase().includes(q) ||
          a.vehicle.toLowerCase().includes(q) ||
          a.driver.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [alerts, selectedCategory, searchQuery]);

  const pagedAlerts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAlerts.length / pageSize) || 1;

  const handleExportExcel = () => {
    const header = 'Type,Severity,Vehicle,Driver,Message,Time,Timestamp,Acknowledged\n';
    const rows = filteredAlerts
      .map(
        (a) =>
          [
            csvCell(a.type),
            csvCell(a.severity),
            csvCell(a.vehicle),
            csvCell(a.driver),
            csvCell(a.message),
            csvCell(a.time),
            csvCell(a.timestamp),
            csvCell(a.acknowledged ? 'Yes' : 'No'),
          ].join(',')
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rudra_alerts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported alert alarms to Excel / CSV');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container" style={{ maxWidth: '1400px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} color="var(--good)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Title & Top Bar Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Alert
          </h1>
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('alarms')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === 'alarms' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'alarms' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: activeTab === 'alarms' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              Active Alarms
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === 'rules' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'rules' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: activeTab === 'rules' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              Sms & Email Configuration ({rules.length})
            </button>
          </div>
        </div>

        {/* Top Controls: Export To Excel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleExportExcel}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', background: '#16A34A', borderColor: '#16A34A' }}
          >
            <Download size={15} />
            <span>Export To Excel</span>
          </button>
        </div>
      </div>

      {activeTab === 'alarms' ? (
        <>
          {/* Alarm categories derived from API alert types */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '20px',
            }}
          >
            {categoryTabs.map((cat) => {
              const active = selectedCategory === cat.type;
              return (
                <button
                  key={cat.type}
                  onClick={() => {
                    setSelectedCategory(cat.type);
                    setCurrentPage(1);
                  }}
                  style={{
                    background: active ? '#991B1B' : '#B91C1C',
                    color: '#FFFFFF',
                    border: active ? '2px solid #FEF08A' : '1px solid #7F1D1D',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '0.84rem',
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: active ? '0 0 10px rgba(185, 28, 28, 0.6)' : '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{cat.label}</span>
                  <span
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    ({cat.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table Controls (Show entries, Search, Print from Screenshot 4) */}
          <div
            className="card"
            style={{
              padding: '12px 18px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>

              {selectedIds.length > 0 && (
                <button
                  onClick={handleBatchAcknowledge}
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: '12px', fontSize: '0.8rem' }}
                >
                  <Check size={13} color="var(--good)" />
                  <span>Acknowledge Selected ({selectedIds.length})</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Search:</span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  gap: '6px',
                }}
              >
                <Search size={14} color="var(--text-secondary)" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '180px',
                  }}
                />
              </div>

              <button
                onClick={handlePrint}
                className="btn btn-secondary btn-sm"
                title="Print ledger"
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Alarm Ledger Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    <th style={{ padding: '12px 16px', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === pagedAlerts.length}
                        onChange={() => {
                          if (selectedIds.length === pagedAlerts.length) setSelectedIds([]);
                          else setSelectedIds(pagedAlerts.map((a) => a.id));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '12px 16px' }}>Type</th>
                    <th style={{ padding: '12px 16px' }}>Vehicle</th>
                    <th style={{ padding: '12px 16px' }}>Driver</th>
                    <th style={{ padding: '12px 16px' }}>Message</th>
                    <th style={{ padding: '12px 16px' }}>Severity</th>
                    <th style={{ padding: '12px 16px' }}>Time</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                        Loading real-time alarm events...
                      </td>
                    </tr>
                  ) : pagedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                        No alarm triggers recorded for{' '}
                        {categoryTabs.find((c) => c.type === selectedCategory)?.label || 'this category'}.
                      </td>
                    </tr>
                  ) : (
                    pagedAlerts.map((row) => {
                      const isSelected = selectedIds.includes(row.id);
                      return (
                        <tr
                          key={row.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(185, 28, 28, 0.05)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedIds((prev) =>
                                  prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id]
                                );
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                            <span style={{ color: severityBadgeStyle(row.severity).color }}>
                              {alertTypeLabel(row.type)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {row.vehicle || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {row.driver || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '320px' }}>
                            {row.message || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                ...severityBadgeStyle(row.severity),
                              }}
                            >
                              {row.severity || '—'}
                            </span>
                          </td>
                          <td
                            style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}
                            title={row.timestamp || undefined}
                          >
                            {row.time || row.timestamp || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              {row.lat !== null && row.lng !== null ? (
                                <a
                                  href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: 'var(--accent)',
                                    display: 'inline-flex',
                                  }}
                                  title={`Open ${row.lat.toFixed(4)}, ${row.lng.toFixed(4)} in maps`}
                                >
                                  <MapPin size={16} />
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                              )}
                              <button
                                onClick={() => handleAcknowledge(row.id)}
                                className="btn btn-secondary btn-sm"
                                disabled={row.acknowledged}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.78rem',
                                  background: row.acknowledged ? 'var(--good-bg)' : undefined,
                                  borderColor: row.acknowledged ? 'var(--good)' : undefined,
                                  color: row.acknowledged ? 'var(--good)' : undefined,
                                }}
                              >
                                {row.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div
              style={{
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>
                Showing {filteredAlerts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredAlerts.length)} of {filteredAlerts.length} entries
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <span style={{ padding: '4px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Sms & Email Configuration Tab (Legacy Configuration submenu item) */
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Sms & Email Configuration
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Define automated SMS and Email dispatch channels for critical fleet violations.
            </p>
          </div>

          {rules.length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No alert rules configured.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {rules.map((rule) => (
                <div key={rule.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {rule.name}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {rule.description || '—'}
                      </p>
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={rule.isActive}
                        onChange={() => toggleRule(rule.id, rule.isActive)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {rule.smsEnabled ? (
                      <span className="badge badge-neutral">SMS enabled</span>
                    ) : (
                      <span className="badge badge-neutral">SMS disabled</span>
                    )}
                    {rule.emailEnabled ? (
                      <span className="badge badge-neutral">Email enabled</span>
                    ) : (
                      <span className="badge badge-neutral">Email disabled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
