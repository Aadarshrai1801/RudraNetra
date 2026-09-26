import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, X, CheckCircle2, Truck, Navigation, Disc, Receipt, 
  MapPin, Users, FileText
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

interface MasterItem {
  id: number;
  type: string;
  code: string;
  name: string;
  isDefault: boolean;
}

// Null/undefined API values are shown as an em dash instead of inventing data.
const dash = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '—' : String(value);

const numberDash = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toLocaleString();

const nullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

export const FleetPage: React.FC<{ initialTab?: 'trips' | 'gatepasses' | 'lr' | 'tyres' | 'vouchers' | 'partyroutes' | 'drivers' }> = ({ initialTab = 'trips' }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const vehicleList = Array.from(vehiclesMap.values());

  const [activeTab, setActiveTab] = useState<'trips' | 'gatepasses' | 'lr' | 'tyres' | 'vouchers' | 'partyroutes' | 'drivers'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qTab = params.get('tab');
    if (qTab && ['trips', 'gatepasses', 'lr', 'tyres', 'vouchers', 'partyroutes', 'drivers'].includes(qTab)) {
      setActiveTab(qTab as any);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [location.search, initialTab]);

  // Data states
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [lrs, setLRs] = useState<LoadingReceipt[]>([]);
  const [tyres, setTyres] = useState<TyreRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [partyRoutes, setPartyRoutes] = useState<PartyRoute[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Master lookups (tyre brands, axle positions, voucher categories)
  const [tyreBrands, setTyreBrands] = useState<MasterItem[]>([]);
  const [axlePositions, setAxlePositions] = useState<MasterItem[]>([]);
  const [voucherCategories, setVoucherCategories] = useState<MasterItem[]>([]);

  // Modals
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isTyreModalOpen, setIsTyreModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // Form states (empty until the user enters real values)
  const [newTrip, setNewTrip] = useState({
    vehicleId: '',
    driver1Name: '',
    driver2Name: '',
    partyName: '',
    source: '',
    destination: '',
    freightAmount: '',
    advanceAmount: '',
  });

  const [newTyre, setNewTyre] = useState({
    vehicleId: '',
    tyreNumber: '',
    axlePosition: '',
    brand: '',
    model: '',
    size: '',
    treadDepthMm: '',
    plyRating: '',
    lifeKmLimit: '',
  });

  const [newVoucher, setNewVoucher] = useState({
    tripId: '',
    voucherType: '',
    amount: '',
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
      const [tripsRes, gpRes, lrRes, tyreRes, vchRes, prRes, drvRes, brandRes, axleRes, catRes] = await Promise.all([
        fetchWithAuth('/api/v1/fleet/trips'),
        fetchWithAuth('/api/v1/fleet/gate-passes'),
        fetchWithAuth('/api/v1/fleet/lr'),
        fetchWithAuth('/api/v1/fleet/tyres'),
        fetchWithAuth('/api/v1/fleet/vouchers'),
        fetchWithAuth('/api/v1/fleet/party-routes'),
        fetchWithAuth('/api/v1/drivers'),
        fetchWithAuth('/api/v1/masters/tyre-brands'),
        fetchWithAuth('/api/v1/masters/axle-positions'),
        fetchWithAuth('/api/v1/masters/voucher-categories'),
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
      if (brandRes.ok) {
        const j = await brandRes.json();
        if (j.success && Array.isArray(j.data)) setTyreBrands(j.data);
      }
      if (axleRes.ok) {
        const j = await axleRes.json();
        if (j.success && Array.isArray(j.data)) setAxlePositions(j.data);
      }
      if (catRes.ok) {
        const j = await catRes.json();
        if (j.success && Array.isArray(j.data)) setVoucherCategories(j.data);
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
    if (!newTrip.vehicleId) {
      showToast('Please select a vehicle');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        vehicleId: Number(newTrip.vehicleId),
        driver1Name: newTrip.driver1Name.trim(),
        driver2Name: newTrip.driver2Name.trim(),
        partyName: newTrip.partyName.trim(),
        source: newTrip.source.trim(),
        destination: newTrip.destination.trim(),
      };
      const freight = nullableNumber(newTrip.freightAmount);
      const advance = nullableNumber(newTrip.advanceAmount);
      if (freight !== null) body.freightAmount = freight;
      if (advance !== null) body.advanceAmount = advance;

      const res = await fetchWithAuth('/api/v1/fleet/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        showToast('Fleet trip created and dispatched');
        setIsTripModalOpen(false);
        setNewTrip({
          vehicleId: '',
          driver1Name: '',
          driver2Name: '',
          partyName: '',
          source: '',
          destination: '',
          freightAmount: '',
          advanceAmount: '',
        });
        loadData();
      } else {
        showToast(json?.error || 'Failed to dispatch trip');
      }
    } catch (err) {
      showToast('Error dispatching trip');
    }
  };

  const handleCreateTyre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTyre.vehicleId) {
      showToast('Please select the vehicle the tyre is mounted on');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        vehicleId: Number(newTyre.vehicleId),
        tyreNumber: newTyre.tyreNumber.trim(),
      };
      if (newTyre.axlePosition) body.axlePosition = newTyre.axlePosition;
      if (newTyre.brand) body.brand = newTyre.brand;
      if (newTyre.model.trim()) body.model = newTyre.model.trim();
      if (newTyre.size.trim()) body.size = newTyre.size.trim();
      const tread = nullableNumber(newTyre.treadDepthMm);
      const ply = nullableNumber(newTyre.plyRating);
      const life = nullableNumber(newTyre.lifeKmLimit);
      if (tread !== null) body.treadDepthMm = tread;
      if (ply !== null) body.plyRating = ply;
      if (life !== null) body.lifeKmLimit = life;

      const res = await fetchWithAuth('/api/v1/fleet/tyres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        showToast('Tyre serial registered in asset registry');
        setIsTyreModalOpen(false);
        setNewTyre({
          vehicleId: '',
          tyreNumber: '',
          axlePosition: '',
          brand: '',
          model: '',
          size: '',
          treadDepthMm: '',
          plyRating: '',
          lifeKmLimit: '',
        });
        loadData();
      } else {
        showToast(json?.error || 'Failed to register tyre');
      }
    } catch (err) {
      showToast('Error registering tyre');
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucher.tripId || !newVoucher.voucherType || !(Number(newVoucher.amount) > 0)) {
      showToast('Select a trip, voucher type and enter the amount');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        tripId: Number(newVoucher.tripId),
        voucherType: newVoucher.voucherType,
        amount: Number(newVoucher.amount),
      };
      if (newVoucher.billNo.trim()) body.billNo = newVoucher.billNo.trim();
      if (newVoucher.notes.trim()) body.notes = newVoucher.notes.trim();

      const res = await fetchWithAuth('/api/v1/fleet/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        showToast('Expense voucher added and balance updated');
        setIsVoucherModalOpen(false);
        setNewVoucher({ tripId: '', voucherType: '', amount: '', billNo: '', notes: '' });
        loadData();
      } else {
        showToast(json?.error || 'Failed to submit voucher');
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
              {location.pathname.includes('/driver-manager') || activeTab === 'drivers'
                ? 'Driver Manager'
                : location.pathname.includes('/party-manager')
                ? 'Party/Company Manager'
                : location.pathname.includes('/party-routes') || activeTab === 'partyroutes'
                ? 'Party Routes Manager'
                : location.pathname.includes('/trailor-master') || activeTab === 'tyres'
                ? 'Trailor Master'
                : location.pathname.includes('/truck-master')
                ? 'Truck Master'
                : 'Trip Manager'}
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            Dual-driver trip dispatching, trailer & tyre lifecycle management, en-route expense vouchers, and party contracts.
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
          { key: 'trips', label: 'Trip Manager', icon: Navigation, count: trips.length },
          { key: 'partyroutes', label: 'Party Routes Manager', icon: MapPin, count: partyRoutes.length },
          { key: 'drivers', label: 'Driver Manager', icon: Users, count: drivers.length },
          { key: 'tyres', label: 'Trailor & Tyre Master', icon: Disc, count: tyres.length },
          { key: 'vouchers', label: 'Trip Vouchers', icon: Receipt, count: vouchers.length },
          { key: 'gatepasses', label: 'Gate Passes', icon: FileText, count: gatePasses.length },
          { key: 'lr', label: 'Loading Receipts', icon: FileText, count: lrs.length },
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
                    {dash(t.tripNo)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                    {dash(t.vehicleReg)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{dash(t.driver1)}</div>
                    {t.driver2 && <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Co-driver: {t.driver2}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dash(t.partyName)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{dash(t.source)}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      <span>{dash(t.destination)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>Freight:</strong> AED {numberDash(t.freightAmount)}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      Adv: {numberDash(t.advanceAmount)} • Exp: {numberDash(t.expenseAmount)} • <strong>Bal: AED {numberDash(t.balanceAmount)}</strong>
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
                      {dash(t.status)}
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
                    {dash(ty.tyreNumber)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700 }}>{dash(ty.vehicleReg)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{dash(ty.axlePosition)}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>
                      {ty.brand || ty.model ? `${ty.brand || ''} ${ty.model || ''}`.trim() : '—'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                      {dash(ty.size)} • {ty.plyRating != null ? `${ty.plyRating} PR` : '—'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, color: ty.treadDepthMm != null && ty.treadDepthMm < 5 ? '#DC2626' : 'var(--text-primary)' }}>
                      {ty.treadDepthMm != null ? `${ty.treadDepthMm} mm` : '—'}
                    </span>
                    {ty.treadDepthMm != null && ty.treadDepthMm < 5 && (
                      <span style={{ fontSize: '0.72rem', color: '#DC2626', display: 'block' }}>Replace / Retread</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                      <span>{numberDash(ty.currentKm)} / {numberDash(ty.lifeKmLimit)} KM</span>
                      <strong style={{ color: ty.healthPct != null && ty.healthPct < 30 ? '#DC2626' : 'var(--good)' }}>
                        {ty.healthPct != null ? `${ty.healthPct}%` : '—'}
                      </strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${ty.healthPct || 0}%`,
                          height: '100%',
                          background: ty.healthPct != null && ty.healthPct < 30 ? '#DC2626' : ty.healthPct != null && ty.healthPct < 60 ? 'var(--attention)' : 'var(--good)',
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {ty.retreadingCount != null ? `${ty.retreadingCount} times` : '—'}
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
                    {dash(v.tripNo)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {dash(v.voucherType)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {v.amount != null ? `AED ${v.amount.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {v.billNo || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {v.notes || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {dash(v.date)}
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
                    {dash(p.partyName)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {dash(p.source)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {dash(p.destination)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {p.standardKm != null ? `${numberDash(p.standardKm)} KM` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--good)' }}>
                    AED {numberDash(p.billingRate)}
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
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>{dash(gp.passNo)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{dash(gp.vehicle)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{dash(gp.driver)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{dash(gp.destination)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{dash(gp.issuedAt)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', fontWeight: 700, background: 'var(--good-bg)', color: 'var(--good)' }}>
                      {dash(gp.status)}
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
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>{dash(l.lrNo)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{dash(l.party)}</td>
                  <td style={{ padding: '12px 16px' }}>{dash(l.vehicle)}</td>
                  <td style={{ padding: '12px 16px' }}>{l.weightKg != null ? `${numberDash(l.weightKg)} kg` : '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>AED {numberDash(l.freightAmt)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', fontWeight: 700, background: 'var(--good-bg)', color: 'var(--good)' }}>
                      {dash(l.status)}
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
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{dash(d.name)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{dash(d.phone)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{dash(d.licenseNo)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{dash(d.assignedVehicle)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', fontWeight: 700, background: 'var(--good-bg)', color: 'var(--good)' }}>
                      {dash(d.status)}
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
                  <input type="number" min="0" placeholder="Enter freight amount" value={newTrip.freightAmount} onChange={(e) => setNewTrip({ ...newTrip, freightAmount: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Advance Cash (AED)</label>
                  <input type="number" min="0" placeholder="Enter advance amount" value={newTrip.advanceAmount} onChange={(e) => setNewTrip({ ...newTrip, advanceAmount: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
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
                  <select value={newTyre.vehicleId} onChange={(e) => setNewTyre({ ...newTyre, vehicleId: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required>
                    <option value="">Select vehicle...</option>
                    {vehicleList.map((v) => <option key={v.device_id} value={v.device_id}>{v.reg_number || v.name || v.device_id}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Axle Position</label>
                  <select value={newTyre.axlePosition} onChange={(e) => setNewTyre({ ...newTyre, axlePosition: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="">Select axle position...</option>
                    {axlePositions.length === 0 ? (
                      <option value="" disabled>No axle positions configured</option>
                    ) : (
                      axlePositions.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)
                    )}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Brand</label>
                  <select value={newTyre.brand} onChange={(e) => setNewTyre({ ...newTyre, brand: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <option value="">Select brand...</option>
                    {tyreBrands.length === 0 ? (
                      <option value="" disabled>No tyre brands configured</option>
                    ) : (
                      tyreBrands.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Model</label>
                  <input type="text" placeholder="Enter tyre model" value={newTyre.model} onChange={(e) => setNewTyre({ ...newTyre, model: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Tyre Size</label>
                  <input type="text" placeholder="Enter tyre size" value={newTyre.size} onChange={(e) => setNewTyre({ ...newTyre, size: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Current Tread Depth (mm)</label>
                  <input type="number" min="0" step="0.1" placeholder="Enter tread depth" value={newTyre.treadDepthMm} onChange={(e) => setNewTyre({ ...newTyre, treadDepthMm: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Ply Rating</label>
                  <input type="number" min="0" placeholder="e.g. 16" value={newTyre.plyRating} onChange={(e) => setNewTyre({ ...newTyre, plyRating: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Life Limit (KM)</label>
                  <input type="number" min="0" placeholder="e.g. 100000" value={newTyre.lifeKmLimit} onChange={(e) => setNewTyre({ ...newTyre, lifeKmLimit: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
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
                <select value={newVoucher.tripId} onChange={(e) => setNewVoucher({ ...newVoucher, tripId: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required>
                  <option value="">Select trip...</option>
                  {trips.length === 0 ? (
                    <option value="" disabled>No trips available</option>
                  ) : (
                    trips.map((t) => <option key={t.id} value={t.id}>{dash(t.tripNo)} ({dash(t.vehicleReg)} - {dash(t.destination)})</option>)
                  )}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Voucher Type</label>
                  <select value={newVoucher.voucherType} onChange={(e) => setNewVoucher({ ...newVoucher, voucherType: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required>
                    <option value="">Select voucher type...</option>
                    {voucherCategories.length === 0 ? (
                      <option value="" disabled>No voucher categories configured</option>
                    ) : (
                      voucherCategories.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Amount (AED)</label>
                  <input type="number" min="0" step="0.01" placeholder="Enter amount" value={newVoucher.amount} onChange={(e) => setNewVoucher({ ...newVoucher, amount: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} required />
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
