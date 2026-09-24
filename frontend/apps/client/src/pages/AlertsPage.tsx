import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Phone,
  Check,
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface AlertItem {
  id: number;
  type: 'speed' | 'zone' | 'waiting';
  severity: 'needs-attention' | 'info';
  vehicle: string;
  driver: string;
  driverPhone: string;
  message: string;
  time: string;
  acknowledged: boolean;
}

interface AlertRule {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export const AlertsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');
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
          setAlerts(json.data);
        }
      }

      if (rulesRes.ok) {
        const json = await rulesRes.json();
        if (json.success && Array.isArray(json.data)) {
          setRules(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load alerts from DB:', err);
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
        showToast('Alert marked as resolved in database.');
      }
    } catch (err) {
      showToast('Failed to acknowledge alert.');
    }
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
        showToast('Alert preference updated in database.');
      }
    } catch (err) {
      showToast('Failed to update alert rule.');
    }
  };

  const activeAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="page-container" style={{ maxWidth: '1060px' }}>
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

      {/* Screen Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Alerts
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
          Real-time safety notifications and customizable rules for your fleet.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('alerts')}
          className={activeTab === 'alerts' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Recent alerts ({activeAlertsCount} need review)
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={activeTab === 'rules' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
        >
          Alert rules ({rules.length})
        </button>
      </div>

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading alerts from database…
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No alerts recorded for this organization yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="card"
                  style={{
                    borderLeft: a.acknowledged ? '1px solid var(--border)' : '4px solid var(--attention)',
                    padding: '20px 24px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {a.vehicle}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Driver: {a.driver}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                        {a.time}
                      </span>
                      {a.acknowledged ? (
                        <span className="badge badge-neutral">
                          <Check size={12} />
                          <span>Resolved</span>
                        </span>
                      ) : (
                        <span className="badge badge-attention">
                          <span>Needs review</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '0.925rem', color: 'var(--text-primary)', marginBottom: '14px', lineHeight: 1.4 }}>
                    {a.message}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <a
                      href={`tel:${a.driverPhone}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <Phone size={14} />
                      <span>Call {a.driver}</span>
                    </a>

                    {!a.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        <span>Mark as resolved</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading alert rules from database…
            </div>
          ) : rules.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No alert rules configured for this organization.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {rules.map((rule) => (
                <div key={rule.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rule.name}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {rule.description}
                    </p>
                  </div>

                  <button
                    onClick={() => toggleRule(rule.id, rule.isActive)}
                    className={rule.isActive ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  >
                    {rule.isActive ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
