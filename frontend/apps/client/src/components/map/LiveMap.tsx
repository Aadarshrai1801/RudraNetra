import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useVehicleStore, VehiclePosition } from '../../store/vehicleStore';

export const LiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());

  const vehicles = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);

  const [coordsReadout, setCoordsReadout] = useState({
    lat: '25.2048',
    lng: '55.2708',
    zoom: '11.0',
  });

  // Initialize MapLibre with Esri Dark Gray Base (watermark-free industrial telematics tiles)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-dark': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, Garmin, © OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'esri-dark-layer',
            type: 'raster',
            source: 'esri-dark',
            minzoom: 0,
            maxzoom: 16,
          },
        ],
      },
      center: [55.2708, 25.2048], // Dubai / UAE coordinates
      zoom: 11,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('move', () => {
      const center = map.getCenter();
      setCoordsReadout({
        lat: center.lat.toFixed(4),
        lng: center.lng.toFixed(4),
        zoom: map.getZoom().toFixed(1),
      });
    });

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
        el.className = 'ops-map-marker';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';

        el.addEventListener('click', () => {
          selectVehicle(v.device_id);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.lng, v.lat])
          .addTo(map);

        markersRef.current.set(v.device_id, marker);
      } else {
        marker.setLngLat([v.lng, v.lat]);
      }

      // Render marker element with redundant glyph + color + label encoding
      const el = marker.getElement();

      const statusColor = isSelected
        ? 'var(--signal-amber)'
        : v.status === 'moving'
        ? 'var(--signal-green)'
        : v.status === 'idle'
        ? 'var(--signal-blue)'
        : 'var(--signal-red)';

      const glyphSvg =
        v.status === 'moving'
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="${statusColor}" style="transform: rotate(${v.heading}deg);"><polygon points="12 2 22 22 12 17 2 22 12 2"/></svg>`
          : v.status === 'idle'
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="${statusColor}"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="${statusColor}"><rect x="4" y="4" width="16" height="16"/></svg>`;

      el.innerHTML = `
        <div style="
          background: #14120F;
          border: 1px solid ${statusColor};
          padding: 2px 5px;
          margin-bottom: 3px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: ${isSelected ? 'var(--signal-amber)' : 'var(--text-primary)'};
          white-space: nowrap;
          letter-spacing: -0.02em;
        ">
          ${v.reg_number}
        </div>
        <div class="${isSelected ? 'live-pulse' : ''}" style="
          width: 24px;
          height: 24px;
          background: #1C1913;
          border: ${isSelected ? '2px solid var(--signal-amber)' : '1px solid var(--line)'};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${glyphSvg}
        </div>
      `;
    });
  }, [vehicles, selectedDeviceId, selectVehicle]);

  // Pan to selected vehicle
  useEffect(() => {
    if (!selectedDeviceId || !mapRef.current) return;
    const vehicle = vehicles.get(selectedDeviceId);
    if (vehicle) {
      mapRef.current.easeTo({
        center: [vehicle.lng, vehicle.lat],
        duration: 800,
      });
    }
  }, [selectedDeviceId, vehicles]);

  return (
    <div className="map-container" ref={mapContainerRef}>
      {/* Monospace telemetry readout in bottom corner */}
      <div className="map-coords-readout mono-num">
        LAT {coordsReadout.lat}° N &nbsp;|&nbsp; LON {coordsReadout.lng}° E &nbsp;|&nbsp; ZOOM {coordsReadout.zoom} &nbsp;|&nbsp; EPSG:3857 &nbsp;|&nbsp; TELTONIKA CODEC 8
      </div>
    </div>
  );
};
