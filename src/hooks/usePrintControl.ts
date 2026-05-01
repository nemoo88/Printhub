import { useState, useCallback, useRef } from 'react';

export interface GcodeFile {
  path: string;
  modified: number;
  size: number;
  // metadata if available
  estimated_time?: number;
  filament_total?: number;
  layer_height?: number;
  first_layer_height?: number;
  object_height?: number;
  slicer?: string;
}

export function usePrintControl(printerApiBase: string) {
  const [files, setFiles] = useState<GcodeFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const apiBase = printerApiBase.replace(/\/+$/, '');

  const loadFiles = useCallback(async () => {
    if (!apiBase) return;
    setLoadingFiles(true);
    try {
      const res = await fetch(`${apiBase}/server/files/list?root=gcodes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: GcodeFile[] = (Array.isArray(data.result) ? data.result : data.result || [])
        .sort((a: GcodeFile, b: GcodeFile) => b.modified - a.modified);
      setFiles(list);
    } catch (e) {
      console.error('Failed to load gcode files:', e);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [apiBase]);

  const startPrint = useCallback(async (filename: string): Promise<boolean> => {
    if (!apiBase) return false;
    try {
      const res = await fetch(`${apiBase}/printer/print/start?filename=${encodeURIComponent(filename)}`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }, [apiBase]);

  const pausePrint = useCallback(async (): Promise<boolean> => {
    if (!apiBase) return false;
    try {
      const res = await fetch(`${apiBase}/printer/print/pause`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }, [apiBase]);

  const resumePrint = useCallback(async (): Promise<boolean> => {
    if (!apiBase) return false;
    try {
      const res = await fetch(`${apiBase}/printer/print/resume`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }, [apiBase]);

  const cancelPrint = useCallback(async (): Promise<boolean> => {
    if (!apiBase) return false;
    try {
      const res = await fetch(`${apiBase}/printer/print/cancel`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }, [apiBase]);

  return {
    files,
    loadingFiles,
    loadFiles,
    startPrint,
    pausePrint,
    resumePrint,
    cancelPrint,
  };
}
