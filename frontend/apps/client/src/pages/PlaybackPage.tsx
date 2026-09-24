import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Play, Pause, RotateCcw, Clock, Gauge, Calendar } from 'lucide-react';

interface HistoryPoint {
  lat: number;
  lng: number;
  speed: number;
  time: string;
}

// Realistic route points along Sheikh Zayed Road (Dubai)
const sampleRoute: HistoryPoint[] = [
  { lat: 25.1200, lng: 55.2200, speed: 65, time: '09:00 am' },
  { lat: 25.1230, lng: 55.2225, speed: 72, time: '09:02 am' },
  { lat: 25.1280, lng: 55.2260, speed: 78, time: '09:04 am' },
  { lat: 25.1340, lng: 55.2300, speed: 82, time: '09:06 am' },
  { lat: 25.1410, lng: 55.2350, speed: 75, time: '09:08 am' },
  { lat: 25.1490, lng: 55.2410, speed: 70, time: '09:10 am' },
  { lat: 25.1560, lng: 55.2460, speed: 68, time: '09:12 am' },
  { lat: 25.1630, lng: 55.2510, speed: 74, time: '09:14 am' },
  { lat: 25.1710, lng: 55.2560, speed: 80, time: '09:16 am' },
  { lat: 25.1790, lng: 55.2610, speed: 84, time: '09:18 am' },
  { lat: 25.1860, lng: 55.2650, speed: 76, time: '09:20 am' },
  { lat: 25.1930, lng: 55.2700, speed: 60, time: '09:22 am' },
  { lat: 25.1990, lng: 55.2740, speed: 45, time: '09:24 am' },
  { lat: 25.2048, lng: 55.2708, speed: 30, time: '09:26 am' },
];

export const PlaybackPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState('DXB-A-98124');

  // Initialize Map with Daylight Tiles
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
      center: [sampleRoute[0].lng, sampleRoute[0].lat],
      zoom: 12.5,
    });

    map.on('load', () => {
      const coordinates = sampleRoute.map((p) => [p.lng, p.lat]);

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

      // Soft quiet teal route line
      map.addLayer({
        id: 'route-line-bg',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2F6F6D',
          'line-width': 8,
          'line-opacity': 0.2,
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
          'line-opacity': 0.85,
        },
      });

      // Moving Vehicle Marker Element
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
        .setLngLat([sampleRoute[0].lng, sampleRoute[0].lat])
        .addTo(map);

      markerRef.current = marker;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Animation Loop for Playback
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= sampleRoute.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          const pt = sampleRoute[next];
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
  }, [isPlaying, playbackSpeed]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setCurrentIndex(idx);
    const pt = sampleRoute[idx];
    if (markerRef.current) {
      markerRef.current.setLngLat([pt.lng, pt.lat]);
    }
    if (mapRef.current) {
      mapRef.current.easeTo({ center: [pt.lng, pt.lat], duration: 200 });
    }
  };

  const currentPoint = sampleRoute[currentIndex];

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
            Trip history
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
            Review past routes, stops, and driving speed step-by-step.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Vehicle Selector */}
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
              }}
            >
              <option value="DXB-A-98124">DXB-A-98124 (Mercedes Actros)</option>
              <option value="DXB-B-43210">DXB-B-43210 (Volvo FH16)</option>
              <option value="AUH-C-11029">AUH-C-11029 (Isuzu Reefer)</option>
              <option value="SHJ-D-77123">SHJ-D-77123 (Toyota Hilux)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-page)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <Calendar size={15} />
            <span>Today, morning shift</span>
          </div>
        </div>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', position: 'relative' }} />

      {/* Floating Bottom Playback Controls */}
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
            {currentPoint.time}
          </span>
          <input
            type="range"
            min="0"
            max={sampleRoute.length - 1}
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
            {sampleRoute[sampleRoute.length - 1].time}
          </span>
        </div>

        {/* Buttons and Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                setCurrentIndex(0);
                if (markerRef.current) markerRef.current.setLngLat([sampleRoute[0].lng, sampleRoute[0].lat]);
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
                {currentPoint.speed} km/h
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Clock size={16} />
              <span>Point {currentIndex + 1} of {sampleRoute.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
