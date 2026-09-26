import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Play, Pause, RotateCcw, Clock, Gauge, Calendar, Layers, Check } from 'lucide-react';
import { FREE_DUBAI_MAP_STYLES } from '../components/map/LiveMap';
import { useVehicleStore } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';
import { fetchWithAuth } from '../utils/api';

interface HistoryPoint {
  lat: number;
  lng: number;
  speed: number;
  time: string;
}

export const PlaybackPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const fetchVehicles = useVehicleStore((state) => state.fetchVehicles);
  const vehiclesLoading = useVehicleStore((state) => state.loading);

  const vehicleList = Array.from(vehiclesMap.values());
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [routePoints, setRoutePoints] = useState<HistoryPoint[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeStyleId, setActiveStyleId] = useState<string>(() => {
    const saved = localStorage.getItem('rudra_dubai_map_style');
    if (saved && FREE_DUBAI_MAP_STYLES.some((s) => s.id === saved)) {
      return saved;
    }
    return FREE_DUBAI_MAP_STYLES[0].id;
  });
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

  // Ensure vehicles are loaded
  useEffect(() => {
    if (vehiclesMap.size === 0 && token) {
      fetchVehicles(token, user?.company_id);
    }
  }, [user?.company_id, token]);

  // Set initial selected vehicle when list loads
  useEffect(() => {
    if (vehicleList.length > 0) {
      const exists = vehicleList.some((v) => v.reg_number === selectedVehicle);
      if (!exists || !selectedVehicle) {
        setSelectedVehicle(vehicleList[0].reg_number);
      }
    }
  }, [vehicleList]);

  // Fetch real route history for selected vehicle
  useEffect(() => {
    if (!selectedVehicle) return;

    let isCancelled = false;
    setIsLoadingRoute(true);

    fetchWithAuth(`/api/v1/tracking/history/${selectedVehicle}`)
      .then((res) => res.json())
      .then((json) => {
        if (isCancelled) return;
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const pts: HistoryPoint[] = json.data.map((d: any) => ({
            lat: d.lat,
            lng: d.lng,
            speed: Math.round(d.speed || 0),
            time: d.time || '—',
          }));
          setRoutePoints(pts);
          setCurrentIndex(0);
          setIsPlaying(false);

          // Update map route source
          const map = mapRef.current;
          if (map && map.getSource('route')) {
            const geoSource = map.getSource('route') as maplibregl.GeoJSONSource;
            geoSource.setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: pts.map((p) => [p.lng, p.lat]),
              },
            });

            if (pts.length > 0) {
              map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 12.5 });
              if (markerRef.current) {
                markerRef.current.getElement().style.display = '';
                markerRef.current.setLngLat([pts[0].lng, pts[0].lat]);
              }
            }
          }
        } else {
          setRoutePoints([]);
          setCurrentIndex(0);
          setIsPlaying(false);
          if (markerRef.current) {
            markerRef.current.getElement().style.display = 'none';
          }
          const map = mapRef.current;
          if (map && map.getSource('route')) {
            const geoSource = map.getSource('route') as maplibregl.GeoJSONSource;
            geoSource.setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [],
              },
            });
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load tracking history:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingRoute(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedVehicle]);

  // Synchronize localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rudra_dubai_map_style');
    if (saved && !FREE_DUBAI_MAP_STYLES.some((s) => s.id === saved)) {
      localStorage.setItem('rudra_dubai_map_style', FREE_DUBAI_MAP_STYLES[0].id);
    }
  }, []);

  // Initialize Map
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

    // Map center starts from the first real track point when available.
    const hasRealPoint = routePoints.length > 0;
    const initialCenter: [number, number] = hasRealPoint
      ? [routePoints[0].lng, routePoints[0].lat]
      : [0, 0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: sourcesObj,
        layers: layersArr,
      },
      center: initialCenter,
      zoom: hasRealPoint ? 12.5 : 1,
    });

    map.on('load', () => {
      const coordinates = routePoints.map((p) => [p.lng, p.lat]);

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates,
          },
        },
      });

      map.addLayer({
        id: 'route-line-bg',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2F6F6D',
          'line-width': 8,
          'line-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2F6F6D',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      const el = document.createElement('div');
      el.className = 'vehicle-playback-marker';
      el.innerHTML = `
        <div style="
          width: 34px;
          height: 34px;
          background: #2F6F6D;
          border: 3px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(47, 111, 109, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 22 22 12 17 2 22 12 2" />
          </svg>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(initialCenter)
        .addTo(map);

      // Hide the playback marker until a real track point is available.
      if (routePoints.length === 0) {
        el.style.display = 'none';
      }

      markerRef.current = marker;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

  // Animation Loop for Playback
  useEffect(() => {
    let interval: any;
    if (isPlaying && routePoints.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= routePoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          const pt = routePoints[next];
          if (markerRef.current) {
            markerRef.current.setLngLat([pt.lng, pt.lat]);
          }
          if (mapRef.current) {
            mapRef.current.easeTo({ center: [pt.lng, pt.lat], duration: 400 });
          }
          return next;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, routePoints]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setCurrentIndex(idx);
    const pt = routePoints[idx];
    if (pt) {
      if (markerRef.current) {
        markerRef.current.setLngLat([pt.lng, pt.lat]);
      }
      if (mapRef.current) {
        mapRef.current.easeTo({ center: [pt.lng, pt.lat], duration: 200 });
      }
    }
  };

  const currentPoint = routePoints[currentIndex];
  const currentStyle =
    FREE_DUBAI_MAP_STYLES.find((s) => s.id === activeStyleId) ||
    FREE_DUBAI_MAP_STYLES[0];
  const hasRoute = routePoints.length > 0;
  const lastPoint = routePoints[routePoints.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Top Filter Bar */}
      <div
        style={{
          padding: '16px 28px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          zIndex: 10,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Trip History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
            Review past routes, stops, and driving speed step-by-step from real telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Dubai Map Free Layer Selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
              style={{
                background: 'var(--bg-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <Layers size={15} color="var(--accent)" />
              <span>Map: {currentStyle.name}</span>
            </button>

            {isStyleMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: '0',
                  width: '300px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  zIndex: 30,
                }}
              >
                {FREE_DUBAI_MAP_STYLES.map((style) => {
                  const isSelected = style.id === activeStyleId;
                  return (
                    <div
                      key={style.id}
                      onClick={() => switchMapStyle(style.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {style.name}
                        </span>
                        {isSelected && <Check size={14} color="var(--accent)" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dynamic Vehicle Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Vehicle:
            </span>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-page)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-family)',
                color: 'var(--text-primary)',
                minWidth: '220px',
              }}
            >
              {vehicleList.length === 0 ? (
                <option value="">{vehiclesLoading ? 'Loading vehicles…' : 'No vehicles available'}</option>
              ) : (
                vehicleList.map((v) => (
                  <option key={v.reg_number} value={v.reg_number}>
                    {v.reg_number} ({v.name || 'Vehicle'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-page)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <Calendar size={15} />
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', position: 'relative' }} />

      {/* Empty state when the selected vehicle has no stored history */}
      {!isLoadingRoute && routePoints.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: '20px 28px',
            textAlign: 'center',
            maxWidth: '440px',
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            No route history
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
            {selectedVehicle
              ? `No track points are stored for ${selectedVehicle}.`
              : 'Select a vehicle to load its route history.'}
          </p>
        </div>
      )}

      {/* Floating Bottom Playback Controls (only when real track points exist) */}
      {hasRoute && (
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(780px, 92%)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '18px 24px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Progress Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', minWidth: '65px' }}>
            {currentPoint?.time ?? '—'}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(0, routePoints.length - 1)}
            value={currentIndex}
            onChange={handleSliderChange}
            style={{
              flex: 1,
              accentColor: 'var(--accent)',
              cursor: 'pointer',
              height: '6px',
            }}
          />
          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', minWidth: '65px', textAlign: 'right' }}>
            {lastPoint?.time ?? '—'}
          </span>
        </div>

        {/* Buttons and Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                setCurrentIndex(0);
                if (markerRef.current && routePoints.length > 0) {
                  markerRef.current.setLngLat([routePoints[0].lng, routePoints[0].lat]);
                  mapRef.current?.easeTo({ center: [routePoints[0].lng, routePoints[0].lat] });
                }
              }}
              className="btn btn-secondary btn-sm"
              title="Reset to beginning"
            >
              <RotateCcw size={15} />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn btn-primary"
              style={{ minHeight: '38px', padding: '6px 18px', gap: '8px' }}
              disabled={routePoints.length <= 1}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaying ? 'Pause' : 'Play route'}</span>
            </button>

            {/* Speed Multiplier */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-page)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              {[1, 2, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    background: playbackSpeed === s ? 'var(--accent)' : 'transparent',
                    color: playbackSpeed === s ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gauge size={16} color="var(--accent)" />
              <span className="tabular-num" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentPoint ? `${currentPoint.speed} km/h` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Clock size={16} />
              <span>
                {isLoadingRoute ? 'Loading route…' : `Point ${currentIndex + 1} of ${routePoints.length}`}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
