import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useVehicleStore, VehiclePosition } from '../../store/vehicleStore';
import { Compass, Layers, Check } from 'lucide-react';

export interface DubaiMapStyle {
  id: string;
  name: string;
  badge: string;
  description: string;
  attribution: string;
  tiles: string[];
  maxZoom: number;
}

export const FREE_DUBAI_MAP_STYLES: DubaiMapStyle[] = [
  {
    id: 'dubai-voyager',
    name: 'Dubai Daylight',
    badge: 'Recommended',
    description: 'High-contrast road network, exit numbers (E11, E311), and landmark labels',
    attribution: '© OpenStreetMap contributors, © CARTO',
    tiles: [
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    maxZoom: 19,
  },
  {
    id: 'dubai-satellite',
    name: 'Dubai Satellite Aerial',
    badge: 'Aerial Imagery',
    description: 'Real photographic imagery of Dubai ports, loading yards, and highways',
    attribution: 'Source: Esri, Maxar, Earthstar Geographics',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    maxZoom: 18,
  },
  {
    id: 'dubai-osm',
    name: 'OpenStreetMap (Arabic & English)',
    badge: 'Bilingual',
    description: 'Community street map with full bilingual Arabic/English Dubai street names',
    attribution: '© OpenStreetMap contributors',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    maxZoom: 19,
  },
];

export const LiveMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());

  const vehicles = useVehicleStore((state) => state.vehicles);
  const selectedDeviceId = useVehicleStore((state) => state.selectedDeviceId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);

  const [activeStyleId, setActiveStyleId] = useState<string>(() => {
    const saved = localStorage.getItem('rudra_dubai_map_style');
    if (saved && FREE_DUBAI_MAP_STYLES.some((s) => s.id === saved)) {
      return saved;
    }
    return FREE_DUBAI_MAP_STYLES[0].id;
  });
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

  // Synchronize localStorage if previous selection was removed
  useEffect(() => {
    const saved = localStorage.getItem('rudra_dubai_map_style');
    if (saved && !FREE_DUBAI_MAP_STYLES.some((s) => s.id === saved)) {
      localStorage.setItem('rudra_dubai_map_style', FREE_DUBAI_MAP_STYLES[0].id);
    }
  }, []);

  // Initialize MapLibre with verified free Dubai tile layers pre-configured
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const sourcesObj: Record<string, any> = {};
    const layersArr: any[] = [];

    FREE_DUBAI_MAP_STYLES.forEach((style) => {
      sourcesObj[style.id] = {
        type: 'raster',
        tiles: style.tiles,
        tileSize: 256,
        attribution: style.attribution,
      };

      layersArr.push({
        id: style.id,
        type: 'raster',
        source: style.id,
        minzoom: 0,
        maxzoom: style.maxZoom,
        layout: {
          visibility: style.id === activeStyleId ? 'visible' : 'none',
        },
      });
    });

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: sourcesObj,
        layers: layersArr,
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

  // Seamlessly toggle tile layer visibility without reloading the map
  const switchMapStyle = (newStyleId: string) => {
    setActiveStyleId(newStyleId);
    localStorage.setItem('rudra_dubai_map_style', newStyleId);
    setIsStyleMenuOpen(false);

    const map = mapRef.current;
    if (!map) return;

    FREE_DUBAI_MAP_STYLES.forEach((style) => {
      if (map.getLayer(style.id)) {
        map.setLayoutProperty(
          style.id,
          'visibility',
          style.id === newStyleId ? 'visible' : 'none'
        );
      }
    });
  };

  // Update vehicle markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up markers for vehicles no longer in current organization's fleet
    markersRef.current.forEach((marker, devId) => {
      if (!vehicles.has(devId)) {
        marker.remove();
        markersRef.current.delete(devId);
      }
    });

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

      el.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          background: #FFFFFF;
          padding: 6px 12px;
          border-radius: 9999px;
          border: 1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
          box-shadow: ${isSelected ? '0 4px 16px rgba(47, 111, 109, 0.28)' : '0 2px 8px rgba(30, 37, 33, 0.15)'};
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

  // Recenter map to Dubai overview
  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      center: [55.2850, 25.2150],
      zoom: 11.5,
      duration: 800,
    });
  };

  const currentStyle =
    FREE_DUBAI_MAP_STYLES.find((s) => s.id === activeStyleId) ||
    FREE_DUBAI_MAP_STYLES[0];

  return (
    <div className="map-container" ref={mapContainerRef} style={{ position: 'relative' }}>
      {/* Top-Right Floating Controls (Layer Selector + Fit All) */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          display: 'flex',
          gap: '10px',
        }}
      >
        {/* Dubai Map Free Layer Selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
            style={{
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
            <Layers size={16} color="var(--accent)" />
            <span>Map: {currentStyle.name}</span>
          </button>

          {/* Map Style Dropdown Menu */}
          {isStyleMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: '0',
                width: '320px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 20,
              }}
            >
              <div style={{ padding: '4px 8px 8px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  FREE DUBAI BASEMAPS
                </span>
              </div>

              {FREE_DUBAI_MAP_STYLES.map((style) => {
                const isSelected = style.id === activeStyleId;
                return (
                  <div
                    key={style.id}
                    onClick={() => switchMapStyle(style.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-light)' : 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {style.name}
                      </span>
                      {isSelected && <Check size={15} color="var(--accent)" />}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      {style.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fit All Vehicles Button */}
        <button
          onClick={handleRecenter}
          title="Fit Dubai view"
          style={{
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
          <span>Fit Dubai</span>
        </button>
      </div>
    </div>
  );
};
