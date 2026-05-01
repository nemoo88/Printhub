import { useState, useCallback, useRef, useEffect } from 'react';
import { type AceConfig, getWebSocketUrl } from '@/config/ace-config';
import { toast } from 'sonner';
import { t, type Language } from '@/lib/ace-translations';

export interface DeviceStatus {
  status: string;
  model: string;
  firmware: string;
  temp: number;
  fan_speed: number;
  enable_rfid: number;
}

export interface DryerStatus {
  status: string;
  target_temp: number;
  duration: number;
  remain_time: number;
}

export interface SlotData {
  index: number;
  status: string;
  type: string;
  color: number[];
  sku: string;
  rfid: number;
}

export function useAceStatus(config: AceConfig, lang: Language) {
  const [wsConnected, setWsConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ status: 'unknown', model: '', firmware: '', temp: 0, fan_speed: 0, enable_rfid: 0 });
  const [dryerStatus, setDryerStatus] = useState<DryerStatus>({ status: 'stop', target_temp: 0, duration: 0, remain_time: 0 });
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [feedAssistSlot, setFeedAssistSlot] = useState(-1);
  const [currentTool, setCurrentTool] = useState(-1);

  const wsRef = useRef<WebSocket | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;
  const configRef = useRef(config);
  configRef.current = config;

  const updateStatus = useCallback((data: Record<string, unknown>) => {
    if (!data || typeof data !== 'object') return;

    setDeviceStatus(prev => ({
      status: (data.status as string) ?? prev.status,
      model: (data.model as string) ?? prev.model,
      firmware: (data.firmware as string) ?? prev.firmware,
      temp: (data.temp as number) ?? prev.temp,
      fan_speed: (data.fan_speed as number) ?? prev.fan_speed,
      enable_rfid: (data.enable_rfid as number) ?? prev.enable_rfid,
    }));

    const dryer = (data.dryer || data.dryer_status) as Record<string, unknown> | undefined;
    if (dryer && typeof dryer === 'object') {
      setDryerStatus(prev => {
        let remain_time = dryer.remain_time !== undefined ? (dryer.remain_time as number) : prev.remain_time;
        const duration = dryer.duration !== undefined ? Math.floor(dryer.duration as number) : prev.duration;
        if (remain_time > 1440) remain_time = remain_time / 60;
        else if (duration > 0 && remain_time > duration * 1.5 && remain_time > 60) remain_time = remain_time / 60;
        return {
          status: (dryer.status as string) ?? prev.status,
          target_temp: (dryer.target_temp as number) ?? prev.target_temp,
          duration,
          remain_time,
        };
      });
    }

    if (data.slots !== undefined && Array.isArray(data.slots)) {
      setSlots((data.slots as Record<string, unknown>[]).map(slot => ({
        index: (slot.index as number) ?? -1,
        status: (slot.status as string) || 'unknown',
        type: (slot.type as string) || '',
        color: Array.isArray(slot.color) ? (slot.color as number[]) : [0, 0, 0],
        sku: (slot.sku as string) || '',
        rfid: (slot.rfid as number) ?? 0,
      })));
    }

    if (data.feed_assist_slot !== undefined) {
      setFeedAssistSlot(data.feed_assist_slot as number);
    } else if ((data.feed_assist_count as number) > 0) {
      // keep current
    } else if (data.feed_assist_count !== undefined) {
      setFeedAssistSlot(-1);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${configRef.current.apiBase}/server/ace/status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.error) { console.error('API error:', result.error); return; }
      const statusData = result.result || result;
      if (statusData && typeof statusData === 'object' && (statusData.status !== undefined || statusData.slots !== undefined || statusData.dryer !== undefined)) {
        updateStatus(statusData);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  }, [updateStatus]);

  const executeCommand = useCallback(async (command: string, params: Record<string, unknown> = {}): Promise<boolean> => {
    try {
      const response = await fetch(`${configRef.current.apiBase}/server/ace/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
      const result = await response.json();
      if (result.error) {
        toast.error(t(langRef.current, 'notifications.apiError', { error: result.error }));
        return false;
      }
      if (result.result) {
        if (result.result.success !== false && !result.result.error) {
          toast.success(t(langRef.current, 'notifications.commandSuccess', { command }));
          setTimeout(() => loadStatus(), 1000);
          return true;
        }
        toast.error(t(langRef.current, 'notifications.commandError', { error: result.result.error || result.result.message || '' }));
        return false;
      }
      toast.success(t(langRef.current, 'notifications.commandSent', { command }));
      setTimeout(() => loadStatus(), 1000);
      return true;
    } catch (error) {
      toast.error(t(langRef.current, 'notifications.executeError', { error: (error as Error).message }));
      return false;
    }
  }, [loadStatus]);

  // WebSocket
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let refreshTimer: ReturnType<typeof setInterval>;

    function connect() {
      const wsUrl = getWebSocketUrl(configRef.current);
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (error) {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, configRef.current.wsReconnectTimeout);
        console.warn('ACE WebSocket connect failed:', (error as Error).message);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "printer.objects.subscribe", params: { objects: { ace: null } }, id: 5434 }));
        loadStatus();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.method === "notify_status_update") {
            const aceData = data.params?.[0]?.ace;
            if (aceData) updateStatus(aceData);
          }
        } catch (e) { console.error('WS parse error:', e); }
      };

      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, configRef.current.wsReconnectTimeout);
      };
    }

    connect();
    refreshTimer = setInterval(() => { if (wsRef.current?.readyState === WebSocket.OPEN) loadStatus(); }, configRef.current.autoRefreshInterval);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(refreshTimer);
      wsRef.current?.close();
    };
  }, [config.apiBase, loadStatus, updateStatus]);

  return {
    wsConnected, deviceStatus, dryerStatus, slots, feedAssistSlot, setFeedAssistSlot,
    currentTool, setCurrentTool, executeCommand, loadStatus,
  };
}
