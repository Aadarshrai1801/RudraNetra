import React, { useState, useEffect } from 'react';
import { 
  Share2, Plus, X, Copy, CheckCircle2, Clock, 
  Trash2
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface TempUser {
  id: number;
  guestName: string;
  shareLink: string;
  accessToken: string;
  vehicleIds: string[];
  expiresAt: string;
  createdAt: string;
  status: 'Active' | 'Expired';
}

export const GuestAccessPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [tempUsers, setTempUsers] = useState<TempUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newGuest, setNewGuest] = useState({
    guestName: '',
    durationHours: 24,
    selectedVehicles: [] as string[],
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadTempUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/temp-users');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTempUsers(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load temporary user links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTempUsers();
  }, [user?.company_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuest.guestName) {
      showToast('Please enter a recipient name or company');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/v1/temp-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: newGuest.guestName,
          durationHours: Number(newGuest.durationHours) || 24,
          vehicleIds: newGuest.selectedVehicles.length > 0 ? newGuest.selectedVehicles : ['ALL'],
        }),
      });

      if (res.ok) {
        showToast('Guest tracking link generated');
        setIsModalOpen(false);
        setNewGuest({
          guestName: '',
          durationHours: 24,
          selectedVehicles: [],
        });
        loadTempUsers();
      }
    } catch (err) {
      showToast('Failed to generate tracking link');
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/v1/temp-users/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Guest link revoked immediately');
        loadTempUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (link: string) => {
    const fullUrl = `${window.location.origin}${link}`;
    navigator.clipboard.writeText(fullUrl);
    showToast('Secure tracking link copied to clipboard');
  };

  const toggleVehicleSelect = (plate: string) => {
    if (newGuest.selectedVehicles.includes(plate)) {
      setNewGuest({
        ...newGuest,
        selectedVehicles: newGuest.selectedVehicles.filter((p) => p !== plate),
      });
    } else {
      setNewGuest({
        ...newGuest,
        selectedVehicles: [...newGuest.selectedVehicles, plate],
      });
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1180px' }}>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 20px',
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
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Enable Feature
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Generate time-limited live tracking links for clients, cargo consignees, brokers, and external auditors without creating permanent user logins.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Create Guest Share Link</span>
        </button>
      </div>

      {/* Links List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Recipient / Client</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Allowed Vehicles</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Generated Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Expires At</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading guest access tokens...
                </td>
              </tr>
            ) : tempUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No active temporary guest share links.
                </td>
              </tr>
            ) : (
              tempUsers.map((u) => {
                const isExpired = u.status === 'Expired';

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.guestName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                        Token: {u.accessToken}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {u.vehicleIds.map((v, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-subtle)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {v.replace(/['"]+/g, '')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {u.createdAt}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} color={isExpired ? '#DC2626' : 'var(--accent)'} />
                        <span style={{ fontWeight: 600, color: isExpired ? '#DC2626' : 'var(--text-primary)' }}>
                          {u.expiresAt}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          background: isExpired ? '#FEE2E2' : 'var(--good-bg)',
                          color: isExpired ? '#DC2626' : 'var(--good)',
                        }}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {!isExpired && (
                          <button
                            onClick={() => copyToClipboard(u.shareLink)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', gap: '5px' }}
                            title="Copy link to clipboard"
                          >
                            <Copy size={13} />
                            <span>Copy Link</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleRevoke(u.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Revoke access"
                        >
                          <Trash2 size={15} />
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

      {/* Create Link Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={20} color="var(--accent)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Generate Guest Tracking Link</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Client / Consignee / Auditor Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Emirates Logistics Cargo Receiving"
                  value={newGuest.guestName}
                  onChange={(e) => setNewGuest({ ...newGuest, guestName: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Access Duration Validity
                </label>
                <select
                  value={newGuest.durationHours}
                  onChange={(e) => setNewGuest({ ...newGuest, durationHours: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                >
                  <option value={2}>2 Hours (Single delivery trip)</option>
                  <option value={6}>6 Hours (Half day dispatch)</option>
                  <option value={24}>24 Hours (Full day tracking)</option>
                  <option value={72}>3 Days (Long haul transit)</option>
                  <option value={168}>7 Days (Weekly lease)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Select Permitted Vehicles (Leave blank for all fleet)
                </label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                  {vehicleList.map((v) => {
                    const plate = v.reg_number || String(v.device_id);
                    return (
                      <label key={v.device_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.88rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newGuest.selectedVehicles.includes(plate)}
                          onChange={() => toggleVehicleSelect(plate)}
                        />
                        <span>{plate} {v.name ? `· ${v.name}` : ''}</span>
                      </label>
                    );
                  })}
                  {vehicleList.length === 0 && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', padding: '8px 0' }}>
                      Loading fleet vehicles...
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate Secure Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestAccessPage;
