import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '@/components/app/AppLayout';
import { PrintJobCard } from '@/components/ace/PrintJobCard';
import { TemperaturesCard } from '@/components/ace/TemperaturesCard';
import { DryerControlCard } from '@/components/ace/DryerControlCard';
import { FeedRetractDialog } from '@/components/ace/FeedRetractDialog';
import { FansOutputsCard } from '@/components/ace/FansOutputsCard';
import { ConsoleCard } from '@/components/ace/ConsoleCard';
import { StartPrintDialog } from '@/components/ace/StartPrintDialog';
import { CollapsibleSection } from '@/components/ace/CollapsibleSection';
import { BedMeshCard } from '@/components/ace/BedMeshCard';
import { DashboardGrid, type DashboardWidget } from '@/components/ace/DashboardGrid';
import { useBedMesh } from '@/hooks/useBedMesh';
import { useSpoolman, type SpoolmanSpool } from '@/hooks/useSpoolman';
import { usePrintControl } from '@/hooks/usePrintControl';
import { useCameraMonitor } from '@/hooks/useCameraMonitor';
import { t } from '@/lib/ace-translations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Camera, RefreshCw, Plus, Trash2, Package, Settings, ExternalLink } from 'lucide-react';

const MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PC', 'PVA'];

interface SpoolForm {
  vendorName: string;
  material: string;
  colorHex: string;
  weightTotal: number;
  location: string;
  comment: string;
}
const emptyForm: SpoolForm = { vendorName: '', material: 'PLA', colorHex: '#ffffff', weightTotal: 1000, location: '', comment: '' };

