import { useState, useCallback } from 'react';
import { loadConfig, saveConfig, type AceConfig } from '@/config/ace-config';
import { t, type Language } from '@/lib/ace-translations';
import { useAceStatus } from '@/hooks/useAceStatus';
import { usePrinterStatus } from '@/hooks/usePrinterStatus';
import { ConnectionBadge } from './ConnectionBadge';
import { LanguageToggle } from './LanguageToggle';
import { DeviceStatusCard } from './DeviceStatusCard';
import { DryerControlCard } from './DryerControlCard';
import { FilamentSlotCard } from './FilamentSlotCard';
import { QuickActionsBar } from './QuickActionsBar';
import { FeedRetractDialog } from './FeedRetractDialog';
import { TemperaturesCard } from './TemperaturesCard';
import { PrintJobCard } from './PrintJobCard';
import { FansOutputsCard } from './FansOutputsCard';
import { ConsoleCard } from './ConsoleCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Palette, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

export function AceDashboard() {
  const [config, setConfig] = useState<AceConfig>(loadConfig);
  const [lang, setLang] = useState<Language>('sv');
  const [showSettings, setShowSettings] = useState(false);
  const [apiInput, setApiInput] = useState(config.apiBase);
  const [printerApiInput, setPrinterApiInput] = useState(config.printerApiBase);

  const {
    wsConnected, deviceStatus, dryerStatus, slots, feedAssistSlot, setFeedAssistSlot,
    setCurrentTool, executeCommand, loadStatus,
  } = useAceStatus(config, lang);

  const printer = usePrinterStatus(config);

  const [dialogState, setDialogState] = useState<{ open: boolean; mode: 'feed' | 'retract'; slot: number }>({ open: false, mode: 'feed', slot: 0 });

  const handleSaveConfig = () => {
    const newConfig = { ...config, apiBase: apiInput, printerApiBase: printerApiInput };
    saveConfig(newConfig);
    setConfig(newConfig);
    setShowSettings(false);
    toast.success('Configuration saved — reconnecting...');
  };

  const handleLoad = useCallback(async (index: number) => {
    const success = await executeCommand('ACE_CHANGE_TOOL', { TOOL: index });
    if (success) setCurrentTool(index);
  }, [executeCommand, setCurrentTool]);

  const handlePark = useCallback((index: number) => executeCommand('ACE_PARK_TO_TOOLHEAD', { INDEX: index }), [executeCommand]);

  const handleToggleAssist = useCallback(async (index: number) => {
    if (feedAssistSlot === index) {
      const ok = await executeCommand('ACE_DISABLE_FEED_ASSIST', { INDEX: index });
      if (ok) setFeedAssistSlot(-1);
    } else {
      if (feedAssistSlot !== -1) await executeCommand('ACE_DISABLE_FEED_ASSIST', { INDEX: feedAssistSlot });
      const ok = await executeCommand('ACE_ENABLE_FEED_ASSIST', { INDEX: index });
      if (ok) setFeedAssistSlot(index);
    }
  }, [executeCommand, feedAssistSlot, setFeedAssistSlot]);

  const handleUnload = useCallback(async () => {
    const ok = await executeCommand('ACE_CHANGE_TOOL', { TOOL: -1 });
    if (ok) setCurrentTool(-1);
  }, [executeCommand, setCurrentTool]);

  const handleStopAssist = useCallback(async () => {
    let any = false;
    for (let i = 0; i < 4; i++) {
      const ok = await executeCommand('ACE_DISABLE_FEED_ASSIST', { INDEX: i });
      if (ok) any = true;
    }
    if (any) { setFeedAssistSlot(-1); toast.success(t(lang, 'notifications.feedAssistAllOff')); }
    else toast.error(t(lang, 'notifications.feedAssistAllOffError'));
  }, [executeCommand, setFeedAssistSlot, lang]);

  const handleRefresh = useCallback(async () => {
    await loadStatus();
    await printer.loadFullStatus();
    toast.success(t(lang, 'notifications.refreshStatus'));
  }, [loadStatus, printer, lang]);

  const hasPrinter = !!config.printerApiBase;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3">
            <Palette className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{t(lang, 'header.title')}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ConnectionBadge connected={wsConnected} lang={lang} />
            {hasPrinter && (
              <Badge variant="outline" className={`gap-1.5 text-xs ${printer.connected ? 'border-success/50 text-success' : 'border-destructive/50 text-destructive'}`}>
                {printer.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {t(lang, printer.connected ? 'printer.printerConnected' : 'printer.printerDisconnected')}
              </Badge>
            )}
            <LanguageToggle lang={lang} onToggle={() => setLang(l => l === 'en' ? 'sv' : 'en')} />
            <Button variant="ghost" size="icon" onClick={() => { setApiInput(config.apiBase); setPrinterApiInput(config.printerApiBase); setShowSettings(!showSettings); }} className="text-muted-foreground hover:text-foreground">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Settings */}
        {showSettings && (
          <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(lang, 'config.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t(lang, 'config.description')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'config.apiBase')}</label>
                  <Input value={apiInput} onChange={e => setApiInput(e.target.value)} placeholder={t(lang, 'config.placeholder')} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'config.printerApiBase')}</label>
                  <Input value={printerApiInput} onChange={e => setPrinterApiInput(e.target.value)} placeholder={t(lang, 'config.printerPlaceholder')} className="bg-secondary/50" />
                </div>
              </div>
              <Button onClick={handleSaveConfig}>{t(lang, 'config.save')}</Button>
            </CardContent>
          </Card>
        )}

        {/* Printer section: Job + Temperatures */}
        {hasPrinter && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PrintJobCard job={printer.job} speedFactor={printer.speedFactor} activeTool={printer.activeTool} lang={lang} />
            <TemperaturesCard heaters={printer.heaters} lang={lang} onSetTemp={printer.setHeaterTemp} />
          </div>
        )}

        {/* ACE Status + Dryer row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DeviceStatusCard status={deviceStatus} lang={lang} />
          <DryerControlCard dryer={dryerStatus} config={config} lang={lang} onCommand={executeCommand} />
        </div>

        {/* Fans + Console (printer) */}
        {hasPrinter && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <FansOutputsCard fans={printer.fans} lang={lang} onSetFanSpeed={printer.setFanSpeed} />
            <ConsoleCard lang={lang} onSendGcode={printer.sendGcode} />
          </div>
        )}

        {/* Quick Actions */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t(lang, 'cards.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActionsBar lang={lang} onUnload={handleUnload} onStopAssist={handleStopAssist} onRefresh={handleRefresh} />
          </CardContent>
        </Card>

        {/* Slots */}
        <div>
          <h2 className="text-lg font-semibold mb-4">{t(lang, 'cards.slots')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {slots.map(slot => (
              <FilamentSlotCard
                key={slot.index}
                slot={slot}
                lang={lang}
                feedAssistSlot={feedAssistSlot}
                onLoad={handleLoad}
                onPark={handlePark}
                onToggleAssist={handleToggleAssist}
                onFeed={(i) => setDialogState({ open: true, mode: 'feed', slot: i })}
                onRetract={(i) => setDialogState({ open: true, mode: 'retract', slot: i })}
              />
            ))}
            {slots.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {wsConnected ? 'Loading slots...' : 'Waiting for connection...'}
              </div>
            )}
          </div>
        </div>
      </div>

      <FeedRetractDialog
        open={dialogState.open}
        onClose={() => setDialogState(s => ({ ...s, open: false }))}
        mode={dialogState.mode}
        slotIndex={dialogState.slot}
        config={config}
        lang={lang}
        onCommand={executeCommand}
      />
    </div>
  );
}
