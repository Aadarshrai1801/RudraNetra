import React, { useState, useEffect } from 'react';
import { 
  Bell, Calendar, Plus, X, CheckCircle2, AlertTriangle, Clock, 
  ShieldCheck, Filter, Car, Trash2
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface Reminder {
  id: number;
  vehicleId: number;
  vehicleReg: string;
  reminderType: string;
  dueDate: string;
  dueKm: number;
  alertBeforeDays: number;
  alertBeforeKm: number;
  notes: string;
  isAcknowledged: boolean;
  status: 'Valid' | 'Due Soon' | 'Expired';
  daysRemaining: number;
}

export const RemindersPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newReminder, setNewReminder] = useState({
    vehicleId: '',
    reminderType: 'Insurance Policy Renewal',
    dueDate: '',
    dueKm: 0,
    alertBeforeDays: 15,
    notes: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadReminders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/reminders');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setReminders(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [user?.company_id]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminder.vehicleId || !newReminder.dueDate) {
      showToast('Please select a vehicle and due date');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/v1/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: Number(newReminder.vehicleId),
          reminderType: newReminder.reminderType,
          dueDate: newReminder.dueDate,
          dueKm: Number(newReminder.dueKm) || 0,
          alertBeforeDays: Number(newReminder.alertBeforeDays) || 15,
          notes: newReminder.notes,
        }),
      });

      if (res.ok) {
        showToast('Compliance reminder scheduled successfully');
        setIsModalOpen(false);
        setNewReminder({
          vehicleId: '',
          reminderType: 'Insurance Policy Renewal',
          dueDate: '',
          dueKm: 0,
          alertBeforeDays: 15,
          notes: '',
        });
        loadReminders();
      }
    } catch (err) {
      showToast('Error scheduling reminder');
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/v1/reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAcknowledged: true }),
      });
      if (res.ok) {
        showToast('Reminder acknowledged');
        loadReminders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/v1/reminders/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Reminder removed');
        loadReminders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (filterType !== 'all' && !r.reminderType.toLowerCase().includes(filterType.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && r.status.toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }
    return true;
  });

  const expiredCount = reminders.filter((r) => r.status === 'Expired').length;
  const dueSoonCount = reminders.filter((r) => r.status === 'Due Soon').length;
  const validCount = reminders.filter((r) => r.status === 'Valid').length;

  return (
    <div className="page-container" style={{ maxWidth: '1180px' }}>
      {/* Toast Notification */}
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
            <Bell size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Document Master
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Automated alerts for Insurance, RTA Fitness Inspection, Mulkiya Registration, Oil Change, Road Tax & Permits.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Schedule Reminder</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color="#DC2626" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Expired / Overdue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626' }}>{expiredCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--attention-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} color="var(--attention)" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Due Within 15 Days</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--attention)' }}>{dueSoonCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} color="var(--good)" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Fully Compliant</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--good)' }}>{validCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <Filter size={15} />
            <span>Filter Category:</span>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="all">All Reminder Types</option>
            <option value="insurance">Insurance Renewal</option>
            <option value="fitness">RTA Fitness Inspection</option>
            <option value="service">Oil & Engine Service</option>
            <option value="puc">PUC Emission Certificate</option>
            <option value="permit">Hazmat / Road Permit</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="due soon">Due Soon</option>
            <option value="expired">Expired</option>
            <option value="valid">Valid</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Showing {filteredReminders.length} reminder records
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reminder Category</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Due Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Threshold</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Notes</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading fleet compliance schedule...
                </td>
              </tr>
            ) : filteredReminders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No reminders found matching your selected filters.
                </td>
              </tr>
            ) : (
              filteredReminders.map((rem) => {
                const isOverdue = rem.status === 'Expired';
                const isDueSoon = rem.status === 'Due Soon';

                return (
                  <tr key={rem.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Car size={16} color="var(--accent)" />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rem.vehicleReg}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 600 }}>{rem.reminderType}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="var(--text-tertiary)" />
                        <span>{rem.dueDate}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: isOverdue ? '#DC2626' : isDueSoon ? 'var(--attention)' : 'var(--text-tertiary)' }}>
                        {rem.daysRemaining < 0
                          ? `${Math.abs(rem.daysRemaining)} days overdue`
                          : rem.daysRemaining === 0
                          ? 'Expires Today'
                          : `${rem.daysRemaining} days left`}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {rem.alertBeforeDays} days prior {rem.dueKm > 0 ? `| ${rem.dueKm.toLocaleString()} KM` : ''}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: isOverdue ? '#FEE2E2' : isDueSoon ? 'var(--attention-bg)' : 'var(--good-bg)',
                          color: isOverdue ? '#DC2626' : isDueSoon ? 'var(--attention)' : 'var(--good)',
                          border: `1px solid ${isOverdue ? '#FCA5A5' : isDueSoon ? 'var(--attention-border)' : 'var(--good-border)'}`,
                        }}
                      >
                        {rem.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '200px' }}>
                      {rem.notes || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {!rem.isAcknowledged && (
                          <button
                            onClick={() => handleAcknowledge(rem.id)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            title="Acknowledge alert"
                          >
                            <CheckCircle2 size={13} color="var(--good)" />
                            <span>Ack</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(rem.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Delete reminder"
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

      {/* Schedule Reminder Modal */}
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
                <Bell size={20} color="var(--accent)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Schedule Compliance Reminder</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleCreateReminder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Target Vehicle <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={newReminder.vehicleId}
                  onChange={(e) => setNewReminder({ ...newReminder, vehicleId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  required
                >
                  <option value="">Select vehicle plate...</option>
                  {vehicleList.length > 0 ? (
                    vehicleList.map((v) => (
                      <option key={v.device_id} value={v.device_id}>
                        {v.reg_number || v.name || v.device_id} ({v.status})
                      </option>
                    ))
                  ) : null}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Reminder Category <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={newReminder.reminderType}
                  onChange={(e) => setNewReminder({ ...newReminder, reminderType: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                >
                  <option value="Insurance Policy Renewal">Insurance Policy Renewal</option>
                  <option value="RTA Vehicle Fitness Inspection">RTA Vehicle Fitness Inspection</option>
                  <option value="PUC Emission Certificate">PUC Emission Certificate</option>
                  <option value="Engine Oil & Filter Service">Engine Oil & Filter Service</option>
                  <option value="Road Tax & Registration (Mulkiya)">Road Tax & Registration (Mulkiya)</option>
                  <option value="Civil Defence Hazmat Permit">Civil Defence Hazmat Permit</option>
                  <option value="Driver Commercial License Renewal">Driver Commercial License Renewal</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Due Expiry Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={newReminder.dueDate}
                    onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Alert Before (Days)
                  </label>
                  <input
                    type="number"
                    value={newReminder.alertBeforeDays}
                    onChange={(e) => setNewReminder({ ...newReminder, alertBeforeDays: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    min="1"
                    max="90"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Target Odometer KM (Optional for Oil Changes)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 85000"
                  value={newReminder.dueKm || ''}
                  onChange={(e) => setNewReminder({ ...newReminder, dueKm: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Policy # / Inspection Center / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Policy #OM-99201 with Oman Insurance. Contact agent +971 4 2300000."
                  value={newReminder.notes}
                  onChange={(e) => setNewReminder({ ...newReminder, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemindersPage;
