import React, { useState, useEffect } from 'react';
import { 
  Plus, X, CheckCircle2, Truck, Navigation, Disc, Receipt, 
  MapPin, Users, FileText, ArrowRight
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVehicleStore } from '../store/vehicleStore';

interface GatePass {
  passNo: string;
  vehicle: string;
  driver: string;
  destination: string;
  issuedAt: string;
  status: 'In Transit' | 'Returned' | 'Issued';
}

interface LoadingReceipt {
  lrNo: string;
  party: string;
  vehicle: string;
  weightKg: number;
  freightAmt: number;
  advanceAmt: number;
  status: 'Completed' | 'Pending';
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  licenseNo: string;
  assignedVehicle: string;
  status: 'Active' | 'On Leave';
}

interface FleetTrip {
  id: number;
  tripNo: string;
  vehicleId: number;
  vehicleReg: string;
  driver1: string;
  driver2?: string;
  partyName: string;
  source: string;
  destination: string;
  plannedStart: string;
  plannedArrival: string;
  freightAmount: number;
  advanceAmount: number;
  expenseAmount: number;
  balanceAmount: number;
  status: 'Planned' | 'In Transit' | 'Delivered' | 'Settled';
}

interface TyreRecord {
  id: number;
  vehicleId: number;
  vehicleReg: string;
  tyreNumber: string;
  axlePosition: string;
  brand: string;
  model: string;
  size: string;
  treadDepthMm: number;
  plyRating: number;
  status: string;
  openingKm: number;
  currentKm: number;
  lifeKmLimit: number;
  retreadingCount: number;
  healthPct: number;
}

interface Voucher {
  id: number;
  tripId: number;
  tripNo: string;
  voucherType: string;
  amount: number;
  billNo: string;
  receiptUrl?: string;
  notes: string;
  date: string;
}

interface PartyRoute {
  id: number;
  partyName: string;
  source: string;
  destination: string;
  standardKm: number;
  standardRate: number;
  billingRate: number;
}

