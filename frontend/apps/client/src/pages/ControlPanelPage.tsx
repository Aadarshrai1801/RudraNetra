import React, { useState, useEffect } from 'react';
import { 
  Sliders, Power, ShieldAlert, Key, Lock, Volume2, 
  CheckCircle2, Clock, Car, Radio, ShieldCheck
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface CommandLog {
  id: number;
  deviceId: number;
  vehicleReg: string;
  commandType: string;
  commandStr: string;
  sentBy: string;
  status: string;
  sentAt: string;
  ackAt?: string;
}

export const ControlPanelPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('1');
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ command: string; title: string; desc: string } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadCommandLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/commands/logs');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCommandLogs(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load command audit logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadCommandLogs();
  }, [user?.company_id]);

  useEffect(() => {
    if (vehicleList.length > 0 && selectedVehicleId === '1') {
      setSelectedVehicleId(String(vehicleList[0].device_id));
    }
  }, [vehicleList]);

  const initiateCommand = (command: string, title: string, desc: string, requirePin: boolean) => {
    if (requirePin) {
      setPendingAction({ command, title, desc });
      setEnteredPin('');
      setPinError('');
      setIsPinModalOpen(true);
    } else {
      executeCommand(command, '');
    }
  };

  const executeCommand = async (commandType: string, pin: string) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/v1/devices/${selectedVehicleId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandType,
          pin,
          notes: 'Dispatched from Control Panel interface',
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || `Command ${commandType} transmitted successfully`);
        setIsPinModalOpen(false);
        loadCommandLogs();
      } else {
        setPinError(json.error || 'Failed to dispatch command');
        if (!isPinModalOpen) {
          showToast(json.error || 'Command dispatch failed');
        }
      }
    } catch (err) {
      showToast('Network error dispatching command to gateway');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPin) {
      setPinError('Security PIN required');
      return;
    }
    if (pendingAction) {
      executeCommand(pendingAction.command, enteredPin);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1180px' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '14px 22px',
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
          <CheckCircle2 size={18} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={24} color="var(--accent)" />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Remote Control Panel & Immobilizer
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
          Transmit immediate hardware relay signals: anti-theft engine cut, central door locks, siren alarm, and cold-chain AC control.
        </p>
      </div>

      {/* Target Vehicle Selector Card */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Active Telemetry Channel</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Select Target Unit</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '320px' }}>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.92rem',
                fontWeight: 600,
                background: 'var(--bg-subtle)',
              }}
            >
              {vehicleList.length > 0 ? (
                vehicleList.map((v) => (
                  <option key={v.device_id} value={v.device_id}>
                    {v.reg_number || v.name || v.device_id} ({v.status})
                  </option>
                ))
              ) : (
                <option value="">Loading fleet vehicles ({vehicleList.length})...</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Action Command Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '32px' }}>
        {/* Engine Immobilize (Cut) */}
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #DC2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#DC2626' }}>Engine Immobilizer (Cut)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Power size={18} color="#DC2626" />
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px', minHeight: '38px' }}>
            Cuts digital output DOUT1 to open the ignition fuel pump relay. Prevents starting.
          </p>
          <button
            onClick={() => initiateCommand('IEngineOff', 'Cut Vehicle Engine Relay', 'This will safely disable fuel ignition when vehicle drops below safe speed.', true)}
            className="btn"
            disabled={loading}
            style={{ width: '100%', background: '#DC2626', color: '#FFFFFF', border: 'none', padding: '10px' }}
          >
            <ShieldAlert size={15} />
            <span>Immobilize Engine</span>
          </button>
        </div>

        {/* Engine Resume (Enable) */}
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--good)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--good)' }}>Resume Engine Power</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="var(--good)" />
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px', minHeight: '38px' }}>
            Resets DOUT1 relay to normal state. Allows driver to crank engine normally.
          </p>
          <button
            onClick={() => initiateCommand('IEngineOn', 'Resume Engine Ignition', 'Restores starter circuit relay to operational position.', false)}
            className="btn"
            disabled={loading}
            style={{ width: '100%', background: 'var(--good)', color: '#FFFFFF', border: 'none', padding: '10px' }}
          >
            <Power size={15} />
            <span>Resume Engine</span>
          </button>
        </div>

        {/* Siren / Hooter Alarm */}
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--attention)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--attention)' }}>Trigger Siren / Hooter</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--attention-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Volume2 size={18} color="var(--attention)" />
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px', minHeight: '38px' }}>
            Fires 5-second audible horn pulse via relay to alert nearby depot personnel or deter theft.
          </p>
          <button
            onClick={() => initiateCommand('SirenHooter', 'Sound Alarm Hooter', 'Audible horn burst', false)}
            className="btn btn-secondary"
            disabled={loading}
            style={{ width: '100%', padding: '10px' }}
          >
            <Volume2 size={15} />
            <span>Sound 5s Alarm</span>
          </button>
        </div>

        {/* AC Power Cut */}
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>AC Compressor Cut</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="var(--accent)" />
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px', minHeight: '38px' }}>
            Toggles cabin AC relay cut to control excessive idling fuel wastage in stationary lots.
          </p>
          <button
            onClick={() => initiateCommand('IAcOff', 'Disable AC Compressor', 'Shuts off auxiliary AC line', false)}
            className="btn btn-secondary"
            disabled={loading}
            style={{ width: '100%', padding: '10px' }}
          >
            <Lock size={15} />
            <span>Cut AC Relay</span>
          </button>
        </div>
      </div>

      {/* Command Transmission Audit Logs */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--accent)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Telemetry Command Audit Trail</h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Live Teltonika Gateway Link</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle Plate</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Command Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Binary Payload</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Operator</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Dispatched Time</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Protocol Status</th>
            </tr>
          </thead>
          <tbody>
            {logsLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading command audit trail...
                </td>
              </tr>
            ) : commandLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No commands transmitted in recent session.
                </td>
              </tr>
            ) : (
              commandLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Car size={15} color="var(--accent)" />
                      <span>{log.vehicleReg}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: log.commandType.includes('Off') ? '#DC2626' : 'var(--text-primary)' }}>
                      {log.commandType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {log.commandStr}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {log.sentBy}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {log.sentAt}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: 'var(--good-bg)',
                        color: 'var(--good)',
                        border: '1px solid var(--good-border)',
                      }}
                    >
                      <ShieldCheck size={12} />
                      <span>{log.status}</span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Security PIN Authorization Modal */}
      {isPinModalOpen && pendingAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={20} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Authorization Required</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Security PIN Verification</span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              You are about to execute <strong>{pendingAction.title}</strong> on unit <strong>{vehicleList.find(v => String(v.device_id) === String(selectedVehicleId))?.reg_number || `Unit ${selectedVehicleId}`}</strong>. Please enter your 4-digit security PIN to confirm authorization.
            </p>

            <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <input
                  type="password"
                  placeholder="Enter 4-digit PIN (default: 1234)"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  autoFocus
                  maxLength={6}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: pinError ? '1px solid #DC2626' : '1px solid var(--border)',
                    fontSize: '1.1rem',
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                  }}
                />
                {pinError && (
                  <span style={{ fontSize: '0.8rem', color: '#DC2626', marginTop: '6px', display: 'block' }}>
                    {pinError}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={loading}
                  style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
                >
                  {loading ? 'Transmitting...' : 'Authorize & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanelPage;