export default function DashboardPage() {
  const { config, lang, ace, printer, hasPrinter } = useAppContext();

  const [dialogState, setDialogState] = useState<{ open: boolean; mode: 'feed' | 'retract'; slot: number }>({ open: false, mode: 'feed', slot: 0 });
  const [cameraActive, setCameraActive] = useState(true);
  const [imgSrc, setImgSrc] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const errorCountRef = useRef(0);
  const MAX_CAMERA_ERRORS = 5;

  const printerApiForCamera = config.printerApiBase || config.apiBase;
  const cameraMonitor = useCameraMonitor({
    apiBase: printerApiForCamera,
    keepAliveInterval: 60_000,
    enabled: cameraActive && !!printerApiForCamera,
  });

  const cameraUrl = (() => {
    if (config.cameraUrl) return config.cameraUrl;
    if (cameraMonitor.snapshotUrl) return cameraMonitor.snapshotUrl;
    const apiBase = config.printerApiBase || config.apiBase;
    if (!apiBase) return '';
    const origin = new URL(apiBase).origin;
    return `${origin}/server/files/camera/monitor.jpg`;
  })();

  useEffect(() => {
    const url = cameraUrl;
    if (!cameraActive || !url) { setImgSrc(''); setCameraError(false); errorCountRef.current = 0; return; }
    setCameraError(false);
    errorCountRef.current = 0;
    const poll = () => setImgSrc(`${url}${url.includes('?') ? '&' : '?'}nocache=${Date.now()}`);
    poll();
    intervalRef.current = setInterval(poll, 1200);
    return () => clearInterval(intervalRef.current);
  }, [cameraActive, cameraUrl]);

  const spoolman = useSpoolman(config.apiBase, config.spoolmanUrl, config.printerApiBase);
  const bedMesh = useBedMesh(config.printerApiBase || config.apiBase);
  const [spoolDialogOpen, setSpoolDialogOpen] = useState(false);
  const [spoolmanIframeOpen, setSpoolmanIframeOpen] = useState(false);
  const [form, setForm] = useState<SpoolForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const printControl = usePrintControl(config.printerApiBase || config.apiBase);
  const [startPrintDialogOpen, setStartPrintDialogOpen] = useState(false);

  const handleStartPrint = useCallback(async (filename: string) => {
    const ok = await printControl.startPrint(filename);
    if (ok) toast.success(t(lang, 'printer.printStarted'));
    else toast.error('Failed to start print');
  }, [printControl, lang]);

  const handlePausePrint = useCallback(async () => {
    const ok = await printControl.pausePrint();
    if (ok) toast.success(t(lang, 'printer.printPaused'));
  }, [printControl, lang]);

  const handleResumePrint = useCallback(async () => {
    const ok = await printControl.resumePrint();
    if (ok) toast.success(t(lang, 'printer.printResumed'));
  }, [printControl, lang]);

  const handleCancelPrint = useCallback(async () => {
    const ok = await printControl.cancelPrint();
    if (ok) toast.success(t(lang, 'printer.printCancelled'));
  }, [printControl, lang]);

  const openAddSpool = () => { setForm(emptyForm); setSpoolDialogOpen(true); };
  const handleSaveSpool = async () => {
    if (!form.vendorName.trim()) { toast.error(t(lang, 'filament.brandRequired')); return; }
    setSaving(true);
    try {
      await spoolman.addSpool({ vendorName: form.vendorName, material: form.material, colorHex: form.colorHex, weightTotal: form.weightTotal, location: form.location, comment: form.comment });
      toast.success(t(lang, 'filament.added'));
      setSpoolDialogOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const handleDeleteSpool = async (id: number) => {
    try { await spoolman.deleteSpool(id); toast.success(t(lang, 'filament.deleted')); } catch (e: any) { toast.error(e.message); }
  };

  const colorFromHex = (hex?: string) => hex ? `#${hex}` : '#888';
  // Calculate live remaining weight accounting for current print usage
  const liveRemainingWeight = useCallback((s: SpoolmanSpool) => {
    if (s.remaining_weight == null) return '?';
    const isPrinting = printer.job.state === 'printing' || printer.job.state === 'paused';
    // Check if this spool is mapped to any tool
    const isMapped = Object.values(spoolman.toolSpoolMap).includes(s.id);
    const isActive = spoolman.activeSpoolId === s.id || isMapped;
    if (isActive && isPrinting && printer.job.filamentUsed > 0) {
      // For multi-tool: estimate usage proportionally (simplified — exact per-tool tracking happens via reportToolFilament)
      const usedSinceStart = printer.job.filamentUsed - lastReportedFilamentRef.current;
      if (usedSinceStart > 0 && s.id === spoolman.getSpoolForTool(printer.activeTool)) {
        const diameter = s.filament.diameter ?? 1.75;
        const density = s.filament.density ?? 1.24;
        const radiusCm = (diameter / 2) / 10;
        const lengthCm = (usedSinceStart - (toolFilamentCheckpointRef.current ?? 0)) / 10;
        if (lengthCm > 0) {
          const usedGrams = Math.PI * radiusCm * radiusCm * lengthCm * density;
          return Math.max(0, Math.round(s.remaining_weight - usedGrams));
        }
      }
    }
    return Math.round(s.remaining_weight);
  }, [spoolman.activeSpoolId, spoolman.toolSpoolMap, spoolman.getSpoolForTool, printer.job.state, printer.job.filamentUsed, printer.activeTool]);
  const totalWeight = (s: SpoolmanSpool) => s.filament.weight ?? 0;

  const handleLoad = useCallback(async (index: number) => {
    const success = await ace.executeCommand('ACE_CHANGE_TOOL', { TOOL: index });
    if (success) ace.setCurrentTool(index);
  }, [ace]);
  const handlePark = useCallback((index: number) => ace.executeCommand('ACE_PARK_TO_TOOLHEAD', { INDEX: index }), [ace]);
  const handleToggleAssist = useCallback(async (index: number) => {
    if (ace.feedAssistSlot === index) {
      const ok = await ace.executeCommand('ACE_DISABLE_FEED_ASSIST', { INDEX: index });
      if (ok) ace.setFeedAssistSlot(-1);
    } else {
      if (ace.feedAssistSlot !== -1) await ace.executeCommand('ACE_DISABLE_FEED_ASSIST', { INDEX: ace.feedAssistSlot });
      const ok = await ace.executeCommand('ACE_ENABLE_FEED_ASSIST', { INDEX: index });
      if (ok) ace.setFeedAssistSlot(index);
    }
  }, [ace]);
  const handleUnload = useCallback(async () => {
    const ok = await ace.executeCommand('ACE_CHANGE_TOOL', { TOOL: -1 });
    if (ok) ace.setCurrentTool(-1);
  }, [ace]);

  const handleRefresh = useCallback(async () => {
    await ace.loadStatus();
    await printer.loadFullStatus();
    if (spoolman.isAvailable) spoolman.reload();
    // Small delay before bed mesh reload to let Klipper settle after full status query
    setTimeout(() => bedMesh.reload(), 500);
    toast.success(t(lang, 'notifications.refreshStatus'));
  }, [ace, printer, lang, spoolman, bedMesh]);

  // === Multi-tool filament tracking ===
  const prevJobStateRef = useRef(printer.job.state);
  const prevToolRef = useRef(printer.activeTool);
  const lastReportedFilamentRef = useRef(0);
  const lastNonZeroFilamentRef = useRef(0);
  // Per-tool checkpoint: how much filament_used was at last tool change
  const toolFilamentCheckpointRef = useRef(0);
  const latestFilamentUsedRef = useRef(printer.job.filamentUsed);
  const latestToolRef = useRef(printer.activeTool);
  const periodicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasToolMapping = Object.keys(spoolman.toolSpoolMap).length > 0;

  const setActiveSpoolOnPrinter = useCallback(async (spoolId: number | null) => {
    const printerApi = (config.printerApiBase || config.apiBase).replace(/\/+$/, '');
    if (!printerApi) return;
    try {
      await fetch(`${printerApi}/server/spoolman/spool_id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spool_id: spoolId ?? -1 }),
      });
    } catch { /* ignore */ }
  }, [config.printerApiBase, config.apiBase]);

  useEffect(() => {
    latestFilamentUsedRef.current = printer.job.filamentUsed;
    if (printer.job.filamentUsed > 0) {
      lastNonZeroFilamentRef.current = printer.job.filamentUsed;
    }
    latestToolRef.current = printer.activeTool;
  }, [printer.job.filamentUsed, printer.activeTool]);

  // On tool change during printing: report delta to previous tool's spool
  useEffect(() => {
    const isPrinting = printer.job.state === 'printing';
    const prevTool = prevToolRef.current;
    const curTool = printer.activeTool;

    if (isPrinting && prevTool !== curTool && hasToolMapping) {
      // Report delta to previous tool's spool
      if (prevTool >= 0) {
        const delta = printer.job.filamentUsed - toolFilamentCheckpointRef.current;
        const prevSpoolId = spoolman.getSpoolForTool(prevTool);
        if (delta > 1 && prevSpoolId) {
          spoolman.useFilament(prevSpoolId, delta)
            .then(() => {
              console.log(`Tool change T${prevTool}→T${curTool}: reported ${(delta/1000).toFixed(2)}m to spool #${prevSpoolId}`);
            })
            .catch(() => {});
        }
        toolFilamentCheckpointRef.current = printer.job.filamentUsed;
      }
      // Update active spool on printer's Moonraker for the new tool
      if (curTool >= 0) {
        const newSpoolId = spoolman.getSpoolForTool(curTool);
        if (newSpoolId) {
          spoolman.setActiveSpool(newSpoolId);
          setActiveSpoolOnPrinter(newSpoolId);
        }
      }
    }

    prevToolRef.current = curTool;
  }, [printer.activeTool, printer.job.state, printer.job.filamentUsed, hasToolMapping, spoolman.getSpoolForTool, spoolman.useFilament, spoolman.setActiveSpool, setActiveSpoolOnPrinter]);

  // Periodic reporting during active print (every 5 min)
  useEffect(() => {
    if (printer.job.state !== 'printing' || !spoolman.isAvailable) return;

    periodicTimerRef.current = setInterval(() => {
      const currentFilament = latestFilamentUsedRef.current;
      const delta = currentFilament - toolFilamentCheckpointRef.current;
      const curTool = latestToolRef.current;

      if (delta > 1 && hasToolMapping && curTool >= 0) {
        const spoolId = spoolman.getSpoolForTool(curTool);
        if (spoolId) {
          spoolman.useFilament(spoolId, delta)
            .then(() => { toolFilamentCheckpointRef.current = currentFilament; })
            .catch(() => {});
        }
      } else if (delta > 1 && !hasToolMapping && spoolman.activeSpoolId) {
        // Fallback: single spool mode
        spoolman.useFilament(spoolman.activeSpoolId, delta)
          .then(() => { toolFilamentCheckpointRef.current = currentFilament; })
          .catch(() => {});
      }
    }, 5 * 60 * 1000);

    return () => {
      if (periodicTimerRef.current) {
        clearInterval(periodicTimerRef.current);
        periodicTimerRef.current = null;
      }
    };
  }, [printer.job.state, spoolman.isAvailable, spoolman.useFilament, spoolman.activeSpoolId, spoolman.getSpoolForTool, hasToolMapping]);

  // Auto-map tools to spools based on slicer metadata when print starts OR when metadata arrives
  // Priority: 1) Spoolman spool IDs from slicer, 2) Color matching
  const autoMapAttemptedRef = useRef('');

  useEffect(() => {
    const curState = printer.job.state;
    const isActive = curState === 'printing' || curState === 'paused';

    // Trigger auto-map when: (a) print is active AND (b) filamentMeta is available AND (c) spools loaded
    if (!isActive || !printer.job.filamentMeta || spoolman.spools.length === 0) return;

    const meta = printer.job.filamentMeta;
    const hasSpoolIds = meta.spoolIds?.length > 0;
    const hasColors = meta.colors?.length > 0;
    if (!hasSpoolIds && !hasColors) return;

    const mapKey = hasSpoolIds ? `ids:${meta.spoolIds.join(',')}` : `colors:${meta.colors.join(',')}`;
    if (mapKey === autoMapAttemptedRef.current) return;
    autoMapAttemptedRef.current = mapKey;

    const newMap: Record<number, number> = {};
    const usedSpoolIds = new Set<number>();

    if (hasSpoolIds) {
      // Direct mapping by Spoolman spool ID from slicer (e.g. OrcaSlicer)
      meta.spoolIds.forEach((spoolId, toolIdx) => {
        const spool = spoolman.spools.find(s => s.id === spoolId);
        if (spool && !usedSpoolIds.has(spool.id)) {
          newMap[toolIdx] = spool.id;
          usedSpoolIds.add(spool.id);
        }
      });
    } else if (hasColors) {
      // Fallback: match by color, filtered by material when available
      meta.colors.forEach((slicerColor, toolIdx) => {
        const norm = slicerColor.replace('#', '').toLowerCase();
        const toolMaterial = meta.materials?.[toolIdx]?.toUpperCase() || '';
        
        const candidates = spoolman.spools.filter(s => {
          if (usedSpoolIds.has(s.id)) return false;
          if (toolMaterial && s.filament.material) {
            return s.filament.material.toUpperCase() === toolMaterial;
          }
          return true;
        });

        let bestSpool: SpoolmanSpool | undefined;
        bestSpool = candidates.find(s =>
          s.filament.color_hex?.toLowerCase() === norm
        );
        if (!bestSpool && norm.length === 6) {
          const sr = parseInt(norm.slice(0, 2), 16);
          const sg = parseInt(norm.slice(2, 4), 16);
          const sb = parseInt(norm.slice(4, 6), 16);
          let minDist = Infinity;
          for (const s of candidates) {
            if (!s.filament.color_hex) continue;
            const hex = s.filament.color_hex.toLowerCase();
            if (hex.length < 6) continue;
            const pr = parseInt(hex.slice(0, 2), 16);
            const pg = parseInt(hex.slice(2, 4), 16);
            const pb = parseInt(hex.slice(4, 6), 16);
            const dist = Math.sqrt((sr - pr) ** 2 + (sg - pg) ** 2 + (sb - pb) ** 2);
            if (dist < minDist && dist < 80) {
              minDist = dist;
              bestSpool = s;
            }
          }
        }
        if (bestSpool) {
          newMap[toolIdx] = bestSpool.id;
          usedSpoolIds.add(bestSpool.id);
        }
      });
    }

    if (Object.keys(newMap).length > 0) {
      for (const [tool, spoolId] of Object.entries(newMap)) {
        spoolman.setToolSpool(Number(tool), spoolId);
      }
      // Set the active tool's spool on the printer's Moonraker for UI display
      const activeToolSpool = newMap[printer.activeTool];
      if (activeToolSpool) {
        spoolman.setActiveSpool(activeToolSpool);
        setActiveSpoolOnPrinter(activeToolSpool);
      }
      const mapped = Object.entries(newMap).map(([t, id]) => `T${t}→#${id}`).join(', ');
      const method = hasSpoolIds ? 'spool ID' : (lang === 'sv' ? 'färg' : 'color');
      toast.info(lang === 'sv' ? `Auto-mappat (${method}): ${mapped}` : `Auto-mapped (${method}): ${mapped}`);
    }
  }, [printer.job.state, printer.job.filamentMeta, spoolman.spools, spoolman.setToolSpool, spoolman.setActiveSpool, setActiveSpoolOnPrinter, printer.activeTool, lang]);

  // Report remaining on print end + reset tracking
  useEffect(() => {
    const prevState = prevJobStateRef.current;
    const curState = printer.job.state;
    const wasActive = prevState === 'printing' || prevState === 'paused';
    const isActive = curState === 'printing' || curState === 'paused';

    if (isActive && !wasActive) {
      lastReportedFilamentRef.current = printer.job.filamentUsed;
      lastNonZeroFilamentRef.current = printer.job.filamentUsed;
      toolFilamentCheckpointRef.current = printer.job.filamentUsed;
      // Reset auto-map so slicer metadata overrides any manual tool assignments on new print
      autoMapAttemptedRef.current = '';
    }

    if (wasActive && !isActive) {
      const finalFilament = printer.job.filamentUsed > 0 ? printer.job.filamentUsed : lastNonZeroFilamentRef.current;
      const delta = finalFilament - toolFilamentCheckpointRef.current;

      if (delta > 0 && hasToolMapping) {
        const lastTool = latestToolRef.current;
        const spoolId = lastTool >= 0 ? spoolman.getSpoolForTool(lastTool) : null;
        if (spoolId) {
          spoolman.useFilament(spoolId, delta)
            .then(() => toast.info(`Filament usage recorded: ${(finalFilament / 1000).toFixed(2)}m total`))
            .catch(() => {});
        }
      } else if (delta > 0 && !hasToolMapping && spoolman.activeSpoolId) {
        spoolman.useFilament(spoolman.activeSpoolId, delta)
          .then(() => toast.info(`Filament usage recorded: ${(finalFilament / 1000).toFixed(2)}m total`))
          .catch(() => {});
      }

      lastReportedFilamentRef.current = 0;
      lastNonZeroFilamentRef.current = 0;
      toolFilamentCheckpointRef.current = 0;
      autoMapAttemptedRef.current = '';
    }

    prevJobStateRef.current = curState;
  }, [printer.job.state, printer.job.filamentUsed, spoolman.useFilament, spoolman.activeSpoolId, spoolman.getSpoolForTool, hasToolMapping]);

  // Auto-sync active spool from Moonraker's spoolman integration
  // AND auto-build tool→spool map from SET_ACTIVE_SPOOL gcode commands during printing
  const prevMoonrakerSpoolRef = useRef<number | null>(null);
  useEffect(() => {
    if (!spoolman.isAvailable) return;
    const printerApi = (config.printerApiBase || config.apiBase).replace(/\/+$/, '');
    const aceApi = config.apiBase.replace(/\/+$/, '');
    if (!printerApi && !aceApi) return;

    const tryFetchSpoolId = async (base: string): Promise<number | null> => {
      try {
        const res = await fetch(`${base}/server/spoolman/active_spool_id`);
        if (!res.ok) return null;
        const data = await res.json();
        const id = data?.result?.spool_id;
        return typeof id === 'number' ? id : null;
      } catch {
        return null;
      }
    };

    const syncActiveSpool = async () => {
      const bases = [printerApi, aceApi].filter((b, i, a) => b && a.indexOf(b) === i);
      for (const base of bases) {
        const spoolId = await tryFetchSpoolId(base);
        if (spoolId !== null) {
          if (spoolId > 0 && spoolId !== spoolman.activeSpoolId) {
            const spoolExists = spoolman.spools.some(s => s.id === spoolId);
            if (spoolExists) {
              spoolman.setActiveSpool(spoolId);
            }
          } else if (spoolId === 0 && spoolman.activeSpoolId !== null) {
            spoolman.setActiveSpool(null);
          }

          // During printing: when Moonraker's active spool changes (SET_ACTIVE_SPOOL in gcode),
          // automatically map it to the current tool
          const isPrinting = printer.job.state === 'printing' || printer.job.state === 'paused';
          if (isPrinting && spoolId > 0 && spoolId !== prevMoonrakerSpoolRef.current) {
            const curTool = printer.activeTool;
            if (curTool >= 0) {
              const currentMapping = spoolman.getSpoolForTool(curTool);
              if (currentMapping !== spoolId) {
                spoolman.setToolSpool(curTool, spoolId);
                console.log(`Auto-mapped T${curTool} → spool #${spoolId} (from SET_ACTIVE_SPOOL)`);
              }
            }
          }
          prevMoonrakerSpoolRef.current = spoolId;
          return;
        }
      }
    };

    syncActiveSpool();
    const interval = setInterval(syncActiveSpool, 5000);
    return () => clearInterval(interval);
  }, [spoolman.isAvailable, spoolman.activeSpoolId, spoolman.setActiveSpool, spoolman.spools, spoolman.setToolSpool, spoolman.getSpoolForTool, config.printerApiBase, config.apiBase, printer.job.state, printer.activeTool]);

  const activeSpool = spoolman.activeSpoolId ? spoolman.spools.find(s => s.id === spoolman.activeSpoolId) : null;
  // Get spool for current active tool (multi-tool mode)
  const activeToolSpool = printer.activeTool >= 0 ? spoolman.spools.find(s => s.id === spoolman.getSpoolForTool(printer.activeTool)) : null;
  const displaySpool = hasToolMapping ? activeToolSpool : activeSpool;

  // Build widget list
  const widgets: DashboardWidget[] = useMemo(() => {
    const w: DashboardWidget[] = [];

    if (hasPrinter) {
      w.push({
        id: 'print-job',
        title: t(lang, 'printer.printJob'),
        defaultLayout: { w: 6, h: 4, minW: 1, minH: 1 },
        content: (
          <div className="h-full flex flex-col">
            <PrintJobCard
              job={printer.job} speedFactor={printer.speedFactor} activeTool={printer.activeTool} lang={lang}
              activeSpool={displaySpool}
              onPause={handlePausePrint} onResume={handleResumePrint} onCancel={handleCancelPrint}
              onStartDialog={() => setStartPrintDialogOpen(true)}
            />
            {hasToolMapping ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 border-t border-border/30 bg-card/60">
                {Object.entries(spoolman.toolSpoolMap).map(([tool, spoolId]) => {
                  const s = spoolman.spools.find(sp => sp.id === spoolId);
                  if (!s) return null;
                  const isCurrentTool = printer.activeTool === Number(tool);
                  return (
                    <span key={tool} className={`flex items-center gap-1 ${isCurrentTool ? 'text-foreground font-medium' : ''}`}>
                      <span className="w-2 h-2 rounded-full border border-border" style={{ backgroundColor: s.filament.color_hex ? `#${s.filament.color_hex}` : undefined }} />
                      T{tool}
                    </span>
                  );
                })}
              </div>
            ) : activeSpool ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 border-t border-border/30 bg-card/60">
                <span className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: activeSpool.filament.color_hex ? `#${activeSpool.filament.color_hex}` : undefined }} />
                <span>{lang === 'sv' ? 'Aktiv' : 'Active'}: #{activeSpool.id} {activeSpool.filament.vendor?.name} {activeSpool.filament.material}</span>
              </div>
            ) : null}
          </div>
        ),
      });

      w.push({
        id: 'camera',
        title: t(lang, 'nav.camera'),
        defaultLayout: { w: 6, h: 4, minW: 1, minH: 1 },
        content: (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden h-full">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> {t(lang, 'nav.camera')}
                {cameraMonitor.connected && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
              </span>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => setCameraActive(!cameraActive)}>
                {cameraActive ? t(lang, 'camera.stop') : t(lang, 'camera.start')}
              </Button>
            </div>
            {cameraError ? (
              <div className="w-full aspect-[2/1] bg-secondary flex flex-col items-center justify-center text-muted-foreground text-xs gap-1.5">
                <Camera className="h-6 w-6 opacity-40" />
                <p>{t(lang, 'camera.unreachable')}</p>
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => { setCameraError(false); errorCountRef.current = 0; setCameraActive(true); }}>
                  {t(lang, 'camera.retry')}
                </Button>
              </div>
            ) : imgSrc ? (
              <img src={imgSrc} alt="Printer camera" className="w-full object-contain bg-black"
                onLoad={() => { errorCountRef.current = 0; }}
                onError={() => { errorCountRef.current++; if (errorCountRef.current >= MAX_CAMERA_ERRORS) { setCameraError(true); clearInterval(intervalRef.current); } }} />
            ) : (
              <div className="w-full aspect-[2/1] bg-secondary flex flex-col items-center justify-center text-muted-foreground text-xs gap-1.5">
                <Camera className="h-6 w-6 opacity-40" />
                <p>{cameraActive ? (cameraMonitor.connected ? t(lang, 'camera.waiting') : t(lang, 'camera.connecting')) : t(lang, 'camera.start')}</p>
              </div>
            )}
          </Card>
        ),
      });

      // Dynamic height: header ~56px + each heater row ~28px, rowHeight=80
      const tempH = Math.max(2, Math.ceil((56 + Math.max(1, printer.heaters.length) * 28) / 80));
      w.push({
        id: 'temperatures',
        title: t(lang, 'printer.temperatures'),
        defaultLayout: { w: 4, h: tempH, minW: 1, minH: 1 },
        content: <TemperaturesCard heaters={printer.heaters} lang={lang} onSetTemp={printer.setHeaterTemp} />,
      });

      // Dynamic height: header ~40px + each fan ~50px
      const fansH = Math.max(2, Math.ceil((40 + Math.max(1, printer.fans.length) * 50) / 80));
      w.push({
        id: 'fans',
        title: t(lang, 'printer.fansOutputs'),
        defaultLayout: { w: 4, h: fansH, minW: 1, minH: 1 },
        content: <FansOutputsCard fans={printer.fans} lang={lang} onSetFanSpeed={printer.setFanSpeed} title={t(lang, 'printer.fansOutputs') + ' (Printer)'} />,
      });

      w.push({
        id: 'console',
        title: t(lang, 'printer.console'),
        defaultLayout: { w: 4, h: 4, minW: 1, minH: 1 },
        content: <ConsoleCard lang={lang} onSendGcode={printer.sendGcode} />,
      });

      w.push({
        id: 'bed-mesh',
        title: 'Bed Mesh',
        defaultLayout: { w: 6, h: 4, minW: 1, minH: 1 },
        content: <BedMeshCard profile={bedMesh.profile} loading={bedMesh.loading} error={bedMesh.error} onReload={bedMesh.reload} lang={lang} />,
      });

    }

    // ACE sections
    w.push({
      id: 'ace-dryer',
      title: 'ACE Pro — ' + t(lang, 'cards.dryer'),
      defaultLayout: { w: 6, h: 5, minW: 1, minH: 1 },
      content: (
        <DryerControlCard
          dryer={ace.dryerStatus} config={config} lang={lang} onCommand={ace.executeCommand}
          printJobState={printer.job.state}
          printRemainingSeconds={
            printer.job.estimatedTime && printer.job.estimatedTime > 0
              ? Math.max(0, printer.job.estimatedTime - printer.job.printDuration)
              : printer.job.progress > 0
                ? Math.max(0, (printer.job.printDuration / (printer.job.progress / 100)) - printer.job.printDuration)
                : 0
          }
        />
      ),
    });

    w.push({
      id: 'ace-status',
      title: 'ACE Pro Status',
      defaultLayout: { w: 6, h: 2, minW: 1, minH: 1 },
      content: (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
          <CardContent className="py-3 px-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">{t(lang, 'deviceInfo.temp')}</span>
              <span className="font-mono text-xs">{ace.deviceStatus.temp.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">{t(lang, 'deviceInfo.fan')}</span>
              <span className="font-mono text-xs">{ace.deviceStatus.fan_speed} RPM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">{t(lang, 'deviceInfo.model')}</span>
              <span className="text-xs">{ace.deviceStatus.model || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">{t(lang, 'deviceInfo.firmware')}</span>
              <span className="text-xs">{ace.deviceStatus.firmware || '—'}</span>
            </div>
          </CardContent>
        </Card>
      ),
    });

    // Filament inventory
    w.push({
      id: 'filament-inventory',
      title: t(lang, 'nav.filament'),
      defaultLayout: { w: 12, h: 3, minW: 1, minH: 1 },
      content: (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t(lang, 'nav.filament')}</span>
              {spoolman.spoolmanConnected && <Badge variant="outline" className="text-[10px] border-success/50 text-success px-1.5 py-0">Spoolman</Badge>}
            </div>
            <div className="flex items-center gap-1.5">
              {spoolman.spoolmanWebUrl && (
                <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => setSpoolmanIframeOpen(true)}>
                  <ExternalLink className="h-3 w-3" /> Spoolman UI
                </Button>
              )}
              {spoolman.isAvailable && (
                <Button onClick={openAddSpool} size="sm" className="gap-1 h-7 text-xs"><Plus className="h-3.5 w-3.5" /> {t(lang, 'filament.add')}</Button>
              )}
            </div>
          </div>
          {!spoolman.isAvailable ? (
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="py-6 text-center text-muted-foreground">
                <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t(lang, 'filament.noSpoolman')}</p>
              </CardContent>
            </Card>
          ) : spoolman.spools.length === 0 ? (
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="py-6 text-center text-muted-foreground">
                <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t(lang, 'filament.empty')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {spoolman.spools.map(s => {
                const isActive = spoolman.activeSpoolId === s.id;
                // Find which tool this spool is mapped to
                const mappedTool = Object.entries(spoolman.toolSpoolMap).find(([, sid]) => sid === s.id);
                const toolLabel = mappedTool ? `T${mappedTool[0]}` : null;
                return (
                  <div key={s.id} className={`relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm group transition-colors ${isActive || toolLabel ? 'border-primary bg-primary/10' : 'border-border/50 bg-card/80'}`}>
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: colorFromHex(s.filament.color_hex) }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs">{s.filament.vendor?.name || '?'} {s.filament.material || '?'}</p>
                      <p className="text-xs text-muted-foreground">{liveRemainingWeight(s)}g / {totalWeight(s)}g</p>
                    </div>
                    <div className="flex gap-0.5 shrink-0 items-center">
                      {/* Tool assignment dropdown */}
                      <select
                        className="h-6 text-[10px] bg-secondary border border-border/50 rounded px-1 cursor-pointer"
                        value={toolLabel ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = e.target.value;
                          // Remove from old tool first
                          if (mappedTool) spoolman.setToolSpool(Number(mappedTool[0]), null);
                          if (val) {
                            const toolIdx = parseInt(val.replace('T', ''));
                            spoolman.setToolSpool(toolIdx, s.id);
                          }
                        }}
                      >
                        <option value="">—</option>
                        {[0, 1, 2, 3].map(t => {
                          const currentlyMapped = spoolman.toolSpoolMap[t];
                          // Show option if not mapped or mapped to this spool
                          if (currentlyMapped && currentlyMapped !== s.id) return null;
                          return <option key={t} value={`T${t}`}>T{t}</option>;
                        })}
                      </select>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSpool(s.id); }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    });

    return w;
  }, [hasPrinter, printer, lang, activeSpool, displaySpool, hasToolMapping, ace, config, spoolman, bedMesh, cameraActive, cameraMonitor, cameraError, imgSrc, handlePausePrint, handleResumePrint, handleCancelPrint]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold tracking-tight">{t(lang, 'printer.printerStatus')}</h1>
        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> {t(lang, 'quickActions.refresh')}
        </Button>
      </div>

      <DashboardGrid widgets={widgets} lang={lang} />

      {/* Dialogs */}
      <FeedRetractDialog
        open={dialogState.open} onClose={() => setDialogState(s => ({ ...s, open: false }))}
        mode={dialogState.mode} slotIndex={dialogState.slot} config={config} lang={lang} onCommand={ace.executeCommand}
      />
      <StartPrintDialog
        open={startPrintDialogOpen} onOpenChange={setStartPrintDialogOpen}
        files={printControl.files} loading={printControl.loadingFiles}
        lang={lang} onLoadFiles={printControl.loadFiles} onStart={handleStartPrint}
      />
      <Dialog open={spoolDialogOpen} onOpenChange={setSpoolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(lang, 'filament.add')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'filament.vendor')}</label>
              <Input value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} list="vendor-list" placeholder={t(lang, 'filament.vendor')} />
              <datalist id="vendor-list">{spoolman.vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'filament.material')}</label>
              <div className="flex flex-wrap gap-1.5">
                {MATERIALS.map(m => (<Badge key={m} variant={form.material === m ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setForm(f => ({ ...f, material: m }))}>{m}</Badge>))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'filament.color')}</label><Input type="color" value={form.colorHex} onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))} className="h-10 p-1" /></div>
              <div><label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'filament.weightTotal')}</label><Input type="number" value={form.weightTotal} onChange={e => setForm(f => ({ ...f, weightTotal: Number(e.target.value) }))} /></div>
            </div>
            <div><label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'filament.location')}</label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="ACE Slot 0" /></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'filament.notes')}</label><Input value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} /></div>
            <Button onClick={handleSaveSpool} className="w-full" disabled={saving}>{saving ? '...' : t(lang, 'config.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={spoolmanIframeOpen} onOpenChange={setSpoolmanIframeOpen}>
        <DialogContent className="max-w-5xl h-[80vh] p-0">
          <DialogHeader className="px-4 py-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm">Spoolman</DialogTitle>
              {spoolman.spoolmanWebUrl && (
                <a href={spoolman.spoolmanWebUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Öppna i ny flik
                </a>
              )}
            </div>
          </DialogHeader>
          {spoolman.spoolmanWebUrl && <iframe src={spoolman.spoolmanWebUrl} className="w-full flex-1 border-0" style={{ height: 'calc(80vh - 48px)' }} title="Spoolman" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
