import { useState, useCallback, useRef, useEffect } from 'react';
import { type AceConfig, getPrinterWebSocketUrl } from '@/config/ace-config';

export interface HeaterStatus {
  name: string;
  temperature: number;
  target: number;
  power: number;
}

export interface FilamentMeta {
  material: string;
  materials: string[]; // per-tool material types parsed from slicer metadata
  color: string;
  colors: string[]; // per-tool colors parsed from slicer metadata
  spoolIds: number[]; // per-tool Spoolman spool IDs from slicer (e.g. OrcaSlicer)
  name: string;
  weight: number;
}

export interface PrintJobStatus {
  state: string;
  filename: string;
  progress: number;
  totalDuration: number;
  printDuration: number;
  filamentUsed: number;
  message: string;
  filamentMeta?: FilamentMeta;
  estimatedTime?: number; // slicer estimated total time in seconds
}

export interface FanStatus {
  name: string;
  speed: number;
}

export interface PrinterState {
  connected: boolean;
  heaters: HeaterStatus[];
  fans: FanStatus[];
  job: PrintJobStatus;
  speedFactor: number;
  extrudeFactor: number;
  activeTool: number;
}

const defaultJob: PrintJobStatus = {
  state: 'standby',
  filename: '',
  progress: 0,
  totalDuration: 0,
  printDuration: 0,
  filamentUsed: 0,
  message: '',
};

const PRINTER_OBJECTS = {
  'heaters': null,
  'extruder': null,
  'extruder1': null,
  'extruder2': null,
  'extruder3': null,
  'heater_bed': null,
  'heater_generic cavity': null,
  'fan': null,
  'fan_generic part_fan': null,
  'fan_generic cavity_fan': null,
  'controller_fan': null,
  'print_stats': null,
  'display_status': null,
  'virtual_sdcard': null,
  'gcode_move': null,
  'toolhead': null,
};

