import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../store/authStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { fetchWithAuth } from '../../utils/api';

export interface UserNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface ApiAlert {
  id: number;
  type?: string;
  severity?: string;
  vehicle?: string;
  message?: string;
  time?: string;
  timestamp?: string;
  acknowledged?: boolean;
}

const formatAlertTime = (alert: ApiAlert): string => {
  if (typeof alert.time === 'string' && alert.time.trim()) return alert.time;
  if (alert.timestamp) {
    const dt = new Date(alert.timestamp);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
  return '—';
};

const toUserNotification = (alert: ApiAlert): UserNotification => ({
  id: alert.id,
  title: alert.type ? String(alert.type) : '—',
  message: alert.message ?? '—',
  time: formatAlertTime(alert),
  read: false,
});

export const Header: React.FC = () => {
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const clearVehicles = useVehicleStore((state) => state.clearVehicles);

  const companyName = user?.company_name || '—';
  const userDisplayName = user?.full_name || user?.username || '—';
  const userRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—';
  const userInitials = userDisplayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '—';

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    clearVehicles();
    navigate('/login');
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/alerts');
      if (!res.ok) return;
      const json = await res.json();
      const rows: ApiAlert[] = Array.isArray(json.data) ? json.data : [];
      setNotifications(
        rows
          .filter((alert) => !alert.acknowledged)
          .slice(0, 5)
          .map(toUserNotification)
      );
    } catch (err) {
      console.warn('Failed to load alerts', err);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const toggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      loadAlerts();
    }
  };

  const acknowledgeAlert = useCallback(async (id: number): Promise<boolean> => {
    try {
      const res = await fetchWithAuth(`/api/v1/alerts/${id}/acknowledge`, {
        method: 'PUT',
      });
      return res.ok;
    } catch (err) {
      console.warn('Failed to acknowledge alert', err);
      return false;
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/alerts/acknowledge-all', {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.warn('Failed to acknowledge alerts', err);
    }
  };

  const markItemRead = async (id: number) => {
    const acknowledged = await acknowledgeAlert(id);
    if (acknowledged) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <header className="header" style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '440px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            background: 'var(--bg-page)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            border: '1px solid var(--border)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search by vehicle plate or driver"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-family)',
            }}
          />
        </div>
      </div>

      {/* Right Side: Reconnect Notice, Notifications, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {!isConnected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'var(--attention-bg)',
              border: '1px solid var(--attention-border)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--attention)',
              fontSize: '0.825rem',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--attention)',
                display: 'inline-block',
              }}
            />
            <span>Reconnecting...</span>
          </div>
        )}

        {/* Notifications Icon with Flyout */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={toggleNotifications}
            aria-label="View notifications"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: showNotifications ? 'var(--bg-hover)' : 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            <Bell size={17} color="var(--text-secondary)" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent)',
                }}
              />
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '340px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Notifications ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: '20px 18px',
                      textAlign: 'center',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No unacknowledged alerts
                  </div>
                ) : (
                  notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markItemRead(item.id)}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: item.read ? 'transparent' : 'var(--bg-hover)',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontWeight: item.read ? 600 : 700,
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {item.title}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.time}</span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        margin: 0,
                      }}
                    >
                      {item.message}
                    </p>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile / Account Dropdown */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="User profile menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-md)',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: '2px solid var(--border-subtle)',
              }}
            >
              {userInitials}
            </div>
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {userDisplayName}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {companyName}
              </span>
            </div>
            <ChevronDown size={14} color="var(--text-tertiary)" />
          </button>

          {isUserMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '240px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)',
                padding: '8px',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{userDisplayName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user?.email || '—'}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>Role: {userRole}</div>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#DC2626',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LogOut size={15} />
                <span>Logout / Switch User</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
