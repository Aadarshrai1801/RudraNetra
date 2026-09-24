import React from 'react';
import { Wifi, WifiOff, Bell, User, Search } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

export const Header: React.FC = () => {
  const { isConnected } = useWebSocket();

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: '480px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search vehicles, IMEI, drivers, or geofences..."
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px 12px 8px 36px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* Real-time telemetry connection badge */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {isConnected ? (
            <>
              <Wifi size={14} color="#10b981" />
              <span style={{ color: '#10b981' }}>Telemetry Stream Live</span>
            </>
          ) : (
            <>
              <WifiOff size={14} color="#ef4444" />
              <span style={{ color: '#ef4444' }}>Reconnecting...</span>
            </>
          )}
        </div>

        <button
          className="btn-ghost"
          style={{
            padding: '8px',
            borderRadius: '8px',
            position: 'relative',
            cursor: 'pointer',
          }}
          title="Notifications"
        >
          <Bell size={18} />
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: 'var(--cyan-accent)',
            }}
          />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'rgba(2, 132, 199, 0.25)',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fleet Admin</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VAVE Logistics</div>
          </div>
        </div>
      </div>
    </header>
  );
};
