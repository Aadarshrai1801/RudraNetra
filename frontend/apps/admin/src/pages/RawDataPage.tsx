import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Search, Terminal
} from 'lucide-react';
import { fetchWithAdminAuth } from '../utils/api';

interface RawPacket {
  id: number;
  imei: string;
  protocol: string;
  length: number;
  hexPacket: string;
  decodedAt: string;
  sourceIp: string;
  status: string;
}

export const RawDataPage: React.FC = () => {
  const [packets, setPackets] = useState<RawPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadPackets = async () => {
    try {
      const res = await fetchWithAdminAuth('/api/v1/admin/raw-data');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPackets(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackets();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadPackets();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredPackets = packets.filter(
    (p) => p.imei.includes(search) || p.hexPacket.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Raw Socket Packet Hex Inspector
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Live hardware socket telemetry sniffer (TCP/5040 Teltonika Codec 8 / 8 Extended & TCP/5023 Concox).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto Refresh (5s)</span>
          </label>
          <button onClick={loadPackets} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} />
            <span>Poll Now</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', minWidth: '320px' }}>
          <Search size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by Tracker IMEI or Hex payload substring..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.88rem' }}
          />
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
          Active Socket Daemon: <strong>0.0.0.0:5040</strong> • Ingestion Engine: Online
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Packet ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tracker IMEI</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Protocol</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Bytes</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Raw Hex Binary Stream</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Source Socket</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Decoded Time</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Listening on raw ingestion telemetry sockets...
                </td>
              </tr>
            ) : filteredPackets.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No packet frames intercepted matching criteria.
                </td>
              </tr>
            ) : (
              filteredPackets.map((pkt) => (
                <tr key={pkt.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                    #{pkt.id}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)' }}>
                    {pkt.imei}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', fontWeight: 600 }}>
                      {pkt.protocol}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {pkt.length} B
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '340px', wordBreak: 'break-all' }}>
                    {pkt.hexPacket}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {pkt.sourceIp}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {pkt.decodedAt}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: '0.74rem', fontWeight: 700 }}>
                      {pkt.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RawDataPage;