export function usePrinterStatus(config: AceConfig) {
  const [state, setState] = useState<PrinterState>({
    connected: false,
    heaters: [],
    fans: [],
    job: { ...defaultJob },
    speedFactor: 1,
    extrudeFactor: 1,
    activeTool: -1,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const parseStatusData = useCallback((data: Record<string, any>) => {
    setState(prev => {
      const heaters = [...prev.heaters];
      const fans = [...prev.fans];
      let job = { ...prev.job };
      let speedFactor = prev.speedFactor;
      let extrudeFactor = prev.extrudeFactor;

      // Parse heaters
      const heaterNames = ['extruder', 'extruder1', 'extruder2', 'extruder3', 'heater_bed', 'heater_generic cavity'];
      for (const name of heaterNames) {
        const hData = data[name];
        if (hData && typeof hData === 'object') {
          const displayName = name.replace('heater_generic ', '').replace('extruder', 'Extruder');
          const idx = heaters.findIndex(h => h.name === displayName);
          const heater: HeaterStatus = {
            name: displayName,
            temperature: hData.temperature ?? (idx >= 0 ? heaters[idx].temperature : 0),
            target: hData.target ?? (idx >= 0 ? heaters[idx].target : 0),
            power: hData.power ?? (idx >= 0 ? heaters[idx].power : 0),
          };
          if (idx >= 0) heaters[idx] = heater;
          else heaters.push(heater);
        }
      }

      // Parse fans
      const fanNames = ['fan', 'fan_generic part_fan', 'fan_generic cavity_fan', 'controller_fan'];
      for (const name of fanNames) {
        const fData = data[name];
        if (fData && typeof fData === 'object') {
          const displayName = name === 'fan' ? 'Part Fan' : name.replace('fan_generic ', '').replace('controller_fan', 'Controller Fan').replace('_', ' ');
          const idx = fans.findIndex(f => f.name === displayName);
          if (fData.speed !== undefined) {
            const rawSpeed = fData.speed as number;
            const pctSpeed = rawSpeed <= 1 ? rawSpeed * 100 : rawSpeed;
            const fan: FanStatus = { name: displayName, speed: pctSpeed };
            if (idx >= 0) fans[idx] = fan;
            else fans.push(fan);
          }
        }
      }

      // Parse print stats
      const ps = data['print_stats'];
      if (ps && typeof ps === 'object') {
        job = {
          state: ps.state ?? job.state,
          filename: ps.filename ?? job.filename,
          progress: job.progress,
          totalDuration: ps.total_duration ?? job.totalDuration,
          printDuration: ps.print_duration ?? job.printDuration,
          filamentUsed: ps.filament_used ?? job.filamentUsed,
          message: ps.message ?? job.message,
        };
      }

      // Parse virtual_sdcard for progress
      const vsd = data['virtual_sdcard'];
      if (vsd && typeof vsd === 'object') {
        job.progress = (vsd.progress ?? job.progress) * 100;
      }

      // Parse display_status for progress fallback
      const ds = data['display_status'];
      if (ds && typeof ds === 'object' && ds.progress !== undefined) {
        job.progress = (ds.progress as number) * 100;
      }

      // Parse gcode_move for speed/extrude factors
      const gm = data['gcode_move'];
      if (gm && typeof gm === 'object') {
        speedFactor = gm.speed_factor ?? speedFactor;
        extrudeFactor = gm.extrude_factor ?? extrudeFactor;
      }

      // Parse toolhead for active tool
      let activeTool = prev.activeTool;
      const th = data['toolhead'];
      if (th && typeof th === 'object' && th.extruder) {
        const toolStr = th.extruder as string;
        const match = toolStr.match(/extruder(\d*)/);
        activeTool = match ? (match[1] ? parseInt(match[1]) : 0) : -1;
      }

      return { ...prev, heaters, fans, job, speedFactor, extrudeFactor, activeTool };
    });
  }, []);

  const fetchFilamentMeta = useCallback(async (filename: string) => {
    const apiBase = configRef.current.printerApiBase;
    if (!apiBase || !filename) return;
    try {
      const res = await fetch(`${apiBase}/server/files/metadata?filename=${encodeURIComponent(filename)}`);
      if (!res.ok) return;
      const data = await res.json();
      const meta = data.result;
      if (meta) {
        const rawColor = meta.filament_color || '';
        const colors = rawColor.split(/[;,]/).map((c: string) => c.trim().replace('#', '')).filter(Boolean);
        // Parse per-tool material types from slicer metadata
        const rawMaterial = meta.filament_type || meta.slicer_filament_type || '';
        const materials = String(rawMaterial).split(/[;,]/).map((m: string) => m.trim()).filter(Boolean);
        // Parse Spoolman spool IDs from slicer metadata (OrcaSlicer sends these)
        // OrcaSlicer: filament_ids or spoolman_spool_id; PrusaSlicer: filament_spool_id
        const rawSpoolIds = meta.filament_ids || meta.spoolman_spool_id || meta.filament_spool_id || meta.spool_ids || '';
        const spoolIds = String(rawSpoolIds).split(/[;,]/).map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n) && n > 0);
        console.log('Slicer metadata — spoolIds:', spoolIds, 'colors:', colors, 'materials:', materials, 'raw fields:', { filament_ids: meta.filament_ids, spoolman_spool_id: meta.spoolman_spool_id, filament_spool_id: meta.filament_spool_id });
        const filamentMeta: FilamentMeta = {
          material: rawMaterial,
          materials,
          color: rawColor,
          colors,
          spoolIds,
          name: meta.filament_name || '',
          weight: meta.filament_weight_total || meta.filament_total || 0,
        };
        const estimatedTime = meta.estimated_time ? Number(meta.estimated_time) : undefined;
        setState(prev => ({
          ...prev,
          job: { ...prev.job, filamentMeta, estimatedTime },
        }));
      }
    } catch (e) {
      console.error('Filament meta fetch error:', e);
    }
  }, []);

  const lastMetaFilename = useRef('');

  const loadFullStatus = useCallback(async () => {
    const apiBase = configRef.current.printerApiBase;
    if (!apiBase) return;
    try {
      const objectsQuery = Object.keys(PRINTER_OBJECTS).join('&');
      const response = await fetch(`${apiBase}/printer/objects/query?${objectsQuery}`);
      if (!response.ok) return;
      const result = await response.json();
      if (result.result?.status) {
        parseStatusData(result.result.status);
        const fn = result.result.status?.print_stats?.filename;
        if (fn && fn !== lastMetaFilename.current) {
          lastMetaFilename.current = fn;
          fetchFilamentMeta(fn);
        }
      }
    } catch (e) {
      console.error('Printer status load error:', e);
    }
  }, [parseStatusData, fetchFilamentMeta]);

  const sendGcode = useCallback(async (gcode: string): Promise<{ ok: boolean; response: string }> => {
    const apiBase = configRef.current.printerApiBase;
    if (!apiBase) return { ok: false, response: 'No printer API configured' };
    try {
      const response = await fetch(`${apiBase}/printer/gcode/script?script=${encodeURIComponent(gcode)}`, { method: 'POST' });
      if (!response.ok) return { ok: false, response: `HTTP ${response.status}` };
      return { ok: true, response: 'OK' };
    } catch (e) {
      return { ok: false, response: (e as Error).message };
    }
  }, []);

  const setHeaterTemp = useCallback(async (heaterName: string, target: number) => {
    let gcode: string;
    if (heaterName.toLowerCase().includes('bed')) {
      gcode = `SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=${target}`;
    } else if (heaterName.toLowerCase().includes('cavity')) {
      gcode = `SET_HEATER_TEMPERATURE HEATER="heater_generic cavity" TARGET=${target}`;
    } else {
      // Use SET_HEATER_TEMPERATURE instead of T<n> + M104 to avoid triggering a tool change during print
      const idx = heaterName.replace('Extruder', '').trim();
      const heater = idx ? `extruder${idx}` : 'extruder';
      gcode = `SET_HEATER_TEMPERATURE HEATER=${heater} TARGET=${target}`;
    }
    return sendGcode(gcode);
  }, [sendGcode]);

  const setFanSpeed = useCallback(async (fanName: string, speed: number) => {
    const pct = Math.round(speed * 2.55);
    let gcode: string;
    if (fanName === 'Part Fan') {
      gcode = `M106 S${pct}`;
    } else {
      gcode = `SET_FAN_SPEED FAN=${fanName.replace(/ /g, '_').toLowerCase()} SPEED=${(speed / 100).toFixed(2)}`;
    }
    return sendGcode(gcode);
  }, [sendGcode]);

  // WebSocket connection
  useEffect(() => {
    const apiBase = config.printerApiBase;
    if (!apiBase) return;

    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const wsUrl = getPrinterWebSocketUrl(configRef.current);
      if (!wsUrl) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (error) {
        setState(prev => ({ ...prev, connected: false }));
        reconnectTimer = setTimeout(connect, configRef.current.wsReconnectTimeout);
        console.warn('Printer WebSocket connect failed:', (error as Error).message);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setState(prev => ({ ...prev, connected: true }));
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'printer.objects.subscribe',
          params: { objects: PRINTER_OBJECTS },
          id: 9999,
        }));
        loadFullStatus();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.method === 'notify_status_update') {
            const statusData = data.params?.[0];
            if (statusData) {
              parseStatusData(statusData);
              const fn = statusData.print_stats?.filename;
              if (fn && fn !== lastMetaFilename.current) {
                lastMetaFilename.current = fn;
                fetchFilamentMeta(fn);
              }
            }
          }
        } catch (e) {
          console.error('Printer WS parse error:', e);
        }
      };

      ws.onerror = () => setState(prev => ({ ...prev, connected: false }));
      ws.onclose = () => {
        setState(prev => ({ ...prev, connected: false }));
        reconnectTimer = setTimeout(connect, configRef.current.wsReconnectTimeout);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [config.printerApiBase, loadFullStatus, parseStatusData, fetchFilamentMeta]);

  return { ...state, sendGcode, setHeaterTemp, setFanSpeed, loadFullStatus };
}
