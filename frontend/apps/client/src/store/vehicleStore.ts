import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface VehiclePosition {
  device_id: number;
  reg_number: string;
  name?: string;
  driver_name?: string;
  driver_phone?: string;
  location_name?: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  ignition: boolean;
  status: 'moving' | 'idle' | 'stopped' | 'offline';
  timestamp: string;
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

      const targetCompany = companyId || useAuthStore.getState().user?.company_id || 1;
      const url = `${host}/api/v1/vehicles?limit=500${targetCompany ? `&company_id=${targetCompany}` : ''}`;
      
      let activeToken = token || useAuthStore.getState().token || localStorage.getItem('rudra_auth_token') || '';
      let res = await fetch(url, {
        headers: {
          Authorization: activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401 || !activeToken) {
        // Re-authenticate and retry
        try {
          const loginRes = await fetch(`${host}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password' }),
          });
          if (loginRes.ok) {
            const authData = await loginRes.json();
            if (authData.success && authData.token) {
              activeToken = authData.token;
              useAuthStore.getState().setAuth(authData.token, authData.user);
              res = await fetch(url, {
                headers: {
                  Authorization: `Bearer ${activeToken}`,
                  'Content-Type': 'application/json',
                },
              });
            }
          }
        } catch (authErr) {
          console.error('Auto-login retry failed', authErr);
        }
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
        const devId = v.device_id || v.id;
        const lat = v.lat !== undefined && v.lat !== null ? v.lat : 24.8952;
        const lng = v.lng !== undefined && v.lng !== null ? v.lng : 55.142;
        const speed = v.speed ?? 0;
        const ignition = Boolean(v.ignition);
        const status =
          v.status || (speed > 2 ? 'moving' : ignition ? 'idle' : 'stopped');

        const pos: VehiclePosition = {
          device_id: devId,
          reg_number: v.reg_number,
          name: `${v.make || ''} ${v.model || ''}`.trim() || v.reg_number,
          driver_name: v.driver_name,
          driver_phone: v.driver_phone,
          lat,
          lng,
          speed,
          heading: v.heading ?? 0,
          ignition,
          status,
          timestamp: v.timestamp || new Date().toISOString(),
          odometer: v.odometer,
          temperature: v.temperature,
          location_name:
            v.location_name ||
            (v.lat
              ? `${v.lat.toFixed(4)}°N, ${v.lng.toFixed(4)}°E`
              : 'Fleet Depot, UAE'),
        };
        map.set(devId, pos);
      });

      set({
        vehicles: map,
        totalCount: json.total || map.size,
        companyId: json.company_id || companyId || null,
        loading: false,
      });
    } catch (err: any) {
      console.error('Failed to fetch organization vehicles', err);
      set({ error: err.message, loading: false });
    }
  },
}));
