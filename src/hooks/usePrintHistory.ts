import { useState, useCallback, useEffect } from 'react';
import type { AceConfig } from '@/config/ace-config';

export interface PrintHistoryEntry {
  id: string;
  filename: string;
  status: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  filamentUsed: number;
  source: 'moonraker' | 'manual';
}

const STORAGE_KEY = 'printhub-print-history';

function loadHistory(): PrintHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function usePrintHistory(config: AceConfig) {
  const [history, setHistory] = useState<PrintHistoryEntry[]>(loadHistory);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const fetchFromMoonraker = useCallback(async () => {
    if (!config.printerApiBase) return;
    setLoading(true);
    try {
      const res = await fetch(`${config.printerApiBase}/server/history/list?limit=50&order=desc`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobs = data.result?.jobs || [];
      const entries: PrintHistoryEntry[] = jobs.map((job: any) => ({
        id: `mr-${job.job_id}`,
        filename: job.filename || 'Unknown',
        status: job.status || 'unknown',
        startTime: new Date((job.start_time || 0) * 1000).toISOString(),
        endTime: new Date((job.end_time || 0) * 1000).toISOString(),
        totalDuration: job.total_duration || 0,
        filamentUsed: job.filament_used || 0,
        source: 'moonraker' as const,
      }));
      setHistory(prev => {
        const manualEntries = prev.filter(e => e.source === 'manual');
        return [...entries, ...manualEntries];
      });
    } catch (e) {
      console.warn('Failed to fetch print history:', e);
    } finally {
      setLoading(false);
    }
  }, [config.printerApiBase]);

  const addManualEntry = useCallback((entry: Omit<PrintHistoryEntry, 'id' | 'source'>) => {
    setHistory(prev => [{ ...entry, id: crypto.randomUUID(), source: 'manual' }, ...prev]);
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);

  return { history, loading, fetchFromMoonraker, addManualEntry, deleteEntry };
}
