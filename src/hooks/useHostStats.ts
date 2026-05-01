import { useState, useCallback, useEffect, useRef } from 'react';

export interface McuStats {
  name: string;
  temperature: number | null;
  lastEventTime: number;
}

export interface HostStats {
  cpuTemp: number | null;
  cpuUsage: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  hostname: string;
  distribution: string;
  cpuModel: string;
  cpuCount: number;
  uptime: number;
  mcus: McuStats[];
}

const defaultStats: HostStats = {
  cpuTemp: null,
  cpuUsage: 0,
  memUsed: 0,
  memTotal: 0,
  diskUsed: 0,
  diskTotal: 0,
  hostname: '',
  distribution: '',
  cpuModel: '',
  cpuCount: 0,
  uptime: 0,
  mcus: [],
};

export function useHostStats(apiBase: string | undefined, pollInterval = 5000) {
  const [stats, setStats] = useState<HostStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const apiRef = useRef(apiBase);
  apiRef.current = apiBase;

  const load = useCallback(async () => {
    const base = apiRef.current?.replace(/\/+$/, '');
    if (!base) return;

    try {
      const [procRes, infoRes, printerInfoRes, mcuRes] = await Promise.all([
        fetch(`${base}/machine/proc_stats`),
        fetch(`${base}/machine/system_info`),
        fetch(`${base}/printer/info`).catch(() => null),
        fetch(`${base}/printer/objects/query?mcu`).catch(() => null),
      ]);

      let cpuUsage = 0;
      let cpuTemp: number | null = null;
      let memUsedProc = 0;
      let uptimeProc = 0;

      if (procRes.ok) {
        const proc = await procRes.json();
        const r = proc.result;
        cpuTemp = r?.throttled_state?.temperature ?? r?.cpu_temp ?? null;
        const mStats = r?.moonraker_stats;
        if (Array.isArray(mStats) && mStats.length > 0) {
          cpuUsage = mStats[mStats.length - 1].cpu_usage ?? 0;
          memUsedProc = mStats[mStats.length - 1].memory ?? 0;
        }
        const sysCpu = r?.system_cpu_usage;
        if (sysCpu && typeof sysCpu === 'object') {
          const vals = Object.values(sysCpu) as number[];
          if (vals.length > 0) cpuUsage = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
        // system_memory from proc_stats (newer Moonraker)
        const sysMem = r?.system_memory;
        if (sysMem && typeof sysMem === 'object') {
          if (sysMem.total) {
            // system_memory is in kB
            const total = (sysMem.total ?? 0) * 1024;
            const used = (sysMem.used ?? ((sysMem.total ?? 0) - (sysMem.available ?? sysMem.avail ?? 0))) * 1024;
            if (total > 0) {
              memUsedProc = used; // override with system-level
            }
          }
        }
        // system_uptime from proc_stats
        const sysUp = r?.system_uptime;
        if (sysUp && typeof sysUp === 'number' && sysUp > 0) {
          uptimeProc = sysUp;
        }
      }

      let memUsed = 0, memTotal = 0, diskUsed = 0, diskTotal = 0;
      let hostname = '', distribution = '', cpuModel = '', cpuCount = 0, uptime = 0;

      if (infoRes.ok) {
        const info = await infoRes.json();
        const si = info.result?.system_info ?? info.result;
        if (si) {
          const cpu = si.cpu_info;
          if (cpu) {
            cpuModel = cpu.cpu_desc ?? cpu.cpu ?? cpu.processor ?? cpu.model ?? '';
            cpuCount = cpu.cpu_count ?? 0;
            // total_memory is in kB in cpu_info
            if (cpu.total_memory && cpu.total_memory > 0) {
              memTotal = cpu.total_memory * 1024;
            }
          }

          hostname = si.hostname ?? cpu?.processor ?? '';
          const dist = si.distribution;
          distribution = dist ? `${dist.name || ''} ${dist.version || ''}`.trim() : '';

          // Some Moonraker versions have a separate memory object
          const mem = si.memory;
          if (mem) {
            const t = mem.total ?? 0;
            if (t > 0) {
              memTotal = t * 1024; // kB to bytes
              memUsed = (t - (mem.available ?? mem.avail ?? mem.free ?? 0)) * 1024;
            }
          }

          const sd = si.sd_info;
          if (sd) {
            diskTotal = sd.total_bytes ?? 0;
            diskUsed = (sd.total_bytes ?? 0) - (sd.free_bytes ?? 0);
          }

          uptime = si.uptime ?? 0;
        }
      }

      // Fallback uptime from proc_stats
      if (uptime === 0 && uptimeProc > 0) {
        uptime = uptimeProc;
      }

      // If we still have no memUsed but got it from proc_stats
      if (memUsed === 0 && memUsedProc > 0 && memTotal > 0) {
        memUsed = memUsedProc; // already in bytes from system_memory conversion above
      }

      // Fallback: get hostname from /printer/info
      if (!hostname && printerInfoRes && printerInfoRes.ok) {
        try {
          const pi = await printerInfoRes.json();
          hostname = pi.result?.hostname ?? '';
        } catch { /* ignore */ }
      }

      // Parse MCU temps
      const mcus: McuStats[] = [];
      if (mcuRes && mcuRes.ok) {
        try {
          const mcuData = await mcuRes.json();
          const status = mcuData.result?.status;
          if (status) {
            for (const [key, val] of Object.entries(status)) {
              if (key.startsWith('mcu') || key === 'mcu') {
                const v = val as any;
                mcus.push({
                  name: key === 'mcu' ? 'MCU' : key.replace('mcu ', ''),
                  temperature: v?.last_stats?.mcu_temp ?? v?.mcu_temp ?? null,
                  lastEventTime: v?.last_stats?.last_event_time ?? 0,
                });
              }
            }
          }
        } catch { /* ignore */ }
      }

      setStats({ cpuTemp, cpuUsage, memUsed, memTotal, diskUsed, diskTotal, hostname, distribution, cpuModel, cpuCount, uptime, mcus });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!apiBase) return;
    load();
    const id = setInterval(load, pollInterval);
    return () => clearInterval(id);
  }, [apiBase, pollInterval, load]);

  return { stats, loading, reload: load };
}
