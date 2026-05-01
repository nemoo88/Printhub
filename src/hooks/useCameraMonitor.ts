import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraMonitorOptions {
  /** HTTP API base for the printer Moonraker (e.g. http://192.168.1.215:7125) */
  apiBase: string;
  /** How often to re-send camera.start_monitor (ms). Default 60000 */
  keepAliveInterval?: number;
  /** Whether the monitor should be active */
  enabled?: boolean;
}

/**
 * Keeps the Snapmaker camera alive by:
 * 1. Querying /server/webcams/list for the snapshot URL
 * 2. Sending camera.start_monitor via WebSocket JSON-RPC (required by Snapmaker)
 * 3. Re-sending every keepAliveInterval to prevent 3-min sleep
 */
export function useCameraMonitor({ apiBase, keepAliveInterval = 60_000, enabled = true }: CameraMonitorOptions) {
  const [snapshotUrl, setSnapshotUrl] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Derive WS URL from API base
  const wsUrl = (() => {
    if (!apiBase) return '';
    const base = apiBase.replace(/\/+$/, '');
    if (base.startsWith('https://')) return base.replace('https://', 'wss://') + '/websocket';
    if (base.startsWith('http://')) return base.replace('http://', 'ws://') + '/websocket';
    return '';
  })();

  // Fetch webcam list to get snapshot URL
  useEffect(() => {
    if (!enabled || !apiBase) return;
    const base = apiBase.replace(/\/+$/, '');

    (async () => {
      try {
        const res = await fetch(`${base}/server/webcams/list`);
        if (!res.ok) return;
        const data = await res.json();
        const webcams = data?.result?.webcams;
        if (Array.isArray(webcams) && webcams.length > 0) {
          const cam = webcams[0];
          const url = cam.snapshot_url || cam.stream_url || '';
          if (url) {
            // If relative, prepend origin
            const origin = new URL(base).origin;
            setSnapshotUrl(url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`);
          }
        }
      } catch { /* ignore — will use default path */ }
    })();
  }, [apiBase, enabled]);

  const sendStartCommand = useCallback((ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      id: Date.now(),
      jsonrpc: '2.0',
      method: 'camera.start_monitor',
      params: { domain: 'lan', interval: 0 },
    }));
  }, []);

  useEffect(() => {
    if (!enabled || !wsUrl) {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      clearInterval(intervalRef.current);
      setConnected(false);
      return;
    }

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (disposed) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (disposed) { ws.close(); return; }
          setConnected(true);
          sendStartCommand(ws);
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            if (enabledRef.current) sendStartCommand(ws);
          }, keepAliveInterval);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const result = data?.result;
            if (result?.url) setSnapshotUrl(result.url);
            if (result?.data?.url) setSnapshotUrl(result.data.url);
          } catch { /* non-JSON */ }
        };

        ws.onclose = () => {
          setConnected(false);
          clearInterval(intervalRef.current);
          wsRef.current = null;
          if (!disposed) reconnectTimer = setTimeout(connect, 5_000);
        };

        ws.onerror = () => { ws.close(); };
      } catch {
        if (!disposed) reconnectTimer = setTimeout(connect, 5_000);
      }
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      clearInterval(intervalRef.current);
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              id: Date.now(),
              jsonrpc: '2.0',
              method: 'camera.stop_monitor',
              params: { domain: 'lan' },
            }));
          }
        } catch { /* ignore */ }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [wsUrl, enabled, keepAliveInterval, sendStartCommand]);

  return { snapshotUrl, connected };
}
