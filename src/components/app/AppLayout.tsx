import { useState, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { LanguageToggle } from '@/components/ace/LanguageToggle';
import { ConnectionBadge } from '@/components/ace/ConnectionBadge';
import { SettingsDialog } from './SettingsDialog';
import { loadConfig, loadConfigFromMoonraker, saveConfig, type AceConfig } from '@/config/ace-config';
import { t, type Language } from '@/lib/ace-translations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Settings } from 'lucide-react';
import { useAceStatus } from '@/hooks/useAceStatus';
import { usePrinterStatus } from '@/hooks/usePrinterStatus';
import { toast } from 'sonner';

export interface AppContext {
  config: AceConfig;
  lang: Language;
  ace: ReturnType<typeof useAceStatus>;
  printer: ReturnType<typeof usePrinterStatus>;
  hasPrinter: boolean;
}

export function useAppContext() {
  return useOutletContext<AppContext>();
}

export function AppLayout() {
  const [config, setConfig] = useState<AceConfig>(loadConfig);
  const [lang, setLang] = useState<Language>('en');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // On mount, try to load config from Moonraker for cross-device sync
  useEffect(() => {
    if (config.apiBase || config.printerApiBase) {
      loadConfigFromMoonraker(config.apiBase, config.printerApiBase).then(remote => {
        if (remote) setConfig(remote);
      });
    }
  }, []); // Only on mount

  const ace = useAceStatus(config, lang);
  const printer = usePrinterStatus(config);
  const hasPrinter = !!(config.printerApiBase || config.apiBase);

  const handleSaveConfig = async (newConfig: AceConfig) => {
    const result = await saveConfig(newConfig);

    if (result.savedToMoonraker) {
      setConfig(newConfig);
      setSettingsOpen(false);
      toast.success(`Configuration synced${result.savedApiBase ? ` via ${result.savedApiBase}` : ''}.`);
      return;
    }

    const blockedByMixedContent = result.error?.includes('HTTPS app cannot call HTTP Moonraker URL');
    if (blockedByMixedContent) {
      toast.error('Sync blocked: preview runs on HTTPS but Moonraker URL is HTTP. Open PrintHub from a local HTTP address to sync between browsers.');
      return;
    }

    toast.error(`Could not sync settings centrally. Nothing was saved for other browsers${result.error ? `: ${result.error}` : '.'}`);
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <header className="h-10 flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-sm px-2 sm:px-4 sticky top-0 z-10">
        <h1 className="text-sm font-bold tracking-tight text-foreground">PrintHub</h1>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <ConnectionBadge connected={ace.wsConnected} lang={lang} />
          {hasPrinter && (
            <Badge variant="outline" className={`gap-1 text-[10px] sm:text-xs hidden sm:inline-flex ${printer.connected ? 'border-success/50 text-success' : 'border-destructive/50 text-destructive'}`}>
              {printer.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {t(lang, printer.connected ? 'printer.printerConnected' : 'printer.printerDisconnected')}
            </Badge>
          )}
          <LanguageToggle lang={lang} onToggle={() => setLang(l => l === 'en' ? 'sv' : 'en')} />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 p-2 sm:p-3 md:p-4">
        <Outlet context={{ config, lang, ace, printer, hasPrinter } satisfies AppContext} />
      </main>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} config={config} lang={lang} onSave={handleSaveConfig} />
    </div>
  );
}
