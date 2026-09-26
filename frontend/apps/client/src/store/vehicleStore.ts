import { create } from 'zustand';
import { useAuthStore } from './authStore';

export type VehicleStatus = 'moving' | 'idle' | 'stopped' | 'offline';

export interface VehiclePosition {
  device_id: number;
  reg_number: string;
  name?: string;
  driver_name?: string;
  driver_phone?: string;
  location_name?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  ignition?: boolean;
  status?: VehicleStatus;
  online?: boolean;
  timestamp?: string;
  odometer?: number;
  temperature?: number;
  idle_duration_min?: number;
  parked_duration_min?: number;
}

interface VehicleState {
  vehicles: Map<number, VehiclePosition>;
  selectedDeviceId: number | null;
  filterStatus: string;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  totalCount: number;
  companyId: number | null;
  updatePosition: (pos: VehiclePosition) => void;
  selectVehicle: (deviceId: number | null) => void;
  setFilterStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  fetchVehicles: (token?: string, companyId?: number) => Promise<void>;
  clearVehicles: () => void;
}

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: new Map<number, VehiclePosition>(),
  selectedDeviceId: null,
  filterStatus: 'all',
  searchQuery: '',
  loading: false,
  error: null,
  totalCount: 0,
  companyId: null,

  updatePosition: (pos) =>
    set((state) => {
      const nextMap = new Map(state.vehicles);
      nextMap.set(pos.device_id, pos);
      return { vehicles: nextMap };
    }),

  selectVehicle: (deviceId) => set({ selectedDeviceId: deviceId }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  clearVehicles: () =>
    set({
      vehicles: new Map<number, VehiclePosition>(),
      selectedDeviceId: null,
      totalCount: 0,
      companyId: null,
    }),

  fetchVehicles: async (token?: string, companyId?: number) => {
    set({ loading: true, error: null });
    try {
      const host =
        window.location.port !== '8080' && window.location.hostname === 'localhost'
          ? 'http://localhost:8080'
          : '';

      const auth = useAuthStore.getState();
      const targetCompany = companyId ?? auth.user?.company_id ?? null;
      const params = new URLSearchParams({ limit: '500' });
      if (targetCompany !== null) {
        params.set('company_id', String(targetCompany));
      }
      const url = `${host}/api/v1/vehicles?${params.toString()}`;

      const activeToken =
        token || auth.token || localStorage.getItem('rudra_auth_token') || '';

      if (!activeToken) {
        auth.logout();
        throw new Error('Unauthenticated: no active session. Please sign in.');
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        throw new Error('Session expired or unauthorized. Please sign in.');
      }

      if (!res.ok) {
        throw new Error(`Failed to load vehicles: ${res.statusText}`);
      }

      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || 'Invalid vehicles payload');
      }

      const map = new Map<number, VehiclePosition>();
      json.data.forEach((v: any) => {
        const devId = v.device_id ?? v.id;
        // DB-only data: absent coordinates stay absent so the vehicle is
        // rendered as offline instead of being placed on the map.
        const lat = typeof v.lat === 'number' ? v.lat : undefined;
        const lng = typeof v.lng === 'number' ? v.lng : undefined;
        const hasPosition = lat !== undefined && lng !== undefined;
        // Status always reflects the LAST KNOWN state stored in the database;
        // stale vehicles keep their recorded state (moving/idle/stopped). The
        // `online` flag is informational (position within the last 15 minutes).
        const online = typeof v.online === 'boolean' ? v.online : hasPosition;
        const makeModel = [v.make, v.model].filter(Boolean).join(' ').trim();

        const pos: VehiclePosition = {
          device_id: devId,
          reg_number: v.reg_number,
          name: makeModel || undefined,
          driver_name: v.driver_name ?? undefined,
          driver_phone: v.driver_phone ?? undefined,
          lat,
          lng,
          speed: typeof v.speed === 'number' ? v.speed : undefined,
          heading: typeof v.heading === 'number' ? v.heading : undefined,
          ignition: typeof v.ignition === 'boolean' ? v.ignition : undefined,
          status: hasPosition ? (v.status ?? undefined) : 'offline',
          online,
          timestamp: v.timestamp ?? undefined,
          odometer: typeof v.odometer === 'number' ? v.odometer : undefined,
          temperature: typeof v.temperature === 'number' ? v.temperature : undefined,
          location_name: v.location_name ?? undefined,
        };
        map.set(devId, pos);
      });

      set({
        vehicles: map,
        totalCount: json.total ?? map.size,
        companyId: targetCompany,
        loading: false,
      });
    } catch (err: any) {
      console.error('Failed to fetch organization vehicles', err);
      set({ error: err.message, loading: false });
    }
  },
}));
