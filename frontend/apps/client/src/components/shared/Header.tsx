import React, { useState, useEffect } from 'react';
import { Search, Bell } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

export interface SystemNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  severity: 'alert' | 'warn' | 'info';
  read: boolean;
}

export const Header: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [timeStr, setTimeStr] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([
    {
      id: 1,
      title: 'Overspeed Violation',
      message: 'DXB-A-98124 exceeded 80 km/h limit on Sheikh Zayed Rd (84.1 km/h).',
      time: '12:42:10',
      severity: 'alert',
      read: false,
    },
    {
      id: 2,
      title: 'Geofence Boundary Transit',
      message: 'AUH-C-11029 departed Jebel Ali Port & Freezone boundary.',
      time: '12:35:00',
      severity: 'warn',
      read: false,
    },
    {
      id: 3,
      title: 'Ingestion TCP Listener',
      message: 'Zero-alloc Teltonika Codec 8 parser synchronized on :5040.',
      time: '12:15:22',
      severity: 'info',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markItemRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-GB', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header">
      {/* Flush Inline Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '420px' }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Filter plate, IMEI, driver, or geofence..."
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid transparent',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
            padding: '4px 0',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => (e.target.style.borderBottom = '1px solid var(--line-strong)')}
          onBlur={(e) => (e.target.style.borderBottom = '1px solid transparent')}
        />
      </div>

      {/* Right System Telemetry Status & Operator Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Real System Status Line (Square dot + Monospace sync timestamp) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: isConnected ? 'var(--signal-green)' : 'var(--signal-red)',
              display: 'inline-block',
            }}
          />
          <span
            className="mono-num"
            style={{
              fontSize: '0.72rem',
              color: isConnected ? 'var(--text-muted)' : 'var(--signal-red)',
              letterSpacing: '0.02em',
            }}
          >
            {isConnected
              ? `SYS:SYNC ${timeStr || '11:45:00'} UTC+4 [TCP:5040 OK]`
              : `SYS:OFFLINE / RECONNECTING [PORT:5040]`}
          </span>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--line)' }} />

        {/* Action Button: Alerts Notification with Interactive Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn-ghost"
            style={{
              padding: '4px 6px',
              position: 'relative',
              cursor: 'pointer',
              border: 'none',
              background: showNotifications ? 'var(--bg-raised)' : 'transparent',
            }}
            title="System Alerts & Notifications"
          >
            <Bell size={15} color={unreadCount > 0 ? 'var(--signal-amber)' : 'var(--text-muted)'} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '6px',
                  height: '6px',
                  backgroundColor: 'var(--signal-amber)',
                  borderRadius: '0px',
                }}
              />
            )}
          </button>

          {/* Notification Center Flyout */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: '0',
                width: '360px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--line-strong)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Flyout Header */}
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-raised)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      background: 'var(--signal-amber)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    SYSTEM ALERTS ({unreadCount})
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--signal-amber)',
                      fontSize: '0.68rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No active alerts. All systems operational.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--line)',
                        background: n.read ? 'transparent' : 'rgba(232, 163, 61, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onClick={() => markItemRead(n.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: n.read ? 500 : 700,
                            color: n.severity === 'alert' ? 'var(--signal-red)' : n.severity === 'warn' ? 'var(--signal-amber)' : 'var(--text-primary)',
                          }}
                        >
                          {n.title}
                        </span>
                        <span className="mono-num" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {n.time}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Flyout Footer */}
              <div
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-raised)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <a
                  href="/alerts"
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--signal-amber)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                  onClick={() => setShowNotifications(false)}
                >
                  Configure Alert Rules →
                </a>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--line)' }} />

        {/* Dispatch Console Operator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            OP
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Dispatcher 01
            </div>
            <div
              className="mono-num"
              style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}
            >
              VAVE LOGISTICS UAE
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
