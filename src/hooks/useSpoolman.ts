import { useState, useCallback, useEffect, useRef } from 'react';
import { saveActiveSpoolToMoonraker, loadActiveSpoolFromMoonraker, saveToolSpoolMapToMoonraker, loadToolSpoolMapFromMoonraker } from '@/config/ace-config';

export interface SpoolmanVendor {
  id: number;
  name: string;
}

export interface SpoolmanFilament {
  id: number;
  name?: string;
  material?: string;
  color_hex?: string;
  density: number;
  diameter: number;
  weight?: number;
  vendor?: SpoolmanVendor;
}

export interface SpoolmanSpool {
  id: number;
  filament: SpoolmanFilament;
  remaining_weight?: number;
  used_weight?: number;
  remaining_length?: number;
  used_length?: number;
  first_used?: string;
  last_used?: string;
  location?: string;
  comment?: string;
  archived: boolean;
}

/**
 * Spoolman hook — auto-detects via Moonraker proxy first,
 * only falls back to direct URL if Moonraker has no spoolman configured.
 */
export function useSpoolman(moonrakerApiBase: string, spoolmanUrl?: string, printerApiBase?: string) {
  const [spools, setSpools] = useState<SpoolmanSpool[]>([]);
  const [vendors, setVendors] = useState<SpoolmanVendor[]>([]);
  const [filaments, setFilaments] = useState<SpoolmanFilament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSpoolId, setActiveSpoolIdState] = useState<number | null>(null);
  const [toolSpoolMap, setToolSpoolMapState] = useState<Record<number, number>>({});
  // null = not checked yet, true/false = checked
  const [spoolmanConnected, setSpoolmanConnected] = useState<boolean | null>(null);
  const [spoolmanDirectUrl, setSpoolmanDirectUrl] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const connectedMoonrakerRef = useRef('');

  const moonraker = moonrakerApiBase.replace(/\/+$/, '');
  const directUrl = spoolmanUrl?.replace(/\/+$/, '') || '';

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load active spool + tool-spool map from Moonraker on mount
  useEffect(() => {
    if (moonraker) {
      const fallback = (printerApiBase || '').replace(/\/+$/, '');
      loadActiveSpoolFromMoonraker(moonraker, fallback).then(id => {
        if (mountedRef.current && id !== null) setActiveSpoolIdState(id);
      });
      loadToolSpoolMapFromMoonraker(moonraker, fallback).then(map => {
        if (mountedRef.current && map !== null) setToolSpoolMapState(map);
      });
    }
  }, [moonraker]);

  const printerMoonraker = (printerApiBase || '').replace(/\/+$/, '');

  // Check if Spoolman is available via Moonraker proxy — retries on failure
  useEffect(() => {
    if (!moonraker && !printerMoonraker) {
      setSpoolmanConnected(false);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const tryMoonraker = async (base: string): Promise<boolean> => {
      try {
        const res = await fetch(`${base}/server/spoolman/status`);
        if (!res.ok) return false;
        const data = await res.json();
        return !!data?.result?.spoolman_connected;
      } catch {
        return false;
      }
    };

    const attempt = async (retries: number) => {
      if (cancelled) return;
      const bases = [moonraker, printerMoonraker].filter(Boolean);
      for (const base of bases) {
        if (await tryMoonraker(base)) {
          if (cancelled) return;
          setSpoolmanConnected(true);
          connectedMoonrakerRef.current = base;
          try {
            const cfgRes = await fetch(`${base}/server/config`);
            if (cfgRes.ok) {
              const cfgData = await cfgRes.json();
              let spoolmanServer = cfgData?.result?.config?.spoolman?.server;
              if (spoolmanServer && !cancelled) {
                try {
                  const moonrakerHost = new URL(base).hostname;
                  const spoolmanParsed = new URL(spoolmanServer);
                  if (spoolmanParsed.hostname === 'localhost' || spoolmanParsed.hostname === '127.0.0.1') {
                    spoolmanParsed.hostname = moonrakerHost;
                    spoolmanServer = spoolmanParsed.toString().replace(/\/+$/, '');
                  }
                } catch {}
                setSpoolmanDirectUrl(spoolmanServer);
              }
            }
          } catch {}
          return;
        }
      }
      // Not connected yet — retry with back-off (5s, 10s, 15s, 20s, 30s ...)
      if (!cancelled && retries > 0) {
        const delay = Math.min((6 - retries) * 5000, 30000);
        retryTimer = setTimeout(() => attempt(retries - 1), delay);
      } else if (!cancelled) {
        setSpoolmanConnected(false);
      }
    };

    attempt(5);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [moonraker, printerMoonraker]);

  // Use Moonraker proxy for all API calls
  const api = useCallback(async (path: string, options?: RequestInit) => {
    const proxyBase = connectedMoonrakerRef.current || moonraker;
    const method = (options?.method || 'GET').toUpperCase();

    try {
      if (spoolmanConnected && proxyBase) {
        const proxyUrl = `${proxyBase}/server/spoolman/proxy`;
        const body: Record<string, unknown> = {
          use_v2_response: true,
          request_method: method,
          path: `/v1${path}`,
        };
        if (options?.body) {
          body.body = JSON.parse(options.body as string);
        }

        const res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(text || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const result = data?.result ?? data;

        // v2 proxy response: { response, error }
        if (result?.error) {
          throw new Error(result.error?.message || `Spoolman error (${result.error?.status_code ?? 'unknown'})`);
        }

        const response = result?.response ?? result;
        if (typeof response === 'string') {
          try {
            return JSON.parse(response);
          } catch {
            return response;
          }
        }
        return response;
      }

      if (directUrl) {
        const url = `${directUrl}/api/v1${path}`;
        const headers = new Headers(options?.headers ?? {});
        const hasBody = options?.body != null && method !== 'GET' && method !== 'HEAD';

        // Avoid unnecessary preflight on GET/HEAD (helps older Spoolman CORS behavior)
        if (hasBody && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        const res = await fetch(url, {
          ...options,
          method,
          headers,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(text || `HTTP ${res.status}`);
        }

        if (res.status === 204) return null;
        return res.json();
      }
    } catch (e) {
      if (directUrl && e instanceof TypeError) {
        throw new Error('Spoolman direct URL blocked by CORS. Leave Spoolman URL empty and use Moonraker proxy, or enable CORS on Spoolman.');
      }
      throw e;
    }

    throw new Error('Spoolman not configured');
  }, [moonraker, directUrl, spoolmanConnected]);

  // Only available after status check completes
  const isAvailable = spoolmanConnected === true || (spoolmanConnected === false && !!directUrl);
  const statusChecked = spoolmanConnected !== null;

  const loadSpools = useCallback(async () => {
    if (!isAvailable) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api('/spool');
      const arr = Array.isArray(data) ? data : [];
      if (mountedRef.current) setSpools(arr.filter((s: SpoolmanSpool) => !s.archived));
    } catch (e: any) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api, isAvailable]);

  const loadVendors = useCallback(async () => {
    if (!isAvailable) return;
    try {
      const data = await api('/vendor');
      if (mountedRef.current) setVendors(Array.isArray(data) ? data : []);
    } catch {}
  }, [api, isAvailable]);

  const loadFilaments = useCallback(async () => {
    if (!isAvailable) return;
    try {
      const data = await api('/filament');
      if (mountedRef.current) setFilaments(Array.isArray(data) ? data : []);
    } catch {}
  }, [api, isAvailable]);

  const reload = useCallback(async () => {
    await Promise.all([loadSpools(), loadVendors(), loadFilaments()]);
  }, [loadSpools, loadVendors, loadFilaments]);

  // Only load data AFTER status check completes, then poll every 30s
  useEffect(() => {
    if (statusChecked && isAvailable) reload();
  }, [statusChecked, isAvailable, reload]);

  useEffect(() => {
    if (!statusChecked || !isAvailable) return;
    const interval = setInterval(() => {
      loadSpools();
    }, 30000);
    return () => clearInterval(interval);
  }, [statusChecked, isAvailable, loadSpools]);

  const ensureVendor = useCallback(async (name: string): Promise<number> => {
    const existing = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const created = await api('/vendor', { method: 'POST', body: JSON.stringify({ name }) });
    if (mountedRef.current) setVendors(prev => [...prev, created]);
    return created.id;
  }, [api, vendors]);

  const ensureFilament = useCallback(async (opts: {
    vendorId: number;
    material: string;
    colorHex: string;
    weight: number;
    density?: number;
    diameter?: number;
  }): Promise<number> => {
    const existing = filaments.find(f =>
      f.vendor?.id === opts.vendorId &&
      f.material?.toUpperCase() === opts.material.toUpperCase() &&
      f.color_hex?.toLowerCase() === opts.colorHex.replace('#', '').toLowerCase()
    );
    if (existing) return existing.id;
    const body: Record<string, unknown> = {
      vendor_id: opts.vendorId,
      material: opts.material,
      color_hex: opts.colorHex.replace('#', ''),
      weight: opts.weight,
      density: opts.density ?? 1.24,
      diameter: opts.diameter ?? 1.75,
    };
    const created = await api('/filament', { method: 'POST', body: JSON.stringify(body) });
    if (mountedRef.current) setFilaments(prev => [...prev, created]);
    return created.id;
  }, [api, filaments]);

  const addSpool = useCallback(async (opts: {
    vendorName: string;
    material: string;
    colorHex: string;
    weightTotal: number;
    location?: string;
    comment?: string;
  }) => {
    const vendorId = await ensureVendor(opts.vendorName);
    const filamentId = await ensureFilament({
      vendorId,
      material: opts.material,
      colorHex: opts.colorHex,
      weight: opts.weightTotal,
    });
    await api('/spool', {
      method: 'POST',
      body: JSON.stringify({
        filament_id: filamentId,
        location: opts.location || undefined,
        comment: opts.comment || undefined,
      }),
    });
    await loadSpools();
  }, [api, ensureVendor, ensureFilament, loadSpools]);

  const deleteSpool = useCallback(async (id: number) => {
    await api(`/spool/${id}`, { method: 'DELETE' });
    if (mountedRef.current) setSpools(prev => prev.filter(s => s.id !== id));
    if (activeSpoolId === id) {
      setActiveSpoolIdState(null);
      saveActiveSpoolToMoonraker(moonraker, null, (printerApiBase || '').replace(/\/+$/, ''));
    }
    // Remove from tool-spool map if mapped
    setToolSpoolMapState(prev => {
      const updated = { ...prev };
      let changed = false;
      for (const [tool, spoolId] of Object.entries(updated)) {
        if (spoolId === id) { delete updated[Number(tool)]; changed = true; }
      }
      if (changed) saveToolSpoolMapToMoonraker(moonraker, updated, (printerApiBase || '').replace(/\/+$/, ''));
      return changed ? updated : prev;
    });
  }, [api, activeSpoolId, moonraker, printerApiBase]);

  const updateSpool = useCallback(async (id: number, updates: Record<string, unknown>) => {
    await api(`/spool/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    await loadSpools();
  }, [api, loadSpools]);

  const useFilament = useCallback(async (id: number, useLengthMm: number) => {
    await api(`/spool/${id}/use`, {
      method: 'PUT',
      body: JSON.stringify({ use_length: useLengthMm }),
    });
    await loadSpools();
  }, [api, loadSpools]);

  const setActiveSpool = useCallback((id: number | null) => {
    setActiveSpoolIdState(id);
    saveActiveSpoolToMoonraker(moonraker, id, (printerApiBase || '').replace(/\/+$/, ''));
  }, [moonraker, printerApiBase]);

  const setToolSpool = useCallback((toolIndex: number, spoolId: number | null) => {
    setToolSpoolMapState(prev => {
      const updated = { ...prev };
      if (spoolId === null) {
        delete updated[toolIndex];
      } else {
        updated[toolIndex] = spoolId;
      }
      saveToolSpoolMapToMoonraker(moonraker, updated, (printerApiBase || '').replace(/\/+$/, ''));
      return updated;
    });
  }, [moonraker, printerApiBase]);

  const getSpoolForTool = useCallback((toolIndex: number): number | null => {
    return toolSpoolMap[toolIndex] ?? null;
  }, [toolSpoolMap]);

  return {
    spools, vendors, filaments, loading, error,
    activeSpoolId, setActiveSpool,
    toolSpoolMap, setToolSpool, getSpoolForTool,
    addSpool, deleteSpool, updateSpool, useFilament,
    reload,
    spoolmanConnected: spoolmanConnected === true,
    spoolmanWebUrl: spoolmanDirectUrl || directUrl || null,
    isAvailable,
  };
}
