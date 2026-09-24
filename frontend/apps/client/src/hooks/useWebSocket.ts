import { useEffect, useRef, useState, useCallback } from 'react';
import { useVehicleStore, VehiclePosition } from '../store/vehicleStore';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const updatePosition = useVehicleStore((state) => state.updatePosition);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tracking`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to all updates
      ws.send(JSON.stringify({ action: 'subscribe_all' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'position' || msg.lat !== undefined) {
          const pos: VehiclePosition = {
            device_id: msg.device_id,
            reg_number: msg.reg_number || `DEV-${msg.device_id}`,
            lat: msg.lat,
            lng: msg.lng,
            speed: msg.speed || 0,
            heading: msg.heading || 0,
            ignition: Boolean(msg.ignition),
            status: msg.status || (msg.speed > 2 ? 'moving' : msg.ignition ? 'idle' : 'stopped'),
            timestamp: msg.timestamp || new Date().toISOString(),
            odometer: msg.odometer,
            temperature: msg.temperature,
          };
          updatePosition(pos);
        }
      } catch (err) {
        console.error('Failed to parse WS telemetry message', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
      ws.close();
    };
  }, [updatePosition]);

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
