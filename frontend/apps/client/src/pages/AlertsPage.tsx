import React, { useState } from 'react';
import { Bell, Plus, CheckCircle2, MessageSquare, Mail, X, Check, AlertTriangle } from 'lucide-react';

interface AlertItem {
  id: number;
  type: 'overspeed' | 'geofence' | 'ignition' | 'sos';
  severity: 'critical' | 'warning' | 'info';
  vehicle: string;
  driver: string;
  message: string;
  time: string;
  acknowledged: boolean;
}

interface AlertRule {
  id: number;
  name: string;
  type: string;
  threshold: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  recipients: string;
  isActive: boolean;
}

const mockAlerts: AlertItem[] = [
  {
    id: 1,
    type: 'overspeed',
    severity: 'critical',
    vehicle: 'AUH-C-11029',
    driver: 'Ahmed Al-Falasi',
    message: 'Vehicle exceeded speed limit: 89.2 km/h (Limit: 80 km/h) on Sheikh Zayed Road',
    time: '10:14 AM',
    acknowledged: false,
  },
  {
    id: 2,
    type: 'geofence',
    severity: 'warning',
    vehicle: 'DXB-A-98124',
    driver: 'Mohammed Imran',
    message: 'Exited geofence "Jebel Ali Port & Freezone" through Gate 3 without clearance',
    time: '09:48 AM',
    acknowledged: true,
  },
  {
    id: 3,
    type: 'ignition',
    severity: 'info',
    vehicle: 'DXB-B-43210',
    driver: 'Harpreet Singh',
    message: 'Engine ignition switched ON after 45 minutes idle at Al Quoz Warehouse',
    time: '09:12 AM',
    acknowledged: true,
  },
];

const mockRules: AlertRule[] = [
  {
    id: 1,
    name: 'Fleet Over-speed Limit (> 80 km/h)',
    type: 'Speed Threshold',
    threshold: 'Speed > 80 km/h for > 15s',
    smsEnabled: true,
    emailEnabled: true,
    recipients: '+971-50-1234567, dispatch@vavelogistics.ae',
    isActive: true,
  },
  {
    id: 2,
    name: 'Unauthorized Geofence Exit',
    type: 'Spatial Polygon Breach',
    threshold: 'Trigger on Exit from Jebel Ali & DXB Airport',
    smsEnabled: true,
    emailEnabled: false,
    recipients: '+971-50-1234567',
    isActive: true,
  },
  {
    id: 3,
    name: 'Night-time Off-Duty Engine Ignition',
    type: 'Ignition Sensor (ACC)',
    threshold: 'Ignition ON between 23:00 - 05:00',
    smsEnabled: false,
    emailEnabled: true,
    recipients: 'security@vavelogistics.ae',
    isActive: true,
  },
  {
    id: 4,
    name: 'SOS Panic Button Event',
    type: 'Hardware Emergency Pin',
    threshold: 'Digital Input 1 (DIN1) Active High',
    smsEnabled: true,
    emailEnabled: true,
    recipients: 'All Emergency Contacts',
    isActive: true,
  },
];

