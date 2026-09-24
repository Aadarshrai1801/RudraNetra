import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useVehicleStore, VehiclePosition } from '../../store/vehicleStore';
import { Compass } from 'lucide-react';

export const LiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());

  const vehicles = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);

  // Initialize MapLibre with clean, light daylight tiles (Carto Voyager)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-voyager': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          {
            id: 'carto-voyager-layer',
            type: 'raster',
            source: 'carto-voyager',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [55.2850, 25.2150], // Dubai / UAE center
      zoom: 11.5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

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
      const isSelected = selectedDeviceId === v.device_id;
      let marker = markersRef.current.get(v.device_id);

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'vehicle-marker-container';
        el.style.cursor = 'pointer';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          selectVehicle(v.device_id);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.lng, v.lat])
          .addTo(map);

        markersRef.current.set(v.device_id, marker);
      } else {
        marker.setLngLat([v.lng, v.lat]);
      }

      const el = marker.getElement();

      // Status color and plain word
      const statusWord =
        v.status === 'moving'
          ? 'Moving'
          : v.status === 'idle'
          ? 'Waiting'
          : 'Parked';

      const dotColor =
        v.status === 'moving'
          ? 'var(--good)'
          : v.status === 'idle'
          ? 'var(--attention)'
          : 'var(--alert)';

      const speedOrState =
        v.status === 'moving'
          ? `${Math.round(v.speed)} km/h`
          : statusWord;

      // Soft daylight pill marker with clear text, plate and plain status
      el.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          background: #FFFFFF;
          padding: 6px 12px;
          border-radius: 9999px;
          border: 1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
          box-shadow: ${isSelected ? '0 4px 16px rgba(47, 111, 109, 0.28)' : '0 2px 8px rgba(30, 37, 33, 0.1)'};
          font-family: var(--font-family);
          color: var(--text-primary);
          white-space: nowrap;
          transform: ${isSelected ? 'scale(1.08)' : 'scale(1)'};
          transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        ">
          <span style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${dotColor};
            display: inline-block;
            flex-shrink: 0;
          "></span>
          <span style="font-weight: 700; font-size: 0.85rem; letter-spacing: -0.01em;">
            ${v.reg_number}
          </span>
          <span style="
            font-size: 0.775rem;
            color: var(--text-secondary);
            padding-left: 2px;
            border-left: 1px solid var(--border);
            margin-left: 2px;
          ">
            ${speedOrState}
          </span>
        </div>
      `;
    });
  }, [vehicles, selectedDeviceId, selectVehicle]);

  // Smoothly pan when a vehicle is selected
  useEffect(() => {
    if (!selectedDeviceId || !mapRef.current) return;
    const vehicle = vehicles.get(selectedDeviceId);
    if (vehicle) {
      mapRef.current.easeTo({
        center: [vehicle.lng, vehicle.lat],
        zoom: 13,
        duration: 900,
      });
    }
  }, [selectedDeviceId, vehicles]);

  // Recenter map button
  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      center: [55.2850, 25.2150],
      zoom: 11.5,
      duration: 800,
    });
  };

  return (
    <div className="map-container" ref={mapContainerRef} style={{ position: 'relative' }}>
      {/* Daylight Quick Recenter Control */}
      <button
        onClick={handleRecenter}
        title="Show all vehicles"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 5,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        <Compass size={16} color="var(--accent)" />
        <span>Fit all vehicles</span>
      </button>
    </div>
  );
};
