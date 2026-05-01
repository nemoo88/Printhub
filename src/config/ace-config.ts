export interface AceConfig {
  apiBase: string;
  wsBase: string | null;
  printerApiBase: string;
  printerWsBase: string | null;
  fluiddUrl: string;
  cameraUrl: string;
  spoolmanUrl: string;
  autoRefreshInterval: number;
  wsReconnectTimeout: number;
  debug: boolean;
  defaults: {
    feedLength: number;
    feedSpeed: number;
    retractLength: number;
    retractSpeed: number;
    dryingTemp: number;
    dryingDuration: number;
  };
}

const STORAGE_KEY = 'ace-dashboard-config';
const MOONRAKER_NS = 'printhub';
const MOONRAKER_KEY = 'config';

const DEFAULT_CONFIG: AceConfig = {
  apiBase: 'http://192.168.1.215:7125',
  wsBase: null,
  printerApiBase: '',
  printerWsBase: null,
  fluiddUrl: '',
  cameraUrl: '',
  spoolmanUrl: '',
  autoRefreshInterval: 5000,
  wsReconnectTimeout: 3000,
  debug: false,
  defaults: {
    feedLength: 50,
    feedSpeed: 25,
    retractLength: 50,
    retractSpeed: 25,
    dryingTemp: 50,
    dryingDuration: 240,
  },
};

export interface SaveConfigResult {
  savedToMoonraker: boolean;
  savedApiBase?: string;
  cachedLocally: boolean;
  error?: string;
}

function mergeConfig(parsed: Partial<AceConfig>): AceConfig {
  return { ...DEFAULT_CONFIG, ...parsed, defaults: { ...DEFAULT_CONFIG.defaults, ...parsed?.defaults } };
}

function normalizeBase(base: string | null | undefined): string {
  return (base ?? '').trim().replace(/\/+$/, '');
}

function getCandidateApiBases(...bases: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const base of bases) {
    const normalized = normalizeBase(base);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function getRuntimeMoonrakerCandidates(): string[] {
  if (typeof window === 'undefined') return [];
  const { protocol, hostname, origin, port } = window.location;
  const candidates: string[] = [];

  if (!hostname) return candidates;

  if (port === '7125') candidates.push(origin);

  if (protocol === 'http:') {
    candidates.push(`http://${hostname}:7125`);
  }

  if (protocol === 'https:' && !hostname.endsWith('.app') && !hostname.endsWith('.dev')) {
    // Some local setups terminate TLS in front of Moonraker, others keep HTTP internally.
    candidates.push(`https://${hostname}:7125`, `http://${hostname}:7125`);
  }

  return getCandidateApiBases(...candidates);
}

function formatFetchError(apiBase: string, error: unknown): string {
  const mixedContentBlocked = typeof window !== 'undefined' && window.location.protocol === 'https:' && apiBase.startsWith('http://');
  if (mixedContentBlocked) return 'Blocked by browser: HTTPS app cannot call HTTP Moonraker URL. Open PrintHub via local HTTP URL instead.';
  return error instanceof Error ? error.message : 'Unknown error';
}

function pickNonEmpty(remoteValue: string | null | undefined, localValue: string | null | undefined): string {
  const trimmed = remoteValue?.trim();
  return trimmed ? trimmed : (localValue ?? '');
}

function mergeRemoteWithLocal(remote: AceConfig, local: AceConfig): AceConfig {
  return {
    ...remote,
    apiBase: pickNonEmpty(remote.apiBase, local.apiBase),
    printerApiBase: pickNonEmpty(remote.printerApiBase, local.printerApiBase),
    fluiddUrl: pickNonEmpty(remote.fluiddUrl, local.fluiddUrl),
    cameraUrl: pickNonEmpty(remote.cameraUrl, local.cameraUrl),
    spoolmanUrl: pickNonEmpty(remote.spoolmanUrl, local.spoolmanUrl),
    wsBase: remote.wsBase ?? local.wsBase,
    printerWsBase: remote.printerWsBase ?? local.printerWsBase,
  };
}

/** Load config from localStorage (fast, sync — used at startup) */
export function loadConfig(): AceConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return mergeConfig(JSON.parse(stored));
  } catch (e) {
    console.warn('Failed to load config from localStorage', e);
  }
  return { ...DEFAULT_CONFIG };
}

