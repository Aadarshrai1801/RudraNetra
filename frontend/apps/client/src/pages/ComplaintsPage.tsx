import React, { useState, useEffect } from 'react';
import { 
  LifeBuoy, Plus, X, CheckCircle2, 
  User, Car, Filter
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface Complaint {
  id: number;
  ticketNo: string;
  vehicleReg: string;
  title: string;
  category: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  technicianAssigned: string;
  resolutionNotes: string;
  createdAt: string;
}

export const ComplaintsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newTicket, setNewTicket] = useState({
    vehicleId: '',
    title: '',
    category: 'GPS Tracker Offline',
    priority: 'Medium',
    description: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/complaints');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setComplaints(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [user?.company_id]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title) {
      showToast('Please provide a ticket title');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/v1/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: Number(newTicket.vehicleId) || 0,
          title: newTicket.title,
          category: newTicket.category,
          priority: newTicket.priority,
        }),
      });

      if (res.ok) {
        showToast('Support ticket registered. Technician assigned within 4 hours.');
        setIsModalOpen(false);
        setNewTicket({
          vehicleId: '',
          title: '',
          category: 'GPS Tracker Offline',
          priority: 'Medium',
          description: '',
        });
        loadComplaints();
      }
    } catch (err) {
      showToast('Failed to submit ticket');
    }
  };

  const filteredTickets = complaints.filter((t) => {
    if (filterCategory !== 'all' && !t.category.toLowerCase().includes(filterCategory.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && t.status.toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }
    return true;
  });

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
            <LifeBuoy size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Hardware Support & Complaints Register
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Track device maintenance, offline GPS diagnostics, sensor calibrations, and field technician dispatch.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Log Support Ticket</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <Filter size={15} />
            <span>Category:</span>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="all">All Issue Categories</option>
            <option value="offline">GPS Tracker Offline</option>
            <option value="relay">Relay / Immobilizer Issue</option>
            <option value="fuel">Fuel Sensor</option>
            <option value="temp">Temperature Probe</option>
            <option value="sira">SIRA Certificate Renewal</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Showing {filteredTickets.length} active tickets
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ticket #</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle Plate</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Issue Title & Category</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Priority</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Technician Assigned</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading support tickets...
                </td>
              </tr>
            ) : filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No open complaints or support tickets found.
                </td>
              </tr>
            ) : (
              filteredTickets.map((tck) => (
                <tr key={tck.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>
                    {tck.ticketNo}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Car size={15} color="var(--text-secondary)" />
                      <span style={{ fontWeight: 600 }}>{tck.vehicleReg}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tck.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{tck.category} • {tck.createdAt}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: tck.priority === 'Critical' ? '#FEE2E2' : tck.priority === 'High' ? 'var(--attention-bg)' : 'var(--bg-subtle)',
                        color: tck.priority === 'Critical' ? '#DC2626' : tck.priority === 'High' ? 'var(--attention)' : 'var(--text-secondary)',
                      }}
                    >
                      {tck.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: tck.status === 'Resolved' ? 'var(--good-bg)' : tck.status === 'In Progress' ? 'var(--attention-bg)' : '#FEE2E2',
                        color: tck.status === 'Resolved' ? 'var(--good)' : tck.status === 'In Progress' ? 'var(--attention)' : '#DC2626',
                      }}
                    >
                      {tck.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} color="var(--text-tertiary)" />
                      <span>{tck.technicianAssigned}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '240px' }}>
                    {tck.resolutionNotes || 'Awaiting field inspection'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Log Ticket Modal */}
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
                <LifeBuoy size={20} color="var(--accent)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Log Hardware Support Ticket</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Target Vehicle (Optional if fleet wide)
                </label>
                <select
                  value={newTicket.vehicleId}
                  onChange={(e) => setNewTicket({ ...newTicket, vehicleId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                >
                  <option value="">Fleet Wide / General Question</option>
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
                  Issue Summary / Title <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Device not sending GPS updates since morning"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Issue Category
                  </label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  >
                    <option value="GPS Tracker Offline">GPS Tracker Offline</option>
                    <option value="Relay / Immobilizer Issue">Relay / Immobilizer Issue</option>
                    <option value="Fuel Sensor Calibration">Fuel Sensor Calibration</option>
                    <option value="Temperature Probe Error">Temperature Probe Error</option>
                    <option value="SIRA Certificate Inspection">SIRA Certificate Inspection</option>
                    <option value="SIM Card Deactivation">SIM Card Deactivation</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Priority Severity
                  </label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  >
                    <option value="Low">Low (General)</option>
                    <option value="Medium">Medium (Inspection)</option>
                    <option value="High">High (Fuel/Temp anomaly)</option>
                    <option value="Critical">Critical (Vehicle Stalled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Detailed Symptoms & Location of Vehicle
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide parking location, driver contact, or error message..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Dispatch Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsPage;
