import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useVehicleStore, VehiclePosition } from '../../store/vehicleStore';

export const LiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());

  const vehicles = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      // OpenStreetMap / CartoDB Dark Matter tile style for sleek cyber theme
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [55.2708, 25.2048], // Dubai / UAE coordinates default (matches vave.uae)
      zoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update vehicle markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    vehicles.forEach((v: VehiclePosition) => {
      let marker = markersRef.current.get(v.device_id);

      if (!marker) {
        // Create custom DOM element for marker with vehicle heading rotation
        const el = document.createElement('div');
        el.className = 'vehicle-map-marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';
        el.style.boxShadow = '0 0 12px rgba(0, 242, 254, 0.4)';
        el.style.transition = 'transform 0.3s ease';

        const statusColor =
          v.status === 'moving'
            ? '#10b981'
            : v.status === 'idle'
            ? '#f59e0b'
            : '#ef4444';

        el.style.background = `radial-gradient(circle, ${statusColor} 40%, #0f172a 100%)`;
        el.style.border = `2px solid ${statusColor}`;

        el.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${v.heading}deg)">
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
        `;

        el.addEventListener('click', () => {
          selectVehicle(v.device_id);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.lng, v.lat])
          .addTo(map);

        markersRef.current.set(v.device_id, marker);
      } else {
        marker.setLngLat([v.lng, v.lat]);
        const svg = marker.getElement().querySelector('svg');
        if (svg) {
          svg.style.transform = `rotate(${v.heading}deg)`;
        }
      }
    });

    // Cleanup markers that are removed
    markersRef.current.forEach((marker, deviceId) => {
      if (!vehicles.has(deviceId)) {
        marker.remove();
        markersRef.current.delete(deviceId);
      }
    });
  }, [vehicles, selectVehicle]);

  // Center on selected vehicle
  useEffect(() => {
    if (!selectedDeviceId || !mapRef.current) return;
    const selected = vehicles.get(selectedDeviceId);
    if (selected) {
      mapRef.current.flyTo({
        center: [selected.lng, selected.lat],
        zoom: 15,
        speed: 1.2,
      });
    }
  }, [selectedDeviceId, vehicles]);

  return <div ref={mapContainerRef} className="map-element" id="live-tracking-map" />;
};
