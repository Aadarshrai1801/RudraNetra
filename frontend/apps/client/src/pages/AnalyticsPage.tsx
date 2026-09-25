import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Gauge, Fuel, Clock, ShieldAlert,
  Car, ArrowUpRight
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface AnalyticsData {
  fleetOccupancyPct: number;
  activeVehicles: number;
  idleVehicles: number;
  stoppedVehicles: number;
  runningVehicles: number;
  avgDistancePerDay: number;
  totalFleetKmToday: number;
  fuelEfficiencyKmpl: number;
  totalFuelBurnedLtr: number;
  carbonEmissionsKg: number;
  utilizationTrend: Array<{ day: string; occupancy: number; km: number }>;
  engineStatusRatio: { running: number; idle: number; stopped: number };
  topSpeedViolators: Array<{ vehicle: string; driver: string; topSpeed: number; count: number }>;
}

export const AnalyticsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth('/api/v1/dashboard/analytics');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setData(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user?.company_id]);

  if (loading || !data) {
    return (
      <div className="page-container" style={{ maxWidth: '1180px', textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Calculating fleet utilization & fuel telemetry metrics...</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1180px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={24} color="var(--accent)" />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Fleet Analytics & Utilization
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
          Real-time fleet occupancy percentage, engine run-to-idle ratios, fuel efficiency, and speed compliance.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Fleet Occupancy</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="var(--good)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {data.fleetOccupancyPct}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--good)', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ArrowUpRight size={13} />
            <span>+4.2% vs last week</span>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Distance Today</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gauge size={16} color="var(--accent)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {data.totalFleetKmToday.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>KM</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Avg {data.avgDistancePerDay} KM per unit
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Fuel Economy</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--attention-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Fuel size={16} color="var(--attention)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {data.fuelEfficiencyKmpl} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>KM/L</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {data.totalFuelBurnedLtr} Litres consumed
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Active Fleet Units</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={16} color="var(--text-secondary)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {data.activeVehicles} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--good)' }}>Online</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {data.idleVehicles} Idling • {data.stoppedVehicles} Parked
          </div>
        </div>
      </div>

      {/* Utilization Trend & Engine Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Utilization Bar Trend */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Weekly Utilization & Distance Run</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            Daily fleet occupancy percentage across all active units
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
            {data.utilizationTrend.map((d) => (
              <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>{d.occupancy}%</div>
                <div
                  style={{
                    width: '32px',
                    height: `${(d.occupancy / 100) * 120}px`,
                    background: 'var(--accent)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.3s ease',
                  }}
                  title={`${d.day}: ${d.km} KM`}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{d.day}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Target Occupancy: 80%</span>
            <span>Green driving threshold: Active</span>
          </div>
        </div>

        {/* Engine Status Breakdown */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Engine Time Distribution</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            Run vs Idle vs Parked ratios
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--good)' }}>Running & In-Transit</span>
                <span style={{ fontWeight: 700 }}>{data.engineStatusRatio.running}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${data.engineStatusRatio.running}%`, height: '100%', background: 'var(--good)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--attention)' }}>Stationary Idling (Engine ON)</span>
                <span style={{ fontWeight: 700 }}>{data.engineStatusRatio.idle}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${data.engineStatusRatio.idle}%`, height: '100%', background: 'var(--attention)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>Parked & Stopped</span>
                <span style={{ fontWeight: 700 }}>{data.engineStatusRatio.stopped}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${data.engineStatusRatio.stopped}%`, height: '100%', background: 'var(--text-tertiary)' }} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '12px', background: 'var(--attention-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--attention-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--attention)' }}>
              <Clock size={14} />
              <span>Idling Fuel Alert</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Excessive idling (&gt;15 min) accounts for ~84L wasted diesel this week.
            </p>
          </div>
        </div>
      </div>

      {/* Top Speed Violators */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#DC2626" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Top Overspeed Violations (Last 7 Days)</h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle Plate</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Driver</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Peak Recorded Speed</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Instances Count</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Risk Severity</th>
            </tr>
          </thead>
          <tbody>
            {data.topSpeedViolators.map((violator, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{violator.vehicle}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{violator.driver}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: 800, color: '#DC2626' }}>{violator.topSpeed} km/h</span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{violator.count} times</td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: '#FEE2E2',
                      color: '#DC2626',
                    }}
                  >
                    High Risk
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalyticsPage;