/** Load config from Moonraker database (async, supports fallback API base) */
export async function loadConfigFromMoonraker(apiBase: string, fallbackApiBase?: string): Promise<AceConfig | null> {
  const localConfig = loadConfig();
  const candidates = getCandidateApiBases(
    apiBase,
    fallbackApiBase,
    localConfig.apiBase,
    localConfig.printerApiBase,
    ...getRuntimeMoonrakerCandidates(),
  );

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/server/database/item?namespace=${MOONRAKER_NS}&key=${MOONRAKER_KEY}`);
      if (!res.ok) continue;

      const data = await res.json();
      const value = data?.result?.value;
      if (value && typeof value === 'object') {
        const remoteConfig = mergeConfig(value as Partial<AceConfig>);
        const mergedConfig = mergeRemoteWithLocal(remoteConfig, localConfig);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedConfig));
        return mergedConfig;
      }
    } catch (e) {
      console.warn(`Failed to load config from Moonraker (${base})`, formatFetchError(base, e));
    }
  }

  return null;
}

/** Save config to Moonraker database (persistent) and local cache only after successful sync */
export async function saveConfig(config: AceConfig): Promise<SaveConfigResult> {
  const candidates = getCandidateApiBases(config.apiBase, config.printerApiBase, ...getRuntimeMoonrakerCandidates());
  if (candidates.length === 0) {
    return { savedToMoonraker: false, cachedLocally: false, error: 'No Moonraker API base configured.' };
  }

  const errors: string[] = [];

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/server/database/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: MOONRAKER_NS,
          key: MOONRAKER_KEY,
          value: config,
        }),
      });

      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        return { savedToMoonraker: true, savedApiBase: base, cachedLocally: true };
      }

      const text = (await res.text().catch(() => '')) || `HTTP ${res.status}`;
      errors.push(`${base}: ${text}`);
    } catch (e) {
      errors.push(`${base}: ${formatFetchError(base, e)}`);
    }
  }

  const error = errors.join(' | ');
  console.warn('Failed to save config to Moonraker database', error);
  return { savedToMoonraker: false, cachedLocally: false, error };
}

/** Save active spool ID to Moonraker database */
export async function saveActiveSpoolToMoonraker(apiBase: string, spoolId: number | null, fallbackApiBase?: string): Promise<void> {
  const candidates = getCandidateApiBases(apiBase, fallbackApiBase, ...getRuntimeMoonrakerCandidates());

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/server/database/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: MOONRAKER_NS,
          key: 'active_spool',
          value: spoolId,
        }),
      });

      if (res.ok) return;
    } catch (e) {
      console.warn(`Failed to save active spool to Moonraker (${base})`, formatFetchError(base, e));
    }
  }
}

/** Load active spool ID from Moonraker database */
export async function loadActiveSpoolFromMoonraker(apiBase: string, fallbackApiBase?: string): Promise<number | null> {
  const candidates = getCandidateApiBases(apiBase, fallbackApiBase, ...getRuntimeMoonrakerCandidates());

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/server/database/item?namespace=${MOONRAKER_NS}&key=active_spool`);
      if (!res.ok) continue;
      const data = await res.json();
      const value = data?.result?.value;
      return typeof value === 'number' ? value : null;
    } catch (e) {
      console.warn(`Failed to load active spool from Moonraker (${base})`, formatFetchError(base, e));
    }
  }

  return null;
}

/** Save tool-to-spool mapping to Moonraker database */
export async function saveToolSpoolMapToMoonraker(apiBase: string, map: Record<number, number>, fallbackApiBase?: string): Promise<void> {
  const candidates = getCandidateApiBases(apiBase, fallbackApiBase, ...getRuntimeMoonrakerCandidates());

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/server/database/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: MOONRAKER_NS,
          key: 'tool_spool_map',
          value: map,
        }),
      });

      if (res.ok) return;
    } catch (e) {
      console.warn(`Failed to save tool-spool map to Moonraker (${base})`, formatFetchError(base, e));
    }
  }
}

/** Load tool-to-spool mapping from Moonraker database */
export async function loadToolSpoolMapFromMoonraker(apiBase: string, fallbackApiBase?: string): Promise<Record<number, number> | null> {
  const candidates = getCandidateApiBases(apiBase, fallbackApiBase, ...getRuntimeMoonrakerCandidates());

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/server/database/item?namespace=${MOONRAKER_NS}&key=tool_spool_map`);
      if (!res.ok) continue;
      const data = await res.json();
      const value = data?.result?.value;
      if (value && typeof value === 'object') {
        // Convert string keys back to numbers
        const result: Record<number, number> = {};
        for (const [k, v] of Object.entries(value)) {
          if (typeof v === 'number') result[Number(k)] = v;
        }
        return result;
      }
      return null;
    } catch (e) {
      console.warn(`Failed to load tool-spool map from Moonraker (${base})`, formatFetchError(base, e));
    }
  }

  return null;
}

export function getWebSocketUrl(config: AceConfig): string {
  if (config.wsBase) return config.wsBase;
  const apiBase = config.apiBase;
  if (apiBase.startsWith('https://')) return apiBase.replace('https://', 'wss://') + '/websocket';
  if (apiBase.startsWith('http://')) return apiBase.replace('http://', 'ws://') + '/websocket';
  return `ws://${window.location.host}/websocket`;
}

export function getPrinterWebSocketUrl(config: AceConfig): string {
  if (config.printerWsBase) return config.printerWsBase;
  const apiBase = config.printerApiBase || config.apiBase;
  if (!apiBase) return '';
  if (apiBase.startsWith('https://')) return apiBase.replace('https://', 'wss://') + '/websocket';
  if (apiBase.startsWith('http://')) return apiBase.replace('http://', 'ws://') + '/websocket';
  return '';
}
