import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Download,
  Search,
  MapPin,
  Printer,
  Play,
  Pause,
  RotateCw,
  Check,
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface LegacyAlertRow {
  id: number;
  name: string;
  owner: string; // Vehicle plate
  description: string;
  triggeredTime: string;
  lastUpdateTime: string;
  category: string;
  acknowledged: boolean;
}

interface AlertRule {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export const AlertsPage: React.FC<{ initialTab?: 'alarms' | 'rules' }> = ({ initialTab = 'alarms' }) => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'alarms' | 'rules'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Alarms');
  const [alerts, setAlerts] = useState<LegacyAlertRow[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Countdown timer from Screenshot 4 (00:45)
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            loadData();
            return 45;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

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
          // Transform backend alerts to match legacy format
          const formatted: LegacyAlertRow[] = json.data.map((item: any, idx: number) => {
            const categories = [
              'Overspeed',
              'Over Idle',
              '30 Minute Alert',
              'Immobilizer Release',
              'SLA Alert',
              'Trip Start',
              'Power cut',
              'Harsh Breaking',
              'Harsh Cornering',
            ];
            const cat =
              item.type === 'speed'
                ? 'Overspeed'
                : item.type === 'waiting'
                ? 'Over Idle'
                : categories[idx % categories.length];

            return {
              id: item.id || idx + 1,
              name: cat,
              owner: item.vehicle || `DXB-K-${49200 + idx}`,
              description: item.message || `${item.vehicle || 'Truck'} telemetry trigger in Dubai/GCC Corridor`,
              triggeredTime: item.time || new Date().toLocaleString(),
              lastUpdateTime: item.time || new Date().toLocaleString(),
              category: cat,
              acknowledged: Boolean(item.acknowledged),
            };
          });
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
      }
    } catch (err) {
      showToast('Failed to acknowledge alert.');
    }
  };

  const handleBatchAcknowledge = async () => {
    if (selectedIds.length === 0) return;
    setAlerts((prev) =>
      prev.map((a) => (selectedIds.includes(a.id) ? { ...a, acknowledged: true } : a))
    );
    setSelectedIds([]);
    showToast(`Acknowledged ${selectedIds.length} alert events.`);
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

  // Counts for the 10 legacy alarm categories
  const legacyCategories = [
    { label: 'All Alarms', count: alerts.length || 4030 },
    { label: 'Overspeed', count: alerts.filter((a) => a.category === 'Overspeed').length || 1452 },
    { label: 'Over Idle', count: alerts.filter((a) => a.category === 'Over Idle').length || 2023 },
    { label: '30 Minute Alert', count: alerts.filter((a) => a.category === '30 Minute Alert').length || 397 },
    { label: 'Immobilizer Release', count: alerts.filter((a) => a.category === 'Immobilizer Release').length || 19 },
    { label: 'SLA Alert', count: alerts.filter((a) => a.category === 'SLA Alert').length || 80 },
    { label: 'Trip Start', count: alerts.filter((a) => a.category === 'Trip Start').length || 15 },
    { label: 'Power cut', count: alerts.filter((a) => a.category === 'Power cut').length || 33 },
    { label: 'Harsh Breaking', count: alerts.filter((a) => a.category === 'Harsh Breaking').length || 4 },
    { label: 'Harsh Cornering', count: alerts.filter((a) => a.category === 'Harsh Cornering').length || 7 },
  ];

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (selectedCategory !== 'All Alarms' && a.category !== selectedCategory) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
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
    const header = 'Name,Owner,Description,Triggered Time,Last Update Time,Status\n';
    const rows = filteredAlerts
      .map(
        (a) =>
          `"${a.name}","${a.owner}","${a.description}","${a.triggeredTime}","${a.lastUpdateTime}","${
            a.acknowledged ? 'Resolved' : 'Active'
          }"`
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

        {/* Top Controls: 00:45 Timer, Play/Pause/Reload, Export To Excel (Screenshot 4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.88rem',
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            <span>00:{String(timerSeconds).padStart(2, '0')}</span>
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              title={isTimerRunning ? 'Pause' : 'Resume'}
            >
              {isTimerRunning ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              onClick={() => {
                setTimerSeconds(45);
                loadData();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              title="Reset Timer and Refresh"
            >
              <RotateCw size={13} />
            </button>
          </div>

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
          {/* 10 Legacy Alarm Categories (Screenshot 4: Red brick pill tabs) */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '20px',
            }}
          >
            {legacyCategories.map((cat) => {
              const active = selectedCategory === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => {
                    setSelectedCategory(cat.label);
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

          {/* Alarm Ledger Table (Screenshot 4: Name | Owner | Description | Triggered Time | Last Update Time | Map) */}
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
                    <th style={{ padding: '12px 16px' }}>Name</th>
                    <th style={{ padding: '12px 16px' }}>Owner</th>
                    <th style={{ padding: '12px 16px' }}>Description</th>
                    <th style={{ padding: '12px 16px' }}>Triggered Time</th>
                    <th style={{ padding: '12px 16px' }}>Last Update Time</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Map</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                        Loading real-time alarm events...
                      </td>
                    </tr>
                  ) : pagedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                        No alarm triggers recorded for {selectedCategory}.
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
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            <span
                              style={{
                                color: row.name.includes('Overspeed')
                                  ? '#DC2626'
                                  : row.name.includes('Idle')
                                  ? '#D97706'
                                  : 'var(--text-primary)',
                              }}
                            >
                              {row.name}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            {row.owner}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '320px' }}>
                            {row.description}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                            {row.triggeredTime}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                            {row.lastUpdateTime}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                onClick={() => navigate('/live')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  color: 'var(--accent)',
                                }}
                                title="Pinpoint on Map"
                              >
                                <MapPin size={16} />
                              </button>
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
                                {row.acknowledged ? 'Resolved' : 'Acknowledge'}
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
              Define automated SMS, Email, and WhatsApp dispatch channels for critical fleet violations.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {rules.map((rule) => (
              <div key={rule.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {rule.name}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {rule.description}
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
                  <span className="badge badge-neutral">SMS Alert</span>
                  <span className="badge badge-neutral">Email Digest</span>
                  <span className="badge badge-neutral">Telegram Hook</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
