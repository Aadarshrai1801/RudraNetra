import React, { useState, useEffect } from 'react';
import { 
  Milestone, Plus, X, CheckCircle2
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface TollData {
  id: number;
  tollName: string;
  systemType: string;
  rateStandard: number;
  latitude: number;
  longitude: number;
  city: string;
  status: string;
}

export const TollMasterPage: React.FC = () => {
  const [tolls, setTolls] = useState<TollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    tollName: '',
    systemType: 'RTA Salik',
    rateStandard: 4.0,
    latitude: 25.2048,
    longitude: 55.2708,
    city: 'Dubai',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadTolls = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/toll-data');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTolls(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTolls();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/toll-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        showToast('Toll plaza checkpoint mapped in geofence engine');
        setIsModalOpen(false);
        loadTolls();
      }
    } catch (err) {
      showToast('Failed to save toll plaza');
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Milestone size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Toll Plaza & Salik Gate Master
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Coordinate database for Salik, Abu Dhabi Darb, and highway toll checkpoints for automated trip toll expense deduction.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Add Toll Gate</span>
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Toll Gate Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>System Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Standard Charge</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>GPS Latitude</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>GPS Longitude</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Emirate / City</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Loading toll gates...
                </td>
              </tr>
            ) : tolls.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No toll plazas registered.
                </td>
              </tr>
            ) : (
              tolls.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t.tollName}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', fontSize: '0.78rem', fontWeight: 600 }}>
                      {t.systemType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                    AED {t.rateStandard.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {t.latitude}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {t.longitude}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {t.city}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: '0.76rem', fontWeight: 700 }}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add Toll Plaza Gate</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Toll Plaza Name</label>
                <input type="text" placeholder="e.g. Al Barsha Toll Gate" value={form.tollName} onChange={(e) => setForm({ ...form, tollName: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>System</label>
                  <select value={form.systemType} onChange={(e) => setForm({ ...form, systemType: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="RTA Salik">RTA Salik</option>
                    <option value="Abu Dhabi Darb">Abu Dhabi Darb</option>
                    <option value="NHAI FASTag">NHAI FASTag</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Rate (AED)</label>
                  <input type="number" step="0.5" value={form.rateStandard} onChange={(e) => setForm({ ...form, rateStandard: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Latitude</label>
                  <input type="number" step="0.0001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Longitude</label>
                  <input type="number" step="0.0001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>City / Emirate</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Plaza</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TollMasterPage;
