import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Building2, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../store/authStore';
import { useVehicleStore } from '../../store/vehicleStore';

export interface UserNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const defaultNotifications: UserNotification[] = [
  {
    id: 1,
    title: 'Vehicle on route',
    message: '95321 left the yard and is heading along the DWC Logistics Corridor.',
    time: '12:42 pm',
    read: false,
  },
  {
    id: 2,
    title: 'Zone departure',
    message: '84707 departed the Jebel Ali Free Zone Port area.',
    time: '12:35 pm',
    read: false,
  },
  {
    id: 3,
    title: 'Engine idle reminder',
    message: '82561 has been waiting with engine running for 25 minutes at New Batha Corridor.',
    time: '12:15 pm',
    read: true,
  },
];

export const Header: React.FC = () => {
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const clearVehicles = useVehicleStore((state) => state.clearVehicles);

  const companyName = user?.company_name || (user?.company_id === 2 ? 'EKSC Logistics Dubai' : 'Allied Transport UAE');
  const userDisplayName = user?.full_name || user?.username || 'Fleet Operator';
  const userRole = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Admin';
  const userInitials = userDisplayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'OP';

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
  const [notifications, setNotifications] = useState<UserNotification[]>(() => {
    const saved = localStorage.getItem('rudra_user_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.warn('Failed to parse saved notifications from localStorage', err);
      }
    }
    return defaultNotifications;
  });

  useEffect(() => {
    localStorage.setItem('rudra_user_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markItemRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <header className="header">
      {/* Search Bar with Plain Words */}
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
            placeholder="Search by vehicle name or driver"
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

      {/* Right Side: Calm Status (Only if reconnecting), Notifications, and User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* Calm reconnecting notice — only shown if disconnected, never alarming red */}
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
            <span>Reconnecting to your fleet…</span>
          </div>
        )}

        {/* Notifications Icon with Flyout */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            style={{
              width: '42px',
              height: '42px',
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
            <Bell size={18} color="var(--text-secondary)" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '9px',
                  right: '9px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent)',
                }}
              />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: '0',
                width: '360px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-page)',
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Notifications
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {unreadCount > 0 ? `${unreadCount} new updates` : 'All caught up'}
                  </p>
                </div>
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

              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markItemRead(item.id)}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: item.read ? 'transparent' : 'var(--accent-light)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: '0.775rem', color: 'var(--text-tertiary)' }}>
                        {item.time}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

        {/* Organization Tenant Button with Equal Spacing */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'var(--bg-page)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Building2 size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {companyName}
          </span>
        </div>

        {/* User Profile / Admin Button with Exit button appearing on clicking Admin */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="User account menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: isUserMenuOpen ? 'var(--bg-hover)' : 'transparent',
              border: '1px solid',
              borderColor: isUserMenuOpen ? 'var(--border)' : 'transparent',
              borderRadius: 'var(--radius-md)',
              padding: '4px 8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-light)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {userInitials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {userDisplayName}
              </span>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                {userRole}
              </span>
            </div>
            <ChevronDown
              size={14}
              color="var(--text-secondary)"
              style={{
                transform: isUserMenuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
                marginLeft: '2px',
              }}
            />
          </button>

          {/* Exit button appears ONLY on clicking Admin */}
          {isUserMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: '0',
                width: '170px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleLogout();
                }}
                title="Sign out of organization"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.22)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#dc2626',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.22)';
                }}
              >
                <LogOut size={14} />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
