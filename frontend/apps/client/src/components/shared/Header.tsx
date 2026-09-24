import React, { useState, useEffect } from 'react';
import { Search, Bell } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

export const Header: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [timeStr, setTimeStr] = useState<string>('');

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

        {/* Action Button: Alerts Notification */}
        <button
          className="btn-ghost"
          style={{
            padding: '4px 6px',
            position: 'relative',
            cursor: 'pointer',
            border: 'none',
          }}
          title="System Alerts"
        >
          <Bell size={15} color="var(--text-muted)" />
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '5px',
              height: '5px',
              backgroundColor: 'var(--signal-amber)',
            }}
          />
        </button>

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
