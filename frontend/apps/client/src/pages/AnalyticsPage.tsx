import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Gauge, Fuel, Clock, ShieldAlert,
  Car
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface UtilizationPoint {
  day?: string | null;
  occupancy?: number | null;
  km?: number | null;
}

interface SpeedViolator {
  vehicle?: string | null;
  driver?: string | null;
  topSpeed?: number | null;
  count?: number | null;
}

interface AnalyticsData {
  fleetOccupancyPct?: number | null;
  activeVehicles?: number | null;
  idleVehicles?: number | null;
  stoppedVehicles?: number | null;
  runningVehicles?: number | null;
  avgDistancePerDay?: number | null;
  totalFleetKmToday?: number | null;
  totalKm31Days?: number | null;
  fuelEfficiencyKmpl?: number | null;
  totalFuelBurnedLtr?: number | null;
  totalFuelCost?: number | null;
  carbonEmissionsKg?: number | null;
  utilizationTrend?: UtilizationPoint[] | null;
  engineStatusRatio?: { running?: number | null; idle?: number | null; stopped?: number | null } | null;
  topSpeedViolators?: SpeedViolator[] | null;
}

const isNumber = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(Number(value));

const formatNumber = (value: number | null | undefined, digits = 0): string => {
  if (!isNumber(value)) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const AnalyticsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetchWithAuth('/api/v1/dashboard/analytics');
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const json = await res.json();
        if (!json.success || !json.data) throw new Error(json.error || 'Invalid analytics payload');
        setData(json.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setData(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user?.company_id]);

  if (loading) {
    return (
      <div className="page-container" style={{ maxWidth: '1180px', textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Calculating fleet utilization & fuel telemetry metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container" style={{ maxWidth: '1180px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Fleet Analytics & Utilization
            </h1>
          </div>
        </div>
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Analytics data is unavailable for this organization.
        </div>
      </div>
    );
  }

  const trend = data.utilizationTrend ?? [];
  const violators = data.topSpeedViolators ?? [];
  const ratio = data.engineStatusRatio;
  const ratioTotal = ratio
    ? (ratio.running ?? 0) + (ratio.idle ?? 0) + (ratio.stopped ?? 0)
    : 0;
  const ratioPct = (value: number | null | undefined): number | null =>
    ratioTotal > 0 ? ((value ?? 0) / ratioTotal) * 100 : null;

  const hasFuelRecords = isNumber(data.totalFuelBurnedLtr) && data.totalFuelBurnedLtr > 0;

  const occupancySub = [
    isNumber(data.runningVehicles) ? `${formatNumber(data.runningVehicles)} running` : null,
    isNumber(data.idleVehicles) ? `${formatNumber(data.idleVehicles)} idling` : null,
    isNumber(data.stoppedVehicles) ? `${formatNumber(data.stoppedVehicles)} stopped` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const distanceSub = [
    isNumber(data.avgDistancePerDay) ? `Avg ${formatNumber(data.avgDistancePerDay, 1)} KM/day` : null,
    isNumber(data.totalKm31Days) ? `${formatNumber(data.totalKm31Days)} KM in 31 days` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const activeFleetSub = [
    isNumber(data.idleVehicles) ? `${formatNumber(data.idleVehicles)} Idling` : null,
    isNumber(data.stoppedVehicles) ? `${formatNumber(data.stoppedVehicles)} Parked` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const emissionsSub = [
    isNumber(data.totalFuelBurnedLtr) ? `${formatNumber(data.totalFuelBurnedLtr)} L burned` : null,
    isNumber(data.totalFuelCost) ? `Fuel cost ${formatNumber(data.totalFuelCost, 2)}` : null,
    isNumber(data.carbonEmissionsKg) ? `${formatNumber(data.carbonEmissionsKg, 1)} kg CO₂` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
            {isNumber(data.fleetOccupancyPct) ? `${formatNumber(data.fleetOccupancyPct, 1)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {occupancySub || '—'}
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
            {isNumber(data.totalFleetKmToday) ? formatNumber(data.totalFleetKmToday, 0) : '—'}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>KM</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {distanceSub || '—'}
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
            {hasFuelRecords && isNumber(data.fuelEfficiencyKmpl) ? formatNumber(data.fuelEfficiencyKmpl, 1) : '—'}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>KM/L</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {isNumber(data.totalFuelBurnedLtr)
              ? `${formatNumber(data.totalFuelBurnedLtr)} Litres consumed (31 days)`
              : 'No fuel records'}
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
            {isNumber(data.activeVehicles) ? formatNumber(data.activeVehicles) : '—'}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--good)' }}>Online</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {activeFleetSub || '—'}
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

          {trend.length === 0 ? (
            <div
              style={{
                height: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              No utilization trend data available.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              {trend.map((point, idx) => {
                const hasOccupancy = isNumber(point.occupancy);
                const barPct = hasOccupancy ? Math.max(0, Math.min(100, Number(point.occupancy))) : 0;
                return (
                  <div key={`${point.day ?? 'day'}-${idx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                      {hasOccupancy ? `${formatNumber(point.occupancy, 0)}%` : '—'}
                    </div>
                    <div
                      style={{
                        width: '32px',
                        height: `${(barPct / 100) * 120}px`,
                        background: 'var(--accent)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'all 0.3s ease',
                      }}
                      title={point.day ? `${point.day}: ${isNumber(point.km) ? `${formatNumber(point.km)} KM` : '—'}` : undefined}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{point.day || '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Engine Status Breakdown */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Engine Time Distribution</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            Run vs Idle vs Parked ratios
          </p>

          {!ratio || ratioTotal === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No engine status data available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--good)' }}>Running & In-Transit</span>
                  <span style={{ fontWeight: 700 }}>{formatNumber(ratioPct(ratio.running), 1)}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${ratioPct(ratio.running) ?? 0}%`, height: '100%', background: 'var(--good)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--attention)' }}>Stationary Idling (Engine ON)</span>
                  <span style={{ fontWeight: 700 }}>{formatNumber(ratioPct(ratio.idle), 1)}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${ratioPct(ratio.idle) ?? 0}%`, height: '100%', background: 'var(--attention)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>Parked & Stopped</span>
                  <span style={{ fontWeight: 700 }}>{formatNumber(ratioPct(ratio.stopped), 1)}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${ratioPct(ratio.stopped) ?? 0}%`, height: '100%', background: 'var(--text-tertiary)' }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              <Clock size={14} />
              <span>Fuel & Emissions (31 Days)</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {emissionsSub || 'No fuel records available.'}
            </p>
          </div>
        </div>
      </div>

      {/* Top Speed Violators */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#DC2626" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Top Overspeed Violations (Last 31 Days)</h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle Plate</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Driver</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Peak Recorded Speed</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Instances Count</th>
            </tr>
          </thead>
          <tbody>
            {violators.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No overspeed violations recorded.
                </td>
              </tr>
            ) : (
              violators.map((violator, idx) => (
                <tr key={`${violator.vehicle ?? 'vehicle'}-${idx}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{violator.vehicle || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{violator.driver || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 800, color: '#DC2626' }}>
                      {isNumber(violator.topSpeed) ? `${formatNumber(violator.topSpeed, 1)} km/h` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {isNumber(violator.count) ? `${formatNumber(violator.count)} times` : '—'}
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

export default AnalyticsPage;