export const AlertsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'log' | 'rules' | 'sms'>('log');
  const [alerts, setAlerts] = useState<AlertItem[]>(mockAlerts);
  const [rules, setRules] = useState<AlertRule[]>(mockRules);
  const [isCreateRuleModalOpen, setIsCreateRuleModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newRule, setNewRule] = useState({
    name: '',
    type: 'Overspeed',
    threshold: 'Speed > 80 km/h for 15s',
    smsEnabled: true,
    emailEnabled: true,
    recipients: '+971-50-1234567, ops@vaveuae.ae',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleRule = (id: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const acknowledgeAlert = (id: number) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    showToast('Alert incident acknowledged.');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name) return;
    const created: AlertRule = {
      id: Date.now(),
      name: newRule.name,
      type: newRule.type,
      threshold: newRule.threshold,
      smsEnabled: newRule.smsEnabled,
      emailEnabled: newRule.emailEnabled,
      recipients: newRule.recipients,
      isActive: true,
    };
    setRules((prev) => [...prev, created]);
    setIsCreateRuleModalOpen(false);
    setNewRule({
      name: '',
      type: 'Overspeed',
      threshold: 'Speed > 80 km/h for 15s',
      smsEnabled: true,
      emailEnabled: true,
      recipients: '+971-50-1234567, ops@vaveuae.ae',
    });
    showToast(`Rule "${created.name}" created and active.`);
  };

  const handleSaveGateway = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Sigma SMS Gateway parameters saved successfully.');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Alerts, Rules & SMS Configuration</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Real-time event trigger engine, overspeed alerts, and geofence notifications.
          </p>
        </div>
        <button
          onClick={() => setIsCreateRuleModalOpen(true)}
          className="btn btn-primary"
          style={{ gap: '8px' }}
        >
          <Plus size={16} />
          Create Alert Rule
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('log')}
          className="btn"
          style={{
            background: activeTab === 'log' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Incident Log ({alerts.filter((a) => !a.acknowledged).length} Active)
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className="btn"
          style={{
            background: activeTab === 'rules' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          Rule Definitions ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className="btn"
          style={{
            background: activeTab === 'sms' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            padding: '8px 18px',
          }}
        >
          SMS Gateway & Templates
        </button>
      </div>

      {/* Incident Log Tab */}
      {activeTab === 'log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderLeft: `4px solid ${
                  alert.severity === 'critical'
                    ? '#ef4444'
                    : alert.severity === 'warning'
                    ? '#f59e0b'
                    : '#38bdf8'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    background:
                      alert.severity === 'critical'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : alert.severity === 'warning'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(56, 189, 248, 0.15)',
                  }}
                >
                  <Bell
                    size={20}
                    color={
                      alert.severity === 'critical'
                        ? '#ef4444'
                        : alert.severity === 'warning'
                        ? '#f59e0b'
                        : '#38bdf8'
                    }
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>{alert.vehicle}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({alert.driver})</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: alert.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{alert.message}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {alert.time}
                </span>
                {!alert.acknowledged ? (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                  >
                    Acknowledge
                  </button>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981' }}>
                    <CheckCircle2 size={15} />
                    Acknowledged
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {rules.map((rule) => (
            <div key={rule.id} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: rule.isActive ? '#fff' : 'var(--text-muted)' }}>
                  {rule.name}
                </h3>
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={() => toggleRule(rule.id)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-accent)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                <div>Type: <strong style={{ color: '#fff' }}>{rule.type}</strong></div>
                <div style={{ marginTop: '4px' }}>Rule: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>{rule.threshold}</span></div>
              </div>

              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', marginBottom: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: rule.smsEnabled ? '#10b981' : '#64748b' }}>
                  <MessageSquare size={13} />
                  SMS: {rule.smsEnabled ? 'ON' : 'OFF'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: rule.emailEnabled ? '#10b981' : '#64748b' }}>
                  <Mail size={13} />
                  Email: {rule.emailEnabled ? 'ON' : 'OFF'}
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                Recipients: {rule.recipients}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SMS Gateway Tab */}
      {activeTab === 'sms' && (
        <div className="glass-panel" style={{ padding: '24px', maxWidth: '720px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
            Sigma SMS Gateway Configuration
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Configure HTTP dispatch parameters for GSM/SMS driver and manager notifications.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                API Endpoint URL
              </label>
              <input
                type="text"
                defaultValue="https://api.sigmasms.com/send"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Sender ID (Alpha Header)
                </label>
                <input
                  type="text"
                  defaultValue="VAVETK"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Gateway Username
                </label>
                <input
                  type="text"
                  defaultValue="vave_telematics"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                Default Alert SMS Template
              </label>
              <textarea
                rows={3}
                defaultValue="ALERT: Vehicle {{reg_number}} triggered {{alert_type}} at {{speed}} km/h. Location: {{lat}}, {{lng}} at {{timestamp}}."
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: '8px', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              />
            </div>

            <button
              type="button"
              onClick={handleSaveGateway}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', gap: '6px' }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Save Gateway Configuration</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '56px',
            right: '24px',
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

      {/* Create Alert Rule Modal */}
      {isCreateRuleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateRuleModalOpen(false)}>
          <div
            className="ops-panel"
            style={{
              width: 'min(500px, 95vw)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="var(--signal-amber)" />
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                  Create Telematics Alert Rule
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRuleModalOpen(false)}
                className="btn-ghost"
                style={{ padding: '4px', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Excessive Idle Detection"
                    value={newRule.name}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--line)',
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Alert Trigger Category
                    </label>
                    <select
                      value={newRule.type}
                      onChange={(e) => setNewRule((prev) => ({ ...prev, type: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    >
                      <option value="Overspeed">Overspeed Limit</option>
                      <option value="Geofence Exit">Geofence Exit Breach</option>
                      <option value="Excessive Idling">Excessive Idling</option>
                      <option value="Panic Button">SOS / Panic Button</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Threshold Condition
                    </label>
                    <input
                      type="text"
                      value={newRule.threshold}
                      onChange={(e) => setNewRule((prev) => ({ ...prev, threshold: e.target.value }))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Alert Recipients (Phones & Emails)
                  </label>
                  <input
                    type="text"
                    value={newRule.recipients}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, recipients: e.target.value }))}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--line)',
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRule.smsEnabled}
                      onChange={(e) => setNewRule((prev) => ({ ...prev, smsEnabled: e.target.checked }))}
                      style={{ accentColor: 'var(--signal-amber)' }}
                    />
                    Enable SMS Alert
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newRule.emailEnabled}
                      onChange={(e) => setNewRule((prev) => ({ ...prev, emailEnabled: e.target.checked }))}
                      style={{ accentColor: 'var(--signal-amber)' }}
                    />
                    Enable Email Alert
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                <button type="button" onClick={() => setIsCreateRuleModalOpen(false)} className="btn btn-ghost" style={{ padding: '6px 14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 18px', gap: '6px' }}>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Activate Rule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
