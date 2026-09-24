import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Phone,
  Check,
} from 'lucide-react';

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

const initialAlerts: AlertItem[] = [
  {
    id: 1,
    type: 'speed',
    severity: 'needs-attention',
    vehicle: '84707',
    driver: 'Muhammad Rizwan',
    driverPhone: '+971 50 1000057',
    message: 'Vehicle drove at 90 km/h (Limit: 80 km/h) on E11 Highway towards Abu Dhabi',
    time: '10:14 am',
    acknowledged: false,
  },
  {
    id: 2,
    type: 'zone',
    severity: 'info',
    vehicle: '95321',
    driver: 'Yog Raj Sharma',
    driverPhone: '+971 50 1000050',
    message: 'Vehicle departed "Allied Logistics Depot, DWC Dubai"',
    time: '09:48 am',
    acknowledged: true,
  },
  {
    id: 3,
    type: 'waiting',
    severity: 'needs-attention',
    vehicle: '82561',
    driver: 'Abdul Jelil',
    driverPhone: '+971 50 1000051',
    message: 'Vehicle has been waiting with engine on for 25 minutes at New Batha Corridor',
    time: '09:12 am',
    acknowledged: false,
  },
];

const initialRules: AlertRule[] = [
  {
    id: 1,
    name: 'Speed limit warning',
    description: 'Send an alert when any truck exceeds 80 km/h on highways.',
    isActive: true,
  },
  {
    id: 2,
    name: 'Zone arrival & departure',
    description: 'Send an alert when vehicles enter or leave Jebel Ali Port or warehouse yards.',
    isActive: true,
  },
  {
    id: 3,
    name: 'Long engine idling reminder',
    description: 'Notify dispatcher when a vehicle is stopped with engine on for more than 20 minutes.',
    isActive: true,
  },
];

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    const saved = localStorage.getItem('rudra_fleet_alerts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.warn('Failed to parse saved alerts from localStorage', err);
      }
    }
    return initialAlerts;
  });

  useEffect(() => {
    localStorage.setItem('rudra_fleet_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const [rules, setRules] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem('rudra_alert_rules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.warn('Failed to parse saved alert rules from localStorage', err);
      }
    }
    return initialRules;
  });

  useEffect(() => {
    localStorage.setItem('rudra_alert_rules', JSON.stringify(rules));
  }, [rules]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAcknowledge = (id: number) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    showToast('Alert marked as resolved.');
  };

  const toggleRule = (id: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
    showToast('Alert preferences updated.');
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

      {/* Rules Tab */}
      {activeTab === 'rules' && (
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
                onClick={() => toggleRule(rule.id)}
                className={rule.isActive ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                {rule.isActive ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
