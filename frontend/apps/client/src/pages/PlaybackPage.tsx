import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Play, Pause, RotateCcw, Clock, Gauge } from 'lucide-react';

interface HistoryPoint {
  lat: number;
  lng: number;
  speed: number;
  time: string;
}

// 20 realistic route points along Sheikh Zayed Road (Dubai)
const sampleRoute: HistoryPoint[] = [
  { lat: 25.1200, lng: 55.2200, speed: 65, time: '09:00:00' },
  { lat: 25.1230, lng: 55.2225, speed: 72, time: '09:02:00' },
  { lat: 25.1280, lng: 55.2260, speed: 78, time: '09:04:00' },
  { lat: 25.1340, lng: 55.2300, speed: 82, time: '09:06:00' },
  { lat: 25.1410, lng: 55.2350, speed: 75, time: '09:08:00' },
  { lat: 25.1490, lng: 55.2410, speed: 70, time: '09:10:00' },
  { lat: 25.1560, lng: 55.2460, speed: 68, time: '09:12:00' },
  { lat: 25.1630, lng: 55.2510, speed: 74, time: '09:14:00' },
  { lat: 25.1710, lng: 55.2560, speed: 80, time: '09:16:00' },
  { lat: 25.1790, lng: 55.2610, speed: 84, time: '09:18:00' },
  { lat: 25.1860, lng: 55.2650, speed: 76, time: '09:20:00' },
  { lat: 25.1930, lng: 55.2700, speed: 60, time: '09:22:00' },
  { lat: 25.1990, lng: 55.2740, speed: 45, time: '09:24:00' },
  { lat: 25.2048, lng: 55.2708, speed: 30, time: '09:26:00' },
];

export const PlaybackPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState('DXB-A-98124');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
          },
        ],
      },
      center: [sampleRoute[0].lng, sampleRoute[0].lat],
      zoom: 12,
    });

    map.on('load', () => {
      // Add route polyline
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

      map.addLayer({
        id: 'route-line-bg',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#0284c7',
          'line-width': 8,
          'line-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#00f2fe',
          'line-width': 4,
          'line-dasharray': [1, 0],
        },
      });

      // Animated vehicle marker
      const el = document.createElement('div');
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.background = 'radial-gradient(circle, #00f2fe 30%, #0f172a 100%)';
      el.style.border = '2px solid #00f2fe';
      el.style.boxShadow = '0 0 16px #00f2fe';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.innerHTML = '🚗';

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

  // Handle Playback Interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

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

    return () => {
      if (interval) clearInterval(interval);
    };
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
        className="glass-panel"
        style={{
          margin: '16px 16px 0 16px',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vehicle</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            >
              <option value="DXB-A-98124">DXB-A-98124 (Actros Heavy)</option>
              <option value="DXB-B-43210">DXB-B-43210 (Volvo FH16)</option>
              <option value="AUH-C-11029">AUH-C-11029 (Isuzu Reefer)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date</label>
            <input
              type="date"
              defaultValue="2026-09-24"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div>Distance: <strong style={{ color: 'var(--cyan-accent)' }}>42.8 km</strong></div>
          <div>Max Speed: <strong style={{ color: '#fff' }}>84.0 km/h</strong></div>
          <div>Duration: <strong style={{ color: '#fff' }}>26 min</strong></div>
        </div>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', position: 'relative' }} />

      {/* Floating Bottom Playback Controls */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(760px, 92%)',
          padding: '16px 24px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Progress Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
            {currentPoint.time}
          </span>
          <input
            type="range"
            min="0"
            max={sampleRoute.length - 1}
            value={currentIndex}
            onChange={handleSliderChange}
            style={{ flex: 1, accentColor: 'var(--cyan-accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {sampleRoute[sampleRoute.length - 1].time}
          </span>
        </div>

        {/* Buttons and Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                setCurrentIndex(0);
                if (markerRef.current) markerRef.current.setLngLat([sampleRoute[0].lng, sampleRoute[0].lat]);
              }}
              className="btn btn-ghost"
              style={{ padding: '6px 10px' }}
              title="Reset"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn btn-primary"
              style={{ padding: '8px 20px', gap: '8px' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Play Track'}
            </button>

            {/* Speed Multiplier */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    background: playbackSpeed === s ? 'var(--cyan-accent)' : 'rgba(255,255,255,0.05)',
                    color: playbackSpeed === s ? '#000' : '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gauge size={16} color="var(--cyan-accent)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{currentPoint.speed} km/h</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Clock size={16} />
              <span>Step {currentIndex + 1} of {sampleRoute.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