export const FleetPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [activeTab, setActiveTab] = useState<'trips' | 'gatepasses' | 'lr' | 'tyres' | 'vouchers' | 'partyroutes' | 'drivers'>('trips');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data states
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [lrs, setLRs] = useState<LoadingReceipt[]>([]);
  const [tyres, setTyres] = useState<TyreRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [partyRoutes, setPartyRoutes] = useState<PartyRoute[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Modals
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isTyreModalOpen, setIsTyreModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // Form states
  const [newTrip, setNewTrip] = useState({
    vehicleId: '',
    driver1Name: '',
    driver2Name: '',
    partyName: '',
    source: '',
    destination: '',
    freightAmount: 3000,
    advanceAmount: 1000,
  });

  const [newTyre, setNewTyre] = useState({
    vehicleId: '',
    tyreNumber: '',
    axlePosition: 'Front-Left (FL)',
    brand: 'Bridgestone',
    model: 'R150 Premium',
    size: '295/80 R22.5',
    treadDepthMm: 15.0,
    plyRating: 16,
    lifeKmLimit: 100000,
  });

  const [newVoucher, setNewVoucher] = useState({
    tripId: 1,
    voucherType: 'Fuel (Diesel)',
    amount: 350,
    billNo: '',
    notes: '',
  });


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [tripsRes, gpRes, lrRes, tyreRes, vchRes, prRes, drvRes] = await Promise.all([
        fetchWithAuth('/api/v1/fleet/trips'),
        fetchWithAuth('/api/v1/fleet/gate-passes'),
        fetchWithAuth('/api/v1/fleet/lr'),
        fetchWithAuth('/api/v1/fleet/tyres'),
        fetchWithAuth('/api/v1/fleet/vouchers'),
        fetchWithAuth('/api/v1/fleet/party-routes'),
        fetchWithAuth('/api/v1/drivers'),
      ]);

      if (tripsRes.ok) {
        const j = await tripsRes.json();
        if (j.success && Array.isArray(j.data)) setTrips(j.data);
      }
      if (gpRes.ok) {
        const j = await gpRes.json();
        if (j.success && Array.isArray(j.data)) setGatePasses(j.data);
      }
      if (lrRes.ok) {
        const j = await lrRes.json();
        if (j.success && Array.isArray(j.data)) setLRs(j.data);
      }
      if (tyreRes.ok) {
        const j = await tyreRes.json();
        if (j.success && Array.isArray(j.data)) setTyres(j.data);
      }
      if (vchRes.ok) {
        const j = await vchRes.json();
        if (j.success && Array.isArray(j.data)) setVouchers(j.data);
      }
      if (prRes.ok) {
        const j = await prRes.json();
        if (j.success && Array.isArray(j.data)) setPartyRoutes(j.data);
      }
      if (drvRes.ok) {
        const j = await drvRes.json();
        if (j.success && Array.isArray(j.data)) setDrivers(j.data);
      }
    } catch (err) {
      console.error('Failed to load fleet modules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/v1/fleet/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTrip,
          vehicleId: Number(newTrip.vehicleId) || 1,
        }),
      });
      if (res.ok) {
        showToast('Fleet trip created and dispatched');
        setIsTripModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast('Error dispatching trip');
    }
  };

  const handleCreateTyre = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/v1/fleet/tyres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTyre,
          vehicleId: Number(newTyre.vehicleId) || 1,
        }),
      });
      if (res.ok) {
        showToast('Tyre serial registered in asset registry');
        setIsTyreModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast('Error registering tyre');
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/v1/fleet/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVoucher),
      });
      if (res.ok) {
        showToast('Expense voucher added and balance updated');
        setIsVoucherModalOpen(false);
        loadData();
      }
    } catch (err) {
      showToast('Error submitting voucher');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1240px' }}>
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
            <Truck size={24} color="var(--accent)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Fleet Operations & Asset Management
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Dual-driver trip dispatching, tyre lifecycle management, en-route expense vouchers, and party contracts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'trips' && (
            <button onClick={() => setIsTripModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Dispatch New Trip</span>
            </button>
          )}
          {activeTab === 'tyres' && (
            <button onClick={() => setIsTyreModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Register Tyre Serial</span>
            </button>
          )}
          {activeTab === 'vouchers' && (
            <button onClick={() => setIsVoucherModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Record Trip Expense</span>
            </button>
          )}
        </div>
      </div>

      {loading && <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>Syncing fleet operations telemetry...</div>}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { key: 'trips', label: 'Fleet Trips', icon: Navigation, count: trips.length },
          { key: 'tyres', label: 'Tyre Management', icon: Disc, count: tyres.length },
          { key: 'vouchers', label: 'Trip Vouchers', icon: Receipt, count: vouchers.length },
          { key: 'partyroutes', label: 'Party Contracts', icon: MapPin, count: partyRoutes.length },
          { key: 'gatepasses', label: 'Gate Passes', icon: FileText, count: gatePasses.length },
          { key: 'lr', label: 'Loading Receipts', icon: FileText, count: lrs.length },
          { key: 'drivers', label: 'Drivers', icon: Users, count: drivers.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--accent-light)' : 'var(--bg-subtle)',
                  color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 1. FLEET TRIPS TAB */}
      {activeTab === 'trips' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Trip #</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle Plate</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Drivers</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Party & Route</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Financial Ledger</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>
                    {t.tripNo}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                    {t.vehicleReg}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{t.driver1}</div>
                    {t.driver2 && <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Co-driver: {t.driver2}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.partyName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{t.source}</span>
                      <ArrowRight size={11} />
                      <span>{t.destination}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>Freight:</strong> AED {t.freightAmount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      Adv: {t.advanceAmount} • Exp: {t.expenseAmount} • <strong>Bal: AED {t.balanceAmount}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: t.status === 'In Transit' ? 'var(--accent-light)' : t.status === 'Delivered' ? 'var(--good-bg)' : 'var(--bg-subtle)',
                        color: t.status === 'In Transit' ? 'var(--accent)' : t.status === 'Delivered' ? 'var(--good)' : 'var(--text-secondary)',
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. TYRE MANAGEMENT TAB */}
      {activeTab === 'tyres' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tyre Serial</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle & Axle</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Brand & Model</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tread Depth (mm)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Lifecycle Health</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Retread Count</th>
              </tr>
            </thead>
            <tbody>
              {tyres.map((ty) => (
                <tr key={ty.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>
                    {ty.tyreNumber}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700 }}>{ty.vehicleReg}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ty.axlePosition}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{ty.brand} {ty.model}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>{ty.size} • {ty.plyRating} PR</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, color: ty.treadDepthMm < 5 ? '#DC2626' : 'var(--text-primary)' }}>
                      {ty.treadDepthMm} mm
                    </span>
                    {ty.treadDepthMm < 5 && (
                      <span style={{ fontSize: '0.72rem', color: '#DC2626', display: 'block' }}>Replace / Retread</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                      <span>{ty.currentKm.toLocaleString()} / {ty.lifeKmLimit.toLocaleString()} KM</span>
                      <strong style={{ color: ty.healthPct < 30 ? '#DC2626' : 'var(--good)' }}>{ty.healthPct}%</strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${ty.healthPct}%`,
                          height: '100%',
                          background: ty.healthPct < 30 ? '#DC2626' : ty.healthPct < 60 ? 'var(--attention)' : 'var(--good)',
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {ty.retreadingCount} times
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. TRIP VOUCHERS TAB */}
      {activeTab === 'vouchers' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Trip Reference</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Expense Category</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Bill / Invoice #</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Notes</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>
                    {v.tripNo}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {v.voucherType}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    AED {v.amount.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {v.billNo || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {v.notes}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {v.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. PARTY CONTRACTS TAB */}
      {activeTab === 'partyroutes' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Party Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Origin Point</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Destination Hub</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Standard Distance</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Freight Billing Rate</th>
              </tr>
            </thead>
            <tbody>
              {partyRoutes.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.partyName}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {p.source}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {p.destination}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {p.standardKm} KM
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--good)' }}>
                    AED {p.billingRate.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. GATE PASSES TAB */}
      {activeTab === 'gatepasses' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Pass #</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vehicle</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Driver</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Destination</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Issued</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gatePasses.map((gp) => (
                <tr key={gp.passNo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>{gp.passNo}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{gp.vehicle}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{gp.driver}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{gp.destination}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{gp.issuedAt}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', fontWeight: 700, background: 'var(--good-bg)', color: 'var(--good)' }}>
                      {gp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. LOADING RECEIPTS TAB */}
      {activeTab === 'lr' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>LR #</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Consignor / Party</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Vehicle</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Weight</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Freight Total</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lrs.map((l) => (
                <tr key={l.lrNo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>{l.lrNo}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.party}</td>
                  <td style={{ padding: '12px 16px' }}>{l.vehicle}</td>
                  <td style={{ padding: '12px 16px' }}>{l.weightKg} kg</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>AED {l.freightAmt}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', fontWeight: 700, background: 'var(--good-bg)', color: 'var(--good)' }}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. DRIVERS TAB */}
      {activeTab === 'drivers' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Driver Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mobile Number</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>License #</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Vehicle</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Duty Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{d.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{d.phone}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{d.licenseNo}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.assignedVehicle}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', fontWeight: 700, background: 'var(--good-bg)', color: 'var(--good)' }}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DISPATCH TRIP MODAL */}
      {isTripModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Dispatch Fleet Trip</h3>
              <button onClick={() => setIsTripModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTrip} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Vehicle Plate</label>
                <select
                  value={newTrip.vehicleId}
                  onChange={(e) => setNewTrip({ ...newTrip, vehicleId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                  required
                >
                  <option value="">Select vehicle...</option>
                  {vehicleList.map((v) => <option key={v.device_id} value={v.device_id}>{v.reg_number || v.name || v.device_id}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Primary Driver</label>
                  <input type="text" placeholder="Driver 1" value={newTrip.driver1Name} onChange={(e) => setNewTrip({ ...newTrip, driver1Name: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Co-Driver (Optional)</label>
                  <input type="text" placeholder="Driver 2" value={newTrip.driver2Name} onChange={(e) => setNewTrip({ ...newTrip, driver2Name: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Consignor / Party Name</label>
                <input type="text" placeholder="e.g. Al Futtaim Logistics" value={newTrip.partyName} onChange={(e) => setNewTrip({ ...newTrip, partyName: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Origin (Source)</label>
                  <input type="text" placeholder="Jebel Ali Port" value={newTrip.source} onChange={(e) => setNewTrip({ ...newTrip, source: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Destination</label>
                  <input type="text" placeholder="Mussafah ICAD" value={newTrip.destination} onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Freight Rate (AED)</label>
                  <input type="number" value={newTrip.freightAmount} onChange={(e) => setNewTrip({ ...newTrip, freightAmount: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Advance Cash (AED)</label>
                  <input type="number" value={newTrip.advanceAmount} onChange={(e) => setNewTrip({ ...newTrip, advanceAmount: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsTripModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Dispatch Trip</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER TYRE MODAL */}
      {isTyreModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Register Fleet Tyre Serial</h3>
              <button onClick={() => setIsTyreModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTyre} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Tyre Serial Barcode #</label>
                <input type="text" placeholder="e.g. TYR-BS-9908" value={newTyre.tyreNumber} onChange={(e) => setNewTyre({ ...newTyre, tyreNumber: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Mount Vehicle</label>
                  <select value={newTyre.vehicleId} onChange={(e) => setNewTyre({ ...newTyre, vehicleId: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="">Spare Depot Stock</option>
                    {vehicleList.map((v) => <option key={v.device_id} value={v.device_id}>{v.reg_number || v.name || v.device_id}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Axle Position</label>
                  <select value={newTyre.axlePosition} onChange={(e) => setNewTyre({ ...newTyre, axlePosition: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="Front-Left (FL)">Front-Left (FL)</option>
                    <option value="Front-Right (FR)">Front-Right (FR)</option>
                    <option value="Rear-Outer-Left (ROL)">Rear-Outer-Left (ROL)</option>
                    <option value="Rear-Inner-Left (RIL)">Rear-Inner-Left (RIL)</option>
                    <option value="Rear-Outer-Right (ROR)">Rear-Outer-Right (ROR)</option>
                    <option value="Rear-Inner-Right (RIR)">Rear-Inner-Right (RIR)</option>
                    <option value="Spare Axle">Spare Axle</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Brand & Model</label>
                  <input type="text" placeholder="Bridgestone R150" value={`${newTyre.brand} ${newTyre.model}`} onChange={(e) => setNewTyre({ ...newTyre, brand: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Current Tread Depth (mm)</label>
                  <input type="number" step="0.1" value={newTyre.treadDepthMm} onChange={(e) => setNewTyre({ ...newTyre, treadDepthMm: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsTyreModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Tyre Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD VOUCHER MODAL */}
      {isVoucherModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Record Trip Expense Voucher</h3>
              <button onClick={() => setIsVoucherModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateVoucher} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Trip Reference</label>
                <select value={newVoucher.tripId} onChange={(e) => setNewVoucher({ ...newVoucher, tripId: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {trips.map((t) => <option key={t.id} value={t.id}>{t.tripNo} ({t.vehicleReg} - {t.destination})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Voucher Type</label>
                  <select value={newVoucher.voucherType} onChange={(e) => setNewVoucher({ ...newVoucher, voucherType: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="Fuel (Diesel)">Fuel (Diesel)</option>
                    <option value="Salik / Toll Gate">Salik / Toll Gate</option>
                    <option value="Loading / Pallet Handling">Loading / Pallet</option>
                    <option value="Mechanical Maintenance">Maintenance</option>
                    <option value="Driver Daily Allowance">Driver Batta</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Amount (AED)</label>
                  <input type="number" step="0.01" value={newVoucher.amount} onChange={(e) => setNewVoucher({ ...newVoucher, amount: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Bill / Invoice #</label>
                <input type="text" placeholder="ENOC-99201" value={newVoucher.billNo} onChange={(e) => setNewVoucher({ ...newVoucher, billNo: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsVoucherModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetPage;
