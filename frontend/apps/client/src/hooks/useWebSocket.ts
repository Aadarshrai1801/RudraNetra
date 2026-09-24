import { useEffect, useRef, useState, useCallback } from 'react';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const updatePosition = useVehicleStore((state) => state.updatePosition);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host =
      window.location.port !== '8080' && window.location.hostname === 'localhost'
        ? 'localhost:8080'
        : window.location.host;

    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (user?.company_id) params.set('company_id', String(user.company_id));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const wsUrl = `${protocol}//${host}/ws/tracking${qs}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to all updates for this company
      ws.send(JSON.stringify({ action: 'subscribe_all' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'position' || msg.lat !== undefined) {
          const payload = msg.payload || msg;
          const pos: VehiclePosition = {
            device_id: payload.device_id,
            reg_number: payload.reg_number || `DEV-${payload.device_id}`,
            lat: payload.lat,
            lng: payload.lng,
            speed: payload.speed || 0,
            heading: payload.heading || 0,
            ignition: Boolean(payload.ignition),
            status:
              payload.status ||
              (payload.speed > 2
                ? 'moving'
                : payload.ignition
                ? 'idle'
                : 'stopped'),
            timestamp: payload.timestamp || new Date().toISOString(),
            odometer: payload.odometer,
            temperature: payload.temperature,
          };
          updatePosition(pos);
        }
      } catch (err) {
        console.error('Failed to parse WS telemetry message', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 4 seconds
      setTimeout(connect, 4000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
      ws.close();
    };
  }, [updatePosition, token, user?.company_id]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
