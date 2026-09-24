import { create } from 'zustand';

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
  updatePosition: (pos: VehiclePosition) => void;
  selectVehicle: (deviceId: number | null) => void;
  setFilterStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: new Map<number, VehiclePosition>(),
  selectedDeviceId: null,
  filterStatus: 'all',
  searchQuery: '',

  updatePosition: (pos) =>
    set((state) => {
      const nextMap = new Map(state.vehicles);
      nextMap.set(pos.device_id, pos);
      return { vehicles: nextMap };
    }),

  selectVehicle: (deviceId) => set({ selectedDeviceId: deviceId }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
